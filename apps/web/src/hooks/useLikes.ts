import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'

const VID_KEY = 'afilmory_vid'

function getOrCreateVid(): string {
  if (typeof window === 'undefined') return ''
  let vid = localStorage.getItem(VID_KEY)
  if (!vid) {
    vid = crypto.randomUUID().replaceAll('-', '')
    localStorage.setItem(VID_KEY, vid)
  }
  return vid
}

interface LikeData {
  count: number
  liked: boolean
}

const fetcher = async (url: string): Promise<LikeData> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch likes')
  return res.json()
}

export function useLikes(photoId: string | undefined) {
  const [vid, setVid] = useState('')

  useEffect(() => {
    setVid(getOrCreateVid())
  }, [])

  const apiUrl = photoId && vid ? `/api/likes?photoId=${encodeURIComponent(photoId)}&vid=${vid}` : null

  const { data, mutate } = useSWR<LikeData>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })

  const toggleLike = useCallback(async () => {
    if (!photoId || !vid) return

    // Optimistic update
    const current = data ?? { count: 0, liked: false }
    const nextLiked = !current.liked
    const nextCount = nextLiked ? current.count + 1 : Math.max(0, current.count - 1)

    await mutate({ count: nextCount, liked: nextLiked }, false)

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, vid }),
      })
      const result = await res.json()
      await mutate(result, false)
    } catch {
      // Revert on error
      await mutate(current, false)
    }
  }, [photoId, vid, data, mutate])

  return {
    count: data?.count ?? 0,
    liked: data?.liked ?? false,
    toggleLike,
    isLoading: !data && !!apiUrl,
  }
}
