import { expect, it } from 'vitest';
import { demoPathAvailable, dialLabels, fieldValue, languageName, languageValue, selectedField } from './learning-preferences';
import { ProfileSchema } from './profile';
const profile = () => ProfileSchema.parse({ schema: 'profile/v1', id: 'student', displayName: 'Aditya', supportLanguage: 'or', studyField: 'ECE', dialLevel: 2, courseIds: ['CRS-AC-ECE'], onboarding: { step: 3, completedAt: '2026-10-18T00:00:00Z', fluencySelfRatings: { support: { language: 'or', outOf10: 9 }, englishOutOf10: 3, assessedBy: 'self' }, easyLanguageAnswer: 'regional' } });
it('accepts language and field preferences beyond the demo without inferring content availability', () => {
  const p = profile(); expect(demoPathAvailable(p)).toBe(true);
  p.supportLanguage = 'hi'; p.onboarding.fluencySelfRatings!.support.language = 'hi';
  expect(demoPathAvailable(p)).toBe(false); // language alone changes content availability
  p.studyField = 'CSE';
  expect(ProfileSchema.parse(p).studyField).toBe('CSE'); expect(demoPathAvailable(p)).toBe(false);
  p.supportLanguage = 'Khasi'; p.onboarding.fluencySelfRatings!.support.language = 'Khasi'; p.studyField = 'Environmental Studies';
  expect(ProfileSchema.parse(p).supportLanguage).toBe('Khasi'); expect(demoPathAvailable(p)).toBe(false);
});
it('keeps an enrolled legacy profile on its path and follows explicit field changes', () => {
  const p = profile(); delete p.studyField;
  expect(selectedField(p)).toBe('ECE'); expect(demoPathAvailable(p)).toBe(true);
  p.studyField = 'medicine'; expect(demoPathAvailable(p)).toBe(false); expect(p.courseIds).toEqual(['CRS-AC-ECE']);
});
it('maps labels to stable preference values and derives support copy from the chosen language', () => {
  expect(languageValue('Hindi')).toBe('hi'); expect(languageName('or')).toBe('Odia');
  expect(fieldValue('Electronics and Communication Engineering (ECE)')).toBe('ECE');
  expect(languageValue('Khasi')).toBe('Khasi'); expect(dialLabels('ta')[0]).toBe('Tamil with English terms');
  expect(dialLabels('en').join(' ')).not.toContain('Odia');
});
