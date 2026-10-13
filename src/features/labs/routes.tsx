import type { RouteObject } from 'react-router'
import { PlaceholderScreen } from '../placeholders/PlaceholderScreen'

/** Lab routes (owner: Arpan). Registered centrally in app/routes.tsx. */
export const labRoutes: RouteObject[] = [
  {
    path: 'labs',
    element: <PlaceholderScreen title="Lab mode" owner="Arpan" note="DSB-SC experiment: choose or resume." />,
  },
  {
    path: 'labs/:sessionId',
    element: <PlaceholderScreen title="DSB-SC lab" owner="Arpan" note="Tracker with 12 checkpoints." />,
  },
]
