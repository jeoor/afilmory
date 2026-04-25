import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

import { precheck } from './precheck'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workdir = path.resolve(__dirname, '..')
const rootDir = path.resolve(__dirname, '../../..')
const distDir = path.resolve(workdir, 'dist')

async function writeStaticRouteEntrypoints(routes: string[]) {
  const indexHtml = path.join(distDir, 'index.html')

  for (const route of routes) {
    const routeDir = path.join(distDir, route)
    await mkdir(routeDir, { recursive: true })
    await copyFile(indexHtml, path.join(routeDir, 'index.html'))
  }
}

async function main() {
  await precheck()
  // Generate per-photo OG images and map for EdgeOne functions unless explicitly disabled.
  if (process.env.SKIP_PHOTO_OG !== '1') {
    await $({ cwd: rootDir, stdio: 'inherit' })`tsx scripts/generate-og-map.ts`
  } else {
    console.info('Skipping per-photo OG generation because SKIP_PHOTO_OG=1')
  }
  await $({ cwd: workdir, stdio: 'inherit' })`vite build`
  await writeStaticRouteEntrypoints(['explory', 'manifest'])
}

main()
