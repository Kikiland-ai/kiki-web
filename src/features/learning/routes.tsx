import type { RouteObject } from 'react-router'
import { PlaceholderScreen } from '../placeholders/PlaceholderScreen'
import { ChapterMapScreen } from './ChapterMapScreen'

/** The demo chapter: Analog Communication → Analog Modulation. */
export const DEMO_PLAN_ID = 'LP-ANALOG-MODULATION'

/** Learning routes (owner: Arpan). Registered centrally in app/routes.tsx. */
export const learningRoutes: RouteObject[] = [
  {
    path: 'chapters/:planId',
    element: <ChapterMapScreen />,
  },
  {
    path: 'concepts/:conceptId',
    element: <PlaceholderScreen title="Concept" owner="Arpan" note="Definition → Concept → Application → Recap." />,
  },
]
