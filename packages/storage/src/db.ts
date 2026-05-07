import path from 'node:path'
import fs from 'node:fs'

export interface StorageContext {
  filePath: string
}

export function openDatabase(userDataPath: string): StorageContext {
  fs.mkdirSync(userDataPath, { recursive: true })
  const filePath = path.join(userDataPath, 'api-tester.workspace.json')
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          meta: {
            id: 'default',
            name: 'Default',
          },
          environments: [],
          collections: [],
          history: [],
        },
        null,
        2
      ),
      'utf-8'
    )
  }
  return { filePath }
}