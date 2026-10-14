import type { RouteObject } from 'react-router'
import { LabHomeScreen } from './LabHomeScreen'
import { LabTrackerScreen } from './LabTrackerScreen'

/** Lab routes (owner: Arpan). Registered centrally in app/routes.tsx. */
export const labRoutes: RouteObject[] = [
  { path: 'labs', element: <LabHomeScreen /> },
  { path: 'labs/:sessionId', element: <LabTrackerScreen /> },
]
