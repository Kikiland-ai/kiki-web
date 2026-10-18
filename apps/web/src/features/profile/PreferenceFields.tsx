import { LEARNING_LANGUAGES, STUDY_FIELDS, languageName, languageValue, fieldName, fieldValue } from '../../contracts/learning-preferences';
export function LanguagePreference({ value, onChange, id = 'learning-language' }: { value: string; onChange(value: string): void; id?: string }) {
  return <div className="preference-field"><label htmlFor={id}>Learning language</label><input id={id} list={`${id}-options`} value={languageName(value)} required maxLength={80} autoComplete="off" onChange={e => onChange(languageValue(e.target.value))} /><datalist id={`${id}-options`}>{LEARNING_LANGUAGES.map(([code, name]) => <option key={code} value={name} />)}</datalist><small>Choose a language or enter your own.</small></div>;
}
export function StudyFieldPreference({ value, onChange, id = 'study-field' }: { value: string; onChange(value: string): void; id?: string }) {
  return <div className="preference-field"><label htmlFor={id}>Field of study / branch</label><input id={id} list={`${id}-options`} value={fieldName(value)} required maxLength={120} autoComplete="off" onChange={e => onChange(fieldValue(e.target.value))} /><datalist id={`${id}-options`}>{STUDY_FIELDS.map(([code, name]) => <option key={code} value={name} />)}</datalist><small>{STUDY_FIELDS.some(([code]) => code === value) ? `${value} · ${fieldName(value)}` : 'Choose your field or enter your course or branch.'}</small></div>;
}
