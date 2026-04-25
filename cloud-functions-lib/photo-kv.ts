type KvValue = string | object | null

export interface PhotoKvBinding {
  get?: (key: string, type?: string) => Promise<KvValue>
  put?: (key: string, value: string) => Promise<void>
  delete?: (key: string) => Promise<void>
}

export interface PhotoKvContext {
  env?: Record<string, unknown>
}

export function envValue(name: string, context?: PhotoKvContext): string {
  const fromContext = context?.env?.[name]
  if (fromContext !== undefined && fromContext !== null && String(fromContext) !== '') {
    return String(fromContext)
  }

  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined
  if (fromProcess !== undefined && fromProcess !== null && String(fromProcess) !== '') {
    return String(fromProcess)
  }

  return ''
}

export function kvDiagnostics(context?: PhotoKvContext) {
  const bindingName = envValue('PHOTO_KV_BINDING', context) || 'PHOTO_KV'
  const runtimeBinding = context?.env?.[bindingName] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = runtimeBinding || globalBinding

  return {
    bindingName,
    hasEnv: !!context?.env,
    hasPhotoKv: !!kv,
    hasGet: typeof kv?.get === 'function',
    hasPut: typeof kv?.put === 'function',
    hasDelete: typeof kv?.delete === 'function',
  }
}

export function resolvePhotoKv(
  context: PhotoKvContext | undefined,
  requiredMethods: Array<keyof PhotoKvBinding>,
): PhotoKvBinding | null {
  const bindingName = envValue('PHOTO_KV_BINDING', context) || 'PHOTO_KV'
  const runtimeBinding = context?.env?.[bindingName] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = runtimeBinding || globalBinding

  if (!kv) {
    return null
  }

  for (const method of requiredMethods) {
    if (typeof kv[method] !== 'function') {
      return null
    }
  }

  return kv
}
