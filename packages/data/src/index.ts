import type { CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/builder'

class PhotoLoader {
  private photos: PhotoManifestItem[] = []
  private photoMap: Record<string, PhotoManifestItem> = {}
  private cameras: CameraInfo[] = []
  private lenses: LensInfo[] = []

  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getAllCameras = this.getAllCameras.bind(this)
    this.getAllLenses = this.getAllLenses.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)

    const manifest = typeof window !== 'undefined' ? (window as any).__MANIFEST__ : (globalThis as any).__MANIFEST__
    this.photos = (manifest && Array.isArray(manifest.data) ? manifest.data : []) as PhotoManifestItem[]
    this.cameras = (manifest && Array.isArray(manifest.cameras) ? manifest.cameras : []) as CameraInfo[]
    this.lenses = (manifest && Array.isArray(manifest.lenses) ? manifest.lenses : []) as LensInfo[]

    this.photos.forEach((photo) => {
      if (photo && photo.id) {
        this.photoMap[photo.id] = photo
      }
    })
  }

  getPhotos() {
    return this.photos
  }

  getPhoto(id: string) {
    return this.photoMap[id]
  }

  getAllTags() {
    const tagSet = new Set<string>()
    this.photos.forEach((photo) => {
      photo.tags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }

  getAllCameras() {
    return this.cameras
  }

  getAllLenses() {
    return this.lenses
  }
}
export const photoLoader = new PhotoLoader()
