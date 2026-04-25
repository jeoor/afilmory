// EdgeOne Edge Function: Inject per-photo OG meta tags
// Intercepts /photos/{photoId} and replaces og:image/twitter:image with photo-specific OG image

import { ogMap } from '../../_data/og-map'

function replaceMetaContent(html: string, property: string, newContent: string): string {
  // Match: <meta property="og:image" content="..."> or <meta property="twitter:image" content="...">
  return html.replace(
    new RegExp(`(<meta\\s+property="${property.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'i'),
    `$1${newContent}$2`,
  )
}

function replaceTitle(html: string, newTitle: string): string {
  let result = html
  // Replace og:title
  result = result.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${newTitle}$2`)
  // Replace twitter:title
  result = result.replace(/(<meta\s+property="twitter:title"\s+content=")[^"]*(")/i, `$1${newTitle}$2`)
  // Replace <title> tag
  result = result.replace(/(<title>)[^<]*(<\/title>)/i, `$1${newTitle}$2`)
  return result
}

export async function onRequest(context: { request: Request; params: Record<string, string> }) {
  const url = new URL(context.request.url)
  if (!url.pathname.startsWith('/photos/')) {
    return new Response('Not Found', { status: 404 })
  }

  const { photoId } = context.params
  if (!photoId) {
    return new Response('Not Found', { status: 404 })
  }

  const photoData = ogMap[photoId]
  const indexUrl = new URL('/index.html', url)
  const response = await fetch(indexUrl)

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    return response
  }

  let html = await response.text()

  if (photoData) {
    // Build absolute OG image URL
    const ogImageUrl = `${url.origin}${photoData.ogImagePath}`

    // Replace meta tags
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
