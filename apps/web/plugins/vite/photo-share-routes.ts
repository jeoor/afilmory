import { existsSync } from 'node:fs'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'
import type { Plugin, ResolvedConfig } from 'vite'

import type { SiteConfig } from '../../../../site.config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '../..')
const rootDir = path.resolve(webRoot, '../..')
const manifestPath = path.resolve(webRoot, 'src/data/photos-manifest.json')

interface PhotosManifest {
  data?: Array<{
    id?: string
    title?: string
  }>
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

function buildPhotoHtml(indexHtml: string, photo: PhotoRoute, siteConfig: SiteConfig) {
  const baseUrl = normalizeBaseUrl(siteConfig.url)
  const photoPath = `/photos/${encodeURIComponent(photo.id)}/`
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

async function writeStaticRouteEntrypoints(outDir: string, routes: string[]) {
  const indexHtml = path.join(outDir, 'index.html')

  for (const route of routes) {
    const routeDir = path.join(outDir, route)
    await mkdir(routeDir, { recursive: true })
    await copyFile(indexHtml, path.join(routeDir, 'index.html'))
  }
}

async function writePhotoRouteEntrypoints(outDir: string, siteConfig: SiteConfig) {
  const indexHtml = await readFile(path.join(outDir, 'index.html'), 'utf-8')
  const photos = await readPhotoRoutes()

  for (const photo of photos) {
    const html = buildPhotoHtml(indexHtml, photo, siteConfig)
    const routeDir = path.join(outDir, 'photos', photo.id)

    await mkdir(routeDir, { recursive: true })
    await writeFile(path.join(routeDir, 'index.html'), html)
    await writeFile(path.join(outDir, 'photos', `${photo.id}.html`), html)
  }
}

async function copyGeneratedOgImages(outDir: string) {
  const publicOgDir = path.join(webRoot, 'public/og')
  if (!existsSync(publicOgDir)) {
    return
  }

  await cp(publicOgDir, path.join(outDir, 'og'), {
    recursive: true,
    force: true,
  })
}

export function createPhotoShareRoutesPlugin(siteConfig: SiteConfig): Plugin {
  let config: ResolvedConfig

  return {
    name: 'photo-share-routes',
    apply: 'build',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    async buildStart() {
      if (process.env.SKIP_PHOTO_OG === '1') {
        this.warn('[photo-share-routes] Skipping per-photo OG generation because SKIP_PHOTO_OG=1')
        return
      }

      await $({ cwd: rootDir, stdio: 'inherit' })`tsx scripts/generate-og-map.ts`
    },
    async writeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir)

      await copyGeneratedOgImages(outDir)
      await writeStaticRouteEntrypoints(outDir, ['explory', 'manifest'])
      await writePhotoRouteEntrypoints(outDir, siteConfig)
    },
  }
}
