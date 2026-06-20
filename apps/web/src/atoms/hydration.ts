import { atom } from 'jotai'

import { jotaiStore } from '~/lib/jotai'

// Flips after the initial load settles so direct photo loads skip their entry
// animation while later in-app navigations keep the transition.
export const hydrationEndAtom = atom(false)

export const isHydrationEnded = () => jotaiStore.get(hydrationEndAtom)
