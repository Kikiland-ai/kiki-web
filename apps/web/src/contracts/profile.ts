import { z } from 'zod';

export const DialSchema = z.number().int().min(1).max(5);
export const ProfileSchema = z.object({
  schema: z.literal('profile/v1'),
  id: z.string().min(1), displayName: z.string().min(1).max(120),
  supportLanguage: z.enum(['or', 'en']), dialLevel: DialSchema,
  onboarding: z.object({
    step: z.number().int().min(0).max(3), completedAt: z.string().datetime().nullable(),
    fluencySelfRatings: z.object({
      support: z.object({ language: z.enum(['or', 'en']), outOf10: z.number().int().min(1).max(10) }),
      englishOutOf10: z.number().int().min(1).max(10), assessedBy: z.literal('self'),
    }).nullable(),
    easyLanguageAnswer: z.enum(['regional', 'mixed', 'english']).nullable(),
  }),
  courseIds: z.array(z.string()),
}).superRefine((profile, context) => {
  const onboarding = profile.onboarding;
  if (onboarding.completedAt && (onboarding.step !== 3 || !onboarding.fluencySelfRatings || !onboarding.easyLanguageAnswer)) {
    context.addIssue({ code: 'custom', message: 'Completed onboarding requires confirmed preferences and ratings.', path: ['onboarding'] });
  }
  if (onboarding.fluencySelfRatings && onboarding.fluencySelfRatings.support.language !== profile.supportLanguage) {
    context.addIssue({ code: 'custom', message: 'Rating language must match the learning language.', path: ['onboarding', 'fluencySelfRatings'] });
  }
});
export type Profile = z.infer<typeof ProfileSchema>;
export type DialLevel = z.infer<typeof DialSchema>;
export type ProfileUpdate = Pick<Profile, 'supportLanguage' | 'dialLevel' | 'onboarding'>;
export const ProfileEnvelopeSchema = z.object({ profile: ProfileSchema });
export const COURSE = { id: 'CRS-AC-ECE', name: 'Analog Communication', chapterId: 'LP-ANALOG-MODULATION', chapter: 'Analog Modulation', branch: 'ECE' } as const;
export const DIAL_LABELS = ['Odia with English terms', 'Mostly Odia', 'Odia and English equally', 'Mostly English', 'English with Odia help'] as const;

export function suggestedDial(answer: 'regional' | 'mixed' | 'english'): DialLevel {
  return { regional: 2, mixed: 3, english: 4 }[answer];
}

export function onboardingComplete(profile: Profile): boolean {
  return profile.onboarding.step === 3 && profile.onboarding.completedAt !== null && profile.onboarding.fluencySelfRatings !== null && profile.onboarding.easyLanguageAnswer !== null;
}
