let fileTypeModulePromise: Promise<typeof import('file-type')> | undefined

export async function fileTypeFromBlobLazy(blob: Blob) {
  fileTypeModulePromise ??= import('file-type')
  const { fileTypeFromBlob } = await fileTypeModulePromise
  return fileTypeFromBlob(blob)
}
