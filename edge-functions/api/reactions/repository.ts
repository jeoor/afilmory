import { getStore } from '@edgeone/pages-blob'

type StoredValue = object | string | null

export type ReactionCounts = Record<string, number>

const MAX_REF_KEY_BYTES = 256
const MAX_REACTION_BYTES = 64
const textEncoder = new TextEncoder()
let reactionStore: ReturnType<typeof getStore> | null = null

function getReactionStore() {
  reactionStore ??= getStore('afilmory')
  return reactionStore
}

function normalizeCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) {
    return 0
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(count))
}

export function parseReactions(raw: StoredValue): ReactionCounts {
  if (!raw) {
    return {}
  }

  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const wrapped = (parsed as Record<string, unknown>).reactions
    const candidate = wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) ? wrapped : parsed
    const reactions: ReactionCounts = Object.create(null) as ReactionCounts

    for (const [name, value] of Object.entries(candidate)) {
      if (!isValidReaction(name)) {
        continue
      }
      const count = normalizeCount(value)
      if (count > 0) {
        reactions[name] = count
      }
    }

    return reactions
  }
  catch {
    return {}
  }
}

function hasValidByteLength(value: string, maximum: number): boolean {
  const length = textEncoder.encode(value).length
  return length > 0 && length <= maximum
}

export function isValidRefKey(value: string): boolean {
  return hasValidByteLength(value, MAX_REF_KEY_BYTES)
}

export function isValidReaction(value: string): boolean {
  return (
    value !== '__proto__'
    && value !== 'constructor'
    && value !== 'prototype'
    && hasValidByteLength(value, MAX_REACTION_BYTES)
  )
}

export function applyReaction(reactions: ReactionCounts, reaction: string, action: 'add' | 'remove'): ReactionCounts {
  const nextReactions: ReactionCounts = Object.assign(Object.create(null) as ReactionCounts, reactions)
  const delta = action === 'remove' ? -1 : 1
  const next = Math.max(0, normalizeCount(nextReactions[reaction]) + delta)

  if (next > 0) {
    nextReactions[reaction] = next
  }
  else {
    delete nextReactions[reaction]
  }

  return nextReactions
}

export function getReactionStorageKey(refKey: string): string {
  return `reactions/${encodeURIComponent(refKey)}.json`
}

export async function getReactions(refKey: string): Promise<ReactionCounts> {
  const store = getReactionStore()
  const value = await store.get(getReactionStorageKey(refKey), {
    type: 'json',
    consistency: 'strong',
  })
  return value === null ? {} : parseReactions(value as StoredValue)
}

export async function setReactions(refKey: string, reactions: ReactionCounts): Promise<void> {
  const store = getReactionStore()
  await store.setJSON(getReactionStorageKey(refKey), { reactions }, { cacheControl: 'no-store' })
}
