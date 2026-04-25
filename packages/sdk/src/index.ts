import { z } from 'zod'

export const ReactionDtoSchema = z.object({
  refKey: z.string().min(1),
  reaction: z.string().min(1).max(20),
  action: z.enum(['add', 'remove']).optional(),
})
export type ReactionDto = z.infer<typeof ReactionDtoSchema>

export const AnalysisDtoSchema = z.object({
  refKey: z.string().min(1),
})
export type AnalysisDto = z.infer<typeof AnalysisDtoSchema>

export interface AnalysisResponse {
  data: {
    reactions: Record<string, number>
  }
}

export interface ReactionResponse extends AnalysisResponse {
  ok: boolean
}

const DEFAULT_API_BASE_PATH = '/api'
const EMOJI_VARIATION_SELECTOR = /\uFE0F/g

function normalizeReactionName(name: string) {
  return name.replaceAll(EMOJI_VARIATION_SELECTOR, '').trim()
}

function normalizeReactions(input: Record<string, number>) {
  return Object.entries(input).reduce<Record<string, number>>((acc, [name, count]) => {
    const normalizedName = normalizeReactionName(name)
    const normalizedCount = Math.max(0, Number(count) || 0)

    if (normalizedName && normalizedCount > 0) {
      acc[normalizedName] = (acc[normalizedName] || 0) + normalizedCount
    }

    return acc
  }, {})
}

export class Client {
  constructor(
    private readonly baseUrl: string,
    private readonly apiBasePath = DEFAULT_API_BASE_PATH,
  ) {}

  private buildUrl(path: string, apiBasePath = this.apiBasePath) {
    const normalizedBaseUrl = this.baseUrl.replace(/\/+$/, '')
    const normalizedApiBasePath = `/${apiBasePath.replaceAll(/^\/+|\/+$/g, '')}`
    const normalizedPath = `/${path.replace(/^\/+/, '')}`

    return `${normalizedBaseUrl}${normalizedApiBasePath}${normalizedPath}`
  }

  private async fetchJson<T>(path: string, init: RequestInit, apiBasePath = this.apiBasePath) {
    const response = await fetch(this.buildUrl(path, apiBasePath), init)

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`

      try {
        const error = (await response.json()) as { error?: string; message?: string; stage?: string; version?: string }
        message = [error.error || error.message || message, error.stage, error.version].filter(Boolean).join(' | ')
      } catch {
        // Ignore non-JSON error bodies and fall back to the HTTP status message.
      }

      throw new Error(message)
    }

    try {
      return (await response.json()) as T
    } catch (error) {
      const contentType = response.headers.get('content-type') || 'unknown content-type'
      const message = error instanceof Error ? error.message : 'Invalid JSON response'
      throw new Error(`Failed to parse response (${contentType}): ${message}`)
    }
  }

  async actReaction(data: ReactionDto) {
    return this.fetchJson<ReactionResponse>('/reactions/add', {
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  async analysis(data: AnalysisDto) {
    const query = new URLSearchParams(data).toString()
    const path = `/reactions?${query}`
    const init = {
      method: 'GET',
      cache: 'no-store',
    } satisfies RequestInit

    const result = await this.fetchJson<AnalysisResponse>(path, init)

    return {
      data: {
        reactions: normalizeReactions(result.data?.reactions || {}),
      },
    }
  }
}
