import type { RouteObject } from 'react-router'
import { ChapterMapScreen } from './ChapterMapScreen'
import { LessonScreen } from './LessonScreen'

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
    element: <LessonScreen />,
  },
]
