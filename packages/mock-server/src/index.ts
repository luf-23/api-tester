import express from 'express'
import type { MockRoute } from '@api-tester/shared'
import type { Server } from 'node:http'

export class MockServerController {
  private server: Server | null = null
  private port: number | null = null

  get running(): boolean {
    return this.server !== null
  }

  get listenPort(): number | null {
    return this.port
  }

  async start(port: number, routes: MockRoute[]): Promise<void> {
    await this.stop()
    const app = express()
    app.use(express.json({ limit: '2mb' }))
    app.use(express.text({ limit: '2mb', type: '*/*' }))

    for (const r of routes) {
      const method = r.method.toLowerCase() as Lowercase<typeof r.method>
      const path = r.path.startsWith('/') ? r.path : `/${r.path}`
      const handler = (req: express.Request, res: express.Response): void => {
        const delay = r.delayMs ?? 0
        const send = (): void => {
          res.status(r.status)
          for (const h of r.headers) {
            if (h.enabled && h.key) res.setHeader(h.key, h.value)
          }
          const ct =
            r.headers.find((h) => h.enabled && h.key.toLowerCase() === 'content-type')?.value ??
            'application/json'
          res.setHeader('Content-Type', ct)
          try {
            const body =
              ct.includes('json') && r.body.trim().startsWith('{')
                ? JSON.parse(r.body)
                : r.body
            res.send(body)
          } catch {
            res.send(r.body)
          }
        }
        if (delay > 0) setTimeout(send, delay)
        else send()
      }
      if (method === 'get') app.get(path, handler)
      else if (method === 'post') app.post(path, handler)
      else if (method === 'put') app.put(path, handler)
      else if (method === 'patch') app.patch(path, handler)
      else if (method === 'delete') app.delete(path, handler)
      else if (method === 'head') app.head(path, handler)
      else if (method === 'options') app.options(path, handler)
    }

    app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

    await new Promise<void>((resolve, reject) => {
      const s = app.listen(port, () => {
        this.server = s
        this.port = port
        resolve()
      })
      s.on('error', reject)
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()))
    })
    this.server = null
    this.port = null
  }
}
