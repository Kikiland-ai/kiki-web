/** Account preferences are independent of the currently authored teaching package. */
import type { Profile } from './profile';
export const LEARNING_LANGUAGES = [
  ['as', 'Assamese'], ['bn', 'Bengali'], ['brx', 'Bodo'], ['doi', 'Dogri'], ['en', 'English'],
  ['gu', 'Gujarati'], ['hi', 'Hindi'], ['kn', 'Kannada'], ['ks', 'Kashmiri'], ['kok', 'Konkani'],
  ['mai', 'Maithili'], ['ml', 'Malayalam'], ['mni', 'Manipuri'], ['mr', 'Marathi'], ['ne', 'Nepali'],
  ['or', 'Odia'], ['pa', 'Punjabi'], ['sa', 'Sanskrit'], ['sat', 'Santali'], ['sd', 'Sindhi'],
  ['ta', 'Tamil'], ['te', 'Telugu'], ['ur', 'Urdu'],
] as const;
export const STUDY_FIELDS = [
  ['ECE', 'Electronics and Communication Engineering (ECE)'], ['CSE', 'Computer Science and Engineering (CSE)'],
  ['EE', 'Electrical Engineering'], ['ME', 'Mechanical Engineering'], ['CE', 'Civil Engineering'],
  ['medicine', 'Medicine and Health Sciences'], ['science', 'Science'], ['commerce', 'Commerce and Business'],
  ['arts', 'Arts and Humanities'], ['law', 'Law'], ['education', 'Education'],
] as const;
export const languageName = (value: string) => LEARNING_LANGUAGES.find(([code]) => code === value)?.[1] ?? value;
export const fieldName = (value: string) => STUDY_FIELDS.find(([code]) => code === value)?.[1] ?? value;
export const languageValue = (value: string) => LEARNING_LANGUAGES.find(([code, name]) => [code, name.toLowerCase()].includes(value.trim().toLowerCase()))?.[0] ?? value;
export const fieldValue = (value: string) => STUDY_FIELDS.find(([code, name]) => [code.toLowerCase(), name.toLowerCase()].includes(value.trim().toLowerCase()))?.[0] ?? value;
/** Older enrolled profiles retain their authored ECE path without a record migration. */
export const selectedField = (profile: Pick<Profile, 'studyField' | 'courseIds'>) => profile.studyField ?? (profile.courseIds.includes('CRS-AC-ECE') ? 'ECE' : '');
export const demoPathAvailable = (profile: Profile) => fieldValue(selectedField(profile)) === 'ECE' && ['or', 'en'].includes(profile.supportLanguage);
export function dialLabels(language: string) {
  const name = languageName(language);
  return language === 'en' ? ['English with term meanings', 'English with term help', 'English with extra explanations', 'Mostly independent English', 'English with minimal help']
    : [`${name} with English terms`, `Mostly ${name}`, `${name} and English equally`, 'Mostly English', `English with ${name} help`];
}
