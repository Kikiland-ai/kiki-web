import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Icon, Wordmark } from '../ui/kit';
import { useSession } from './Session';

const tabs = [{ to: '/home', name: 'Home', icon: 'home' }, { to: '/subjects', name: 'Subjects', icon: 'auto_stories' }, { to: '/learn', name: 'Learn', icon: 'auto_stories' }, { to: '/practice', name: 'Checks', icon: 'quiz' }, { to: '/library', name: 'Library', icon: 'folder_open' }];
export function ModeNotice() { const { services } = useSession(); return services.mode === 'fixture' ? <div className="mode-notice" role="status"><span className="mode-dot" />Sample preview <span>· Saved in this browser only</span></div> : null; }
export function Shell() {
  const { profile } = useSession();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [location.pathname]);
  const inLearning = /^\/(learn|chapters|concepts)(\/|$)/.test(location.pathname);
  const inChecks = /^\/(practice|assessments)(\/|$)/.test(location.pathname);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><header className="app-header"><Link to="/home" aria-label="Kiki home" className="brand-link"><Wordmark /><span className="edition-label">THE ENGINEERING<br />SKETCHBOOK</span></Link><div className="header-actions"><span className="language-tag">{profile?.supportLanguage === 'or' ? 'Odia + English terms' : 'English + Odia help'}</span><Link to="/labs" className="lab-entry"><Icon name="science" /><span>Lab mode</span></Link><Link to="/profile" className="profile-link" aria-label="Profile" aria-current={location.pathname === '/profile' ? 'page' : undefined}>{profile?.displayName.slice(0,1).toUpperCase() || <Icon name="person" />}</Link></div></header><ModeNotice /><aside className="nav-rail"><nav aria-label="Main navigation">{tabs.map((tab, i) => {
    const active = tab.to === '/learn' ? inLearning : tab.to === '/practice' ? inChecks : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
    return <Link key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'active' : ''}`}><span className="nav-number" aria-hidden="true">0{i + 1}</span><Icon name={tab.icon} /><span>{tab.name}</span></Link>;
  })}</nav><div className="rail-note"><span className="tiny-dots" aria-hidden="true"><i /><i /><i /><i /></span><p>Read. Question. Try.<br />Make the idea yours.</p></div></aside><main id="main-content" className="main-content" tabIndex={-1} ref={main}><Outlet /></main></div>;
}
