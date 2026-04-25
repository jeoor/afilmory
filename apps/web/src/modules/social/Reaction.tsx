import { clsxm } from '@afilmory/utils'
import { FluentEmoji, getEmoji } from '@lobehub/fluent-emoji'
import { produce } from 'immer'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { tv } from 'tailwind-variants'

import { client } from '~/lib/client'

import { useAnalysis } from '../viewer/hooks/useAnalysis'

const reactions = ['\u{1F44D}', '\u{1F60D}', '\u{1F525}', '\u{1F44F}', '\u{1F31F}', '\u{1F64C}'] as const
const REACTION_STORAGE_KEY = 'afilmory:photo-reactions'
type Reaction = (typeof reactions)[number]

interface ReactionRailProps {
  className?: string
  disabled?: boolean
  enabled?: boolean
  photoId: string
  style?: CSSProperties
}

const reactionRail = tv({
  slots: {
    root: 'pointer-events-auto absolute bottom-2 right-2 z-20 flex justify-center',
    track: [
      'flex flex-row items-center gap-2 px-2 py-1.5',
      'transition-all duration-200 ease-out',
      'opacity-0 translate-y-2 pointer-events-none',
      'data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0 data-[visible=true]:pointer-events-auto',
      'group-hover/photo-viewer:opacity-100 group-hover/photo-viewer:translate-y-0 group-hover/photo-viewer:pointer-events-auto',
    ],
    item: [
      'group/reaction-item relative flex size-11 items-center justify-center rounded-2xl',
      'bg-white/1 text-xl text-white/60 backdrop-blur-sm',
      'transition-all duration-300 ease-out',
      'hover:-translate-y-1 hover:scale-110 hover:bg-white/12 hover:text-white hover:backdrop-blur-lg',
      'active:scale-95',
      'data-[active=true]:bg-accent/18 data-[active=true]:text-accent data-[active=true]:backdrop-blur-xl',
      'data-[pending=true]:bg-accent/18 data-[pending=true]:text-accent data-[pending=true]:backdrop-blur-xl',
      'disabled:pointer-events-none disabled:opacity-40',
    ],
    count:
      'absolute -right-1 -top-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-md',
  },
})

function readStoredReactions(photoId: string) {
  if (typeof window === 'undefined') {
    return new Set<Reaction>()
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(REACTION_STORAGE_KEY) || '{}') as Record<string, string[]>
    return new Set(
      (stored[photoId] || []).filter((reaction): reaction is Reaction => reactions.includes(reaction as Reaction)),
    )
  } catch {
    return new Set<Reaction>()
  }
}

function writeStoredReactions(photoId: string, reacted: Set<Reaction>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(REACTION_STORAGE_KEY) || '{}') as Record<string, string[]>
    const next = Array.from(reacted)

    if (next.length > 0) {
      stored[photoId] = next
    } else {
      delete stored[photoId]
    }

    window.localStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Ignore localStorage failures. The remote count is still updated.
  }
}

export const ReactionRail = ({ className, disabled = false, enabled = true, photoId, style }: ReactionRailProps) => {
  const styles = reactionRail()
  const { t } = useTranslation()
  const { data, mutate } = useAnalysis(photoId, enabled)
  const [pendingReactions, setPendingReactions] = useState<Set<Reaction>>(() => new Set())
  const [reactedReactions, setReactedReactions] = useState<Set<Reaction>>(() => readStoredReactions(photoId))

  useEffect(() => {
    setReactedReactions(readStoredReactions(photoId))
  }, [photoId])

  const applyDelta = useCallback(
    (reaction: Reaction, delta: number) => {
      mutate(
        (current) => {
          if (!current) {
            const next = Math.max(0, delta)
            return {
              data: {
                reactions: next > 0 ? { [reaction]: next } : {},
              },
            }
          }

          return produce(current, (draft) => {
            const next = Math.max(0, (draft.data.reactions[reaction] || 0) + delta)
            if (next === 0) {
              delete draft.data.reactions[reaction]
              return
            }
            draft.data.reactions[reaction] = next
          })
        },
        { revalidate: false },
      )
    },
    [mutate],
  )

  const toggleReaction = useCallback(
    async (reaction: Reaction) => {
      if (pendingReactions.has(reaction)) {
        return
      }

      const isActive = reactedReactions.has(reaction)
      const action = isActive ? 'remove' : 'add'
      const delta = isActive ? -1 : 1
      const previousReactions = new Set(reactedReactions)
      const nextReactions = new Set(reactedReactions)

      if (isActive) {
        nextReactions.delete(reaction)
      } else {
        nextReactions.add(reaction)
      }

      setPendingReactions((prev) => {
        const next = new Set(prev)
        next.add(reaction)
        return next
      })
      setReactedReactions(nextReactions)
      writeStoredReactions(photoId, nextReactions)

      applyDelta(reaction, delta)

      try {
        await client.actReaction({
          action,
          refKey: photoId,
          reaction,
        })
        await mutate()
        toast.success(t(action === 'remove' ? 'photo.reaction.removed' : 'photo.reaction.success'))
      } catch (error) {
        console.error('Failed to send reaction', error)
        const message = error instanceof Error ? error.message : 'Failed to send reaction'
        toast.error(String(message))
        setReactedReactions(previousReactions)
        writeStoredReactions(photoId, previousReactions)
        applyDelta(reaction, -delta)
      } finally {
        setPendingReactions((prev) => {
          const next = new Set(prev)
          next.delete(reaction)
          return next
        })
      }
    },
    [applyDelta, mutate, pendingReactions, photoId, reactedReactions, t],
  )

  return (
    <div className={clsxm(styles.root(), className)} style={style}>
      <div className="group/rail relative flex w-full justify-center">
        <div className={styles.track()}>
          {reactions.map((reaction) => {
            const count = data?.data.reactions[reaction]
            const isPending = pendingReactions.has(reaction)
            const isActive = reactedReactions.has(reaction)

            return (
              <button
                key={reaction}
                type="button"
                className={styles.item()}
                data-active={isActive}
                data-pending={isPending}
                disabled={disabled || isPending}
                onClick={() => void toggleReaction(reaction)}
                aria-label={`React with ${reaction}`}
              >
                <FluentEmoji cdn="aliyun" emoji={getEmoji(reaction)!} size={24} type="anim" />
                {typeof count === 'number' && count > 0 && <span className={styles.count()}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
