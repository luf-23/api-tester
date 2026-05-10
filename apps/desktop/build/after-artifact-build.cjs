'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Wrap win `.zip` layout as `API-Tester/app/*` + empty `API-Tester/data/` so portable matches installed tree.
 */
module.exports = async function afterAllArtifactBuild(context) {
  let AdmZip
  try {
    AdmZip = require('adm-zip')
  } catch {
    console.warn('[after-artifact-build] adm-zip missing; skip zip nesting')
    return
  }

  const paths = context.artifactPaths ?? []
  for (const artifactPath of paths) {
    if (!artifactPath.endsWith('.zip')) continue
    const base = path.basename(artifactPath)
    if (!/^API-Tester-Setup-/i.test(base)) continue

    const zip = new AdmZip(artifactPath)
    const entries = zip.getEntries().filter((e) => !e.isDirectory)
    const out = new AdmZip()
    for (const e of entries) {
      const rel = e.entryName.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!rel) continue
      out.addFile(`API-Tester/app/${rel}`, e.getData())
    }
    out.addFile('API-Tester/data/.gitkeep', Buffer.alloc(0))

    const tmp = `${artifactPath}.rewrap`
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    out.writeZip(tmp)
    fs.unlinkSync(artifactPath)
    fs.renameSync(tmp, artifactPath)
  }
}
