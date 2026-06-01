// EdgeOne Edge Function: Inject per-photo OG meta tags
// Intercepts /photos/{photoId} and replaces og:image/twitter:image with photo-specific OG image

import { ogMap } from '../../_data/og-map'

interface FetchEvent extends Event {
  readonly request: Request
  respondWith: (response: Response | Promise<Response>) => void
}

function replaceMetaContent(html: string, property: string, newContent: string): string {
  return html.replace(
    new RegExp(`(<meta\\s+property="${property.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'i'),
    `$1${newContent}$2`,
  )
}

function replaceTitle(html: string, newTitle: string): string {
  let result = html
  result = result.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${newTitle}$2`)
  result = result.replace(/(<meta\s+property="twitter:title"\s+content=")[^"]*(")/i, `$1${newTitle}$2`)
  result = result.replace(/(<title>)[^<]*(<\/title>)/i, `$1${newTitle}$2`)
  return result
}

addEventListener('fetch', ((event: FetchEvent) => {
  const request = event.request
  const url = new URL(request.url)

  // Only handle /photos/{photoId} (no file extension)
  const match = url.pathname.match(/^\/photos\/([^/]+)$/)
  if (!match) {
    // Not our route, let it pass through
    return
  }

  const photoId = match[1]

  // Static file requests — don't intercept, forward to origin
  if (/\.\w+$/.test(photoId)) {
    // Don't call respondWith → EdgeOne forwards the request to origin
    return
  }

  event.respondWith(handleRequest(request, url, photoId))
}) as EventListener)

async function handleRequest(request: Request, url: URL, photoId: string): Promise<Response> {
  const photoData = ogMap[photoId]
  const indexUrl = new URL('/index.html', url)
  const response = await fetch(indexUrl)

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    return response
  }

  let html = await response.text()

  if (photoData) {
    const ogImageUrl = `${url.origin}${photoData.ogImagePath}`
    html = replaceMetaContent(html, 'og:image', ogImageUrl)
    html = replaceMetaContent(html, 'twitter:image', ogImageUrl)
    html = replaceTitle(html, photoData.title)
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('transfer-encoding')
  headers.set('content-type', 'text/html; charset=utf-8')

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
