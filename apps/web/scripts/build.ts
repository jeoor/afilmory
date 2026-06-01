import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

import { siteConfig } from '../../../site.config'
import { precheck } from './precheck'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workdir = path.resolve(__dirname, '..')
const rootDir = path.resolve(__dirname, '../../..')
const distDir = path.resolve(workdir, 'dist')
const manifestPath = path.resolve(workdir, 'src/data/photos-manifest.json')

interface PhotosManifest {
  data?: Array<{
    id?: string
    title?: string
  }>
}

async function writeStaticRouteEntrypoints(routes: string[]) {
  const indexHtml = path.join(distDir, 'index.html')

  for (const route of routes) {
    const routeDir = path.join(distDir, route)
    await mkdir(routeDir, { recursive: true })
    await copyFile(indexHtml, path.join(routeDir, 'index.html'))
  }
}

interface PhotoRoute {
  id: string
  title: string
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function replaceMetaContent(html: string, property: string, content: string) {
  const escapedProperty = property.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedContent = escapeHtmlAttribute(content)

  return html.replace(
    new RegExp(`(<meta\\s+property="${escapedProperty}"\\s+content=")[^"]*(")`, 'i'),
    `$1${escapedContent}$2`,
  )
}

function replaceTitle(html: string, title: string) {
  const escapedTitle = escapeHtmlText(title)
  const escapedTitleAttribute = escapeHtmlAttribute(title)

  return html
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${escapedTitleAttribute}$2`)
    .replace(/(<meta\s+property="twitter:title"\s+content=")[^"]*(")/i, `$1${escapedTitleAttribute}$2`)
    .replace(/(<title>)[^<]*(<\/title>)/i, `$1${escapedTitle}$2`)
}

function buildPhotoHtml(indexHtml: string, photo: PhotoRoute) {
  const baseUrl = normalizeBaseUrl(siteConfig.url)
  const photoPath = `/photos/${encodeURIComponent(photo.id)}`
  const photoUrl = `${baseUrl}${photoPath}`
  const ogImageUrl = `${baseUrl}/og/${encodeURIComponent(photo.id)}.png`

  let html = replaceTitle(indexHtml, photo.title)
  html = replaceMetaContent(html, 'og:url', photoUrl)
  html = replaceMetaContent(html, 'twitter:url', photoUrl)
  html = replaceMetaContent(html, 'og:image', ogImageUrl)
  html = replaceMetaContent(html, 'twitter:image', ogImageUrl)
  return html
}

async function readPhotoRoutes(): Promise<PhotoRoute[]> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as PhotosManifest

  return (manifest.data ?? [])
    .filter((photo): photo is { id: string, title?: string } => typeof photo.id === 'string' && photo.id.length > 0)
    .map(photo => ({
      id: photo.id,
      title: photo.title || photo.id,
    }))
}

async function writePhotoRouteEntrypoints(photos: PhotoRoute[]) {
  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf-8')

  for (const photo of photos) {
    const routeDir = path.join(distDir, 'photos', photo.id)
    await mkdir(routeDir, { recursive: true })
    await writeFile(path.join(routeDir, 'index.html'), buildPhotoHtml(indexHtml, photo))
  }
}

async function main() {
  await precheck()
  // Generate per-photo OG images and map for EdgeOne functions unless explicitly disabled.
  if (process.env.SKIP_PHOTO_OG !== '1') {
    await $({ cwd: rootDir, stdio: 'inherit' })`tsx scripts/generate-og-map.ts`
  }
  else {
    console.info('Skipping per-photo OG generation because SKIP_PHOTO_OG=1')
  }
  await $({ cwd: workdir, stdio: 'inherit' })`vite build`
  await writeStaticRouteEntrypoints(['explory', 'manifest'])
  await writePhotoRouteEntrypoints(await readPhotoRoutes())
}

main()
