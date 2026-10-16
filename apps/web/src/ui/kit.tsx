import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import dots from '../../../../design-system/project/assets/Kiki/kiki-dots.svg';
import pointer from '../../../../design-system/project/assets/Kiki/kiki-pointer.svg';

export const kikiPointer = pointer;
import { Icon } from './icons';
export { Icon } from './icons';
export function KikiDots({ size = 40 }: { size?: number }) { return <img src={dots} alt="" width={size} height={size} />; }
export function Wordmark({ animate = false }: { animate?: boolean }) {
  const [skip, setSkip] = useState(false);
  return <div className="wordmark-wrap"><span className={`wordmark ${animate && !skip ? 'wordmark-animate' : ''}`} aria-label="Kiki"><span aria-hidden="true" className="wordmark-window"><span className="wordmark-roll"><span>କି</span><span>कि</span><span>கி</span><span>Ki</span></span></span><span aria-hidden="true">ki</span><span className="wordmark-dot" aria-hidden="true" /></span>{animate && !skip && <button className="skip-intro" onClick={() => setSkip(true)}>Skip animation</button>}</div>;
}
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text' }) { return <button className={`button button-${variant} ${className}`} {...props} />; }
export function ActionLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: 'primary' | 'secondary' | 'text' }) { return <Link className={`button button-${variant} ${className}`} {...props} />; }
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`card ${className}`}>{children}</div>; }
export function Alert({ children }: { children: ReactNode }) { return <div role="alert" className="alert"><Icon name="info" /><div>{children}</div></div>; }
export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) { return <div className="page-title">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{children && <p>{children}</p>}</div>; }
export function ProgressSteps({ step, labels }: { step: number; labels: string[] }) { return <ol className="step-list" aria-label="Setup progress">{labels.map((label, i) => <li key={label} aria-current={i === step ? 'step' : undefined} className={i === step ? 'current' : i < step ? 'done' : ''}><span>{i < step ? <Icon name="check" /> : i + 1}</span><span>{label}</span></li>)}</ol>; }
export function Rating({ label, value, onChange, helper }: { label: string; value: number; onChange(value: number): void; helper?: ReactNode }) {
  const id = useId();
  return <div className="rating"><label htmlFor={id}>{label}<strong>{value}<span>/10</span></strong></label><input id={id} type="range" min="1" max="10" step="1" value={value} onChange={e => onChange(Number(e.target.value))} aria-describedby={`${id}-help`} /><div className="range-ends"><span>Need more support</span><span>Very comfortable</span></div><small id={`${id}-help`}>{helper}</small></div>;
}
export function StateScreen({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) { return <main className="state-screen"><KikiDots size={64} /><h1>{title}</h1>{children && <p>{children}</p>}{action}</main>; }
