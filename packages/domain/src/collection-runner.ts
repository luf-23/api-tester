import type {
  Collection,
  Environment,
  FolderNode,
  RequestWithTests,
  RunResultItem,
} from '@api-tester/shared'
import { applyVariablesToRequest, mergeVariables } from './variables'
import { runAssertions } from './assertions'

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
        const resolved = applyVariablesToRequest(req, vars) as RequestWithTests
        const started = Date.now()
        try {
          const res = await args.execute(resolved)
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
          const assertion = runAssertions(req.tests, {
            status: res.status,
            headers: normalizeHeaders(res.headers),
            bodyText: res.bodyText,
          })
          items.push({
            requestId: req.id,
            requestName: req.name,
            ok: assertion.ok,
            durationMs,
            assertionFailures: assertion.failures,
          })
          if (!assertion.ok && args.stopOnFailure) return false
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

function normalizeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(h)) {
    out[k.toLowerCase()] = v
  }
  return out
}
