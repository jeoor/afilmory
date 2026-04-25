// EdgeOne Edge Function: Serve per-photo OG image
// /og/{photoId} -> redirect to static OG image

import { ogMap } from '../../_data/og-map'

export async function onRequest(context: { request: Request; params: Record<string, string> }) {
  const { photoId } = context.params
  if (!photoId) {
    return new Response('Not Found', { status: 404 })
  }

  const photoData = ogMap[photoId]
  if (!photoData) {
    return new Response('Not Found', { status: 404 })
  }

  const url = new URL(context.request.url)
  const imageUrl = `${url.origin}${photoData.ogImagePath}`

  return Response.redirect(imageUrl, 302)
}
