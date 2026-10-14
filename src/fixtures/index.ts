// Fixture adapters (shared folder: one editor per change, reviewed by the other).
// Labelled sample data behind the contract's service interfaces; screens never import these directly.
export { createFixtureLearningApi, type FixtureOptions } from './learningApi'
export { createFixtureLabApi, HEARTBEAT_SECONDS, LEASE_SECONDS, HANDOFF_MINUTES } from './labApi'
export { fixtureStore, createFixtureStore, recordConceptCheck, seedState } from './store'
export type { ConceptCheckRecord, FixtureStore } from './store'
export { loadFixtureContent, type FixtureContent } from './content'
export { ServiceError } from './errors'
