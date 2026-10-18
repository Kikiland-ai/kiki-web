import type { Services } from './types';
import { createFirebaseAuth } from './firebase';
import { createLearnerApi } from './http';
import { withResourceCleanup } from './resource-cleanup';
import { createIntakeApi } from './intake-http';
import { createLabPreparationApi } from './lab-preparation-http';
import { createLearningApi } from './learning-http';
import { createMediaApi } from './media-http';
import { createLabExecutionApi } from './lab-execution-http';
import { connectionConfig } from './connection-config';

export async function createServices(): Promise<Services> {
  if (import.meta.env.DEV && import.meta.env.VITE_APP_MODE === 'fixture') {
    // This branch and synthetic data are removed from production builds.
    const { createFixtureServices } = await import('../fixtures/services');
    return createFixtureServices();
  }
  const config = connectionConfig(import.meta.env, import.meta.env.DEV);
  const auth = withResourceCleanup(await createFirebaseAuth(config));
  const { createAssessmentApi } = await import('./assessment-http');
  return { mode: 'connected', labExecution:createLabExecutionApi(config.apiBaseUrl,auth), labPreparation:createLabPreparationApi(config.apiBaseUrl,auth), learning: createLearningApi(config.apiBaseUrl, auth), media: createMediaApi(config.apiBaseUrl, auth), auth, api: createLearnerApi(config.apiBaseUrl, auth), intake: createIntakeApi(config.apiBaseUrl, auth), assessments: createAssessmentApi(config.apiBaseUrl, auth) };
}
