import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@api-tester/shared',
          '@api-tester/domain',
          '@api-tester/http-client',
          '@api-tester/storage',
          '@api-tester/mock-server',
        ],
      }),
    ],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'main/index.ts'),
        external: ['better-sqlite3'],
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@api-tester/shared'],
      }),
    ],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'preload/index.ts'),
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, 'renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': path.resolve(__dirname, 'renderer/src'),
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'renderer/index.html'),
      },
    },
  },
})
