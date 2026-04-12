import { m } from 'motion/react'
import { useCallback, useState } from 'react'

import { useLikes } from '~/hooks/useLikes'

interface LikeButtonProps {
  photoId: string
}

export const LikeButton = ({ photoId }: LikeButtonProps) => {
  const { count, liked, toggleLike, isLoading } = useLikes(photoId)
  const [justToggled, setJustToggled] = useState(false)

  const handleClick = useCallback(() => {
    if (isLoading) return
    setJustToggled(true)
    toggleLike()
    setTimeout(() => setJustToggled(false), 400)
  }, [isLoading, toggleLike])

  return (
    <button
      type="button"
      onClick={handleClick}
      className="pointer-events-auto absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/70 text-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:text-white disabled:opacity-50"
      disabled={isLoading}
    >
      <m.div
        animate={justToggled ? { scale: [1, 1.4, 0.9, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center"
      >
        <i className={liked ? 'i-mingcute-heart-fill text-red-500' : 'i-mingcute-heart-line'} />
      </m.div>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  )
}
