interface Env {
  PHOTO_KV?: {
    get?: (key: string, type?: string) => Promise<string | object | null>
    put?: (key: string, value: string) => Promise<void>
    delete?: (key: string) => Promise<void>
  }
}

export async function onRequest({ env }: { env: Env }) {
  const hasPhotoKv = !!env?.PHOTO_KV
  const hasGet = typeof env?.PHOTO_KV?.get === 'function'
  const hasPut = typeof env?.PHOTO_KV?.put === 'function'
  const hasDelete = typeof env?.PHOTO_KV?.delete === 'function'

  return new Response(
    JSON.stringify({
      ok: true,
      runtime: 'edge-functions',
      hasEnv: !!env,
      hasPhotoKv,
      hasGet,
      hasPut,
      hasDelete,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
