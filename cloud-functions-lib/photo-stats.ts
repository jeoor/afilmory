import type { PhotoKvBinding } from './photo-kv'

export interface PhotoStatsRecord {
  reactions: Record<string, number>
}

const STATS_KEY_PREFIX = 'stats_'

function normalizeCount(value: unknown) {
  return Math.max(0, Number(value) || 0)
}

function normalizeReactions(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .map(([name, count]): [string, number] => [name, normalizeCount(count)])
      .filter(([, count]) => count > 0),
  )
}

function parseStats(raw: string | object | null | undefined): PhotoStatsRecord | null {
  if (!raw) {
    return null
  }

  try {
    const parsed =
      typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    const candidate =
      parsed && typeof parsed.reactions === 'object' && parsed.reactions
        ? (parsed.reactions as Record<string, unknown>)
        : parsed

    return {
      reactions: normalizeReactions(candidate),
    }
  } catch {
    return null
  }
}

export function emptyPhotoStats(): PhotoStatsRecord {
  return {
    reactions: {},
  }
}

export async function readPhotoStats(kv: PhotoKvBinding, refKey: string): Promise<PhotoStatsRecord> {
  const statsKey = `${STATS_KEY_PREFIX}${refKey}`
  const statsRaw = await kv.get?.(statsKey)
  const parsedStats = parseStats(statsRaw)
  if (parsedStats) {
    return parsedStats
  }

  return emptyPhotoStats()
}

export async function writePhotoStats(kv: PhotoKvBinding, refKey: string, stats: PhotoStatsRecord) {
  const normalized = JSON.stringify({
    reactions: normalizeReactions(stats.reactions),
  })
  await kv.put?.(`${STATS_KEY_PREFIX}${refKey}`, normalized)
}
