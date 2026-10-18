import { COURSE, ProfileSchema, type Profile } from '../contracts/profile';
import { ServiceError, type Services, type Identity } from '../services/types';
import { withResourceCleanup } from '../services/resource-cleanup';
import { createFixtureIntake } from './intake';
import { createFixtureAssessments } from './assessments';
import { createFixtureLabPreparation } from './lab-preparation';
import { createFixtureLearning } from './learning';
import { createFixtureMedia } from './media';

const SESSION = 'kiki:fixture:session:v1';
const PROFILE = 'kiki:fixture:profile:v1';
const identity: Identity = { uid: 'fixture-bikash', displayName: 'Aditya' };
export function createFixtureServices(): Services {
  const listeners = new Set<(user: Identity | null) => void>();
  const current = () => sessionStorage.getItem(SESSION) === identity.uid ? identity : null;
  function readProfile(): Profile {
    if (!current()) throw new ServiceError('Open the sample student to continue.', 401);
    const raw = localStorage.getItem(PROFILE);
    if (raw) {
      try { const p = ProfileSchema.parse(JSON.parse(raw)); if (p.id === identity.uid) return { ...p, displayName: identity.displayName, studyField: p.studyField ?? 'ECE' }; } catch { /* Keep corrupt data untouched; surface a recoverable failure. */ }
      throw new ServiceError('The sample profile could not be read. Clear this preview’s site data to start again.');
    }
    return { schema: 'profile/v1', id: identity.uid, displayName: identity.displayName, supportLanguage: 'or', studyField: 'ECE', dialLevel: 2, courseIds: [], onboarding: { step: 0, completedAt: null, fluencySelfRatings: null, easyLanguageAnswer: null } };
  }
  function save(profile: Profile) {
    const valid = ProfileSchema.parse(profile);
    localStorage.setItem(PROFILE, JSON.stringify(valid));
    return valid;
  }
  const requireUid = () => { const user = current(); if (!user) throw new ServiceError('Sign in to continue.', 401); return user.uid; };
  const assessments = createFixtureAssessments(requireUid);
  const learning = createFixtureLearning(requireUid, assessments);
  return { labPreparation:createFixtureLabPreparation(requireUid,learning), mode: 'fixture', learning, media: createFixtureMedia(requireUid), intake: createFixtureIntake(requireUid), assessments, auth: withResourceCleanup({
    subscribe: (listener) => { listeners.add(listener); queueMicrotask(() => { if (listeners.has(listener)) listener(current()); }); return () => { listeners.delete(listener); }; },
    signIn: async () => { sessionStorage.setItem(SESSION, identity.uid); listeners.forEach(l => l(identity)); },
    signOut: async () => { sessionStorage.removeItem(SESSION); listeners.forEach(l => l(null)); },
    getIdToken: async () => { throw new ServiceError('Sample preview never issues Google credentials.'); },
  }), api: {
    bootstrap: async () => save(readProfile()),
    getProfile: async () => readProfile(),
    updateProfile: async update => save({ ...readProfile(), ...update }),
    enroll: async (courseId, semester) => {
      if (courseId !== COURSE.id || !Number.isInteger(semester) || semester < 1 || semester > 8) throw new ServiceError('Choose the supported subject and a semester from 1 to 8.');
      const profile = readProfile();
      return save({ ...profile, courseIds: [...new Set([...profile.courseIds, courseId])] });
    },
  } };
}
