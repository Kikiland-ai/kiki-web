/**
 * App mode. "fixture" uses labelled synthetic data behind the service
 * interfaces; "local" and "live" talk to the Python API and Firebase.
 * Fixture output must always be labelled on screen.
 */
export type AppMode = 'fixture' | 'local' | 'live'

const raw = import.meta.env.VITE_APP_MODE as string | undefined

export const appMode: AppMode = raw === 'local' || raw === 'live' ? raw : 'fixture'

export const isFixtureMode = appMode === 'fixture'
