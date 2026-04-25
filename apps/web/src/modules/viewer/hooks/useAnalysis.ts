import useSWR from 'swr'

import { client } from '~/lib/client'

export const useAnalysis = (refKey: string, enabled = true) => {
  const query = new URLSearchParams({ refKey }).toString()

  return useSWR(enabled && refKey ? `/api/reactions?${query}` : null, () => client.analysis({ refKey }), {
    onError: (error) => {
      console.error('Failed to load reactions', { error, refKey })
    },
    revalidateOnFocus: false,
  })
}
