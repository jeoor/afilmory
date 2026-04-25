import { kvDiagnostics } from '../../../cloud-functions-lib/photo-kv'

export default function onRequest(context: { env?: Record<string, unknown> }) {
  return new Response(
    JSON.stringify({
      ok: true,
      runtime: 'cloud-functions',
      ...kvDiagnostics(context),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
