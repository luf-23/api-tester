import express from 'express'
import multer from 'multer'
import type { MockRoute } from '@api-tester/shared'
import type { Server } from 'node:http'

/** Built-in multipart echo for file upload testing (any field names). */
const uploadTestMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 32 },
})

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

    /**
     * `POST /__api-tester/upload` — accepts `multipart/form-data` (files + text fields).
     * Response JSON echoes field names, text values, and per-file metadata (no file bytes).
     * Use with the in-app Mock Server URL, e.g. `http://127.0.0.1:<port>/__api-tester/upload`.
     */
    app.post('/__api-tester/upload', (req, res) => {
      uploadTestMulter.any()(req, res, (err: unknown) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
            res.status(status).json({
              ok: false,
              error: err.code,
              message: err.message,
            })
            return
          }
          const msg = err instanceof Error ? err.message : String(err)
          res.status(400).json({ ok: false, error: 'UploadError', message: msg })
          return
        }
        const files = (req.files as Express.Multer.File[] | undefined) ?? []
        res.status(200).json({
          ok: true,
          message: 'Multipart echo (built-in upload test endpoint).',
          fields: req.body as Record<string, unknown>,
          files: files.map((f) => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
          })),
        })
      })
    })

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
