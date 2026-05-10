import type {
  Collection,
  Environment,
  FolderNode,
  RequestDraft,
  RequestWithTests,
  RunResultItem,
} from '@api-tester/shared'
import { applyVariablesToRequest, mergeVariables } from './variables'

export type PrepareRequestFn = (
  req: RequestWithTests,
  vars: Record<string, string>
) => { ok: true; request: RequestDraft } | { ok: false; error: string }

export interface ExecuteRequestFn {
  (req: RequestWithTests): Promise<{
    status: number
    headers: Record<string, string>
    bodyText: string
    durationMs: number
    error?: string
  }>
}

export async function runCollection(args: {
  collection: Collection
  globalVars: Environment | undefined
  activeEnv: Environment | undefined
  execute: ExecuteRequestFn
  stopOnFailure: boolean
  /** Default: merge variables only. Use to run pre-request scripts then substitute {{vars}}. */
  prepareRequest?: PrepareRequestFn
}): Promise<RunResultItem[]> {
  const vars = mergeVariables(
    args.globalVars?.variables ?? [],
    args.activeEnv?.variables ?? []
  )
  const items: RunResultItem[] = []

  async function walk(node: FolderNode): Promise<boolean> {
    for (const child of node.children) {
      if ('children' in child) {
        const stop = !(await walk(child))
        if (stop && args.stopOnFailure) return false
      } else {
        const req = child as RequestWithTests
        const started = Date.now()
        const prep = args.prepareRequest
          ? args.prepareRequest(req, vars)
          : {
              ok: true as const,
              request: applyVariablesToRequest(req, vars),
            }
        try {
          if (!prep.ok) {
            items.push({
              requestId: req.id,
              requestName: req.name,
              ok: false,
              durationMs: Date.now() - started,
              error: prep.error,
            })
            if (args.stopOnFailure) return false
            continue
          }
          const res = await args.execute(prep.request as RequestWithTests)
          const durationMs = res.durationMs ?? Date.now() - started
          if (res.error) {
            items.push({
              requestId: req.id,
              requestName: req.name,
              ok: false,
              durationMs,
              error: res.error,
            })
            if (args.stopOnFailure) return false
            continue
          }
          items.push({
            requestId: req.id,
            requestName: req.name,
            ok: true,
            durationMs,
          })
        } catch (e) {
          items.push({
            requestId: req.id,
            requestName: req.name,
            ok: false,
            durationMs: Date.now() - started,
            error: e instanceof Error ? e.message : String(e),
          })
          if (args.stopOnFailure) return false
        }
      }
    }
    return true
  }

  await walk(args.collection.root)
  return items
}
