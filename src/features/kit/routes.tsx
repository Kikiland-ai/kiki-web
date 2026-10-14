import type { RouteObject } from 'react-router'
import { LoadingState } from '../../ui'

/**
 * Dev-only kit gallery (owner: Arpan). app/routes.tsx registers this only
 * when import.meta.env.DEV, so the screen is never part of a production build.
 */
export const kitRoutes: RouteObject[] = [
  {
    path: 'kit',
    lazy: async () => ({ Component: (await import('./KitScreen')).KitScreen }),
    hydrateFallbackElement: <LoadingState message="Loading the kit…" />,
  },
]
