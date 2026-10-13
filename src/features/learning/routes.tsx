import type { RouteObject } from 'react-router'
import { PlaceholderScreen } from '../placeholders/PlaceholderScreen'

/** The demo chapter: Analog Communication → Analog Modulation. */
export const DEMO_PLAN_ID = 'LP-ANALOG-MODULATION'

/** Learning routes (owner: Arpan). Registered centrally in app/routes.tsx. */
export const learningRoutes: RouteObject[] = [
  {
    path: 'chapters/:planId',
    element: <PlaceholderScreen title="Analog Modulation" owner="Arpan" note="Ten-concept chapter map." />,
  },
  {
    path: 'concepts/:conceptId',
    element: <PlaceholderScreen title="Concept" owner="Arpan" note="Definition → Concept → Application → Recap." />,
  },
]
