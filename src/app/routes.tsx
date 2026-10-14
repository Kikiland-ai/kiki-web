import type { RouteObject } from 'react-router'
import { AppShell } from './AppShell'
import { NotFoundScreen } from './NotFoundScreen'
import { learningRoutes } from '../features/learning/routes'
import { labRoutes } from '../features/labs/routes'
import { placeholderRoutes } from '../features/placeholders/routes'
import { kitRoutes } from '../features/kit/routes'

/**
 * Central route registration (owner: Akshita). Feature owners export their
 * route definitions; this file only registers them under the shell.
 * Route names follow the UI implementation plan, section 2.
 */
export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      ...placeholderRoutes,
      ...learningRoutes,
      ...labRoutes,
      // Dev-only component gallery; dropped from production builds
      ...(import.meta.env.DEV ? kitRoutes : []),
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]
