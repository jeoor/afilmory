import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

import { precheck } from './precheck'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workdir = path.resolve(__dirname, '..')
const rootDir = path.resolve(__dirname, '../../..')

async function main() {
  await precheck()
  // Generate per-photo OG images and map for EdgeOne functions
  await $({ cwd: rootDir, stdio: 'inherit' })`tsx scripts/generate-og-map.ts`
  await $({ cwd: workdir, stdio: 'inherit' })`vite build`
}

main()
