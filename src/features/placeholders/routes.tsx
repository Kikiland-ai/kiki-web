import { Navigate, type RouteObject } from 'react-router'
import { PlaceholderScreen } from './PlaceholderScreen'

/**
 * Akshita's routes, stubbed so the shell and navigation work end to end.
 * Replace each entry with the real feature's exported routes.
 */
export const placeholderRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/home" replace /> },
  { path: 'auth', element: <PlaceholderScreen title="Sign in with Google" owner="Akshita" /> },
  { path: 'onboarding', element: <PlaceholderScreen title="Onboarding" owner="Akshita" /> },
  { path: 'home', element: <PlaceholderScreen title="Home" owner="Akshita" /> },
  { path: 'library', element: <PlaceholderScreen title="Library" owner="Akshita" /> },
  { path: 'profile', element: <PlaceholderScreen title="Profile" owner="Akshita" /> },
  {
    path: 'assessments/:assessmentId/:runId',
    element: <PlaceholderScreen title="Quiz" owner="Akshita" note="Concept check (3/5) and chapter test (8/10)." />,
  },
]
