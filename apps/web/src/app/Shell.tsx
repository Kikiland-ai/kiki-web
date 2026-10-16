import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Icon, Wordmark } from '../ui/kit';
import { useSession } from './Session';

const tabs = [{ to: '/home', name: 'Home', icon: 'home' }, { to: '/learn', name: 'Learn', icon: 'auto_stories' }, { to: '/library', name: 'Library', icon: 'folder_open' }, { to: '/profile', name: 'Profile', icon: 'person' }];
export function ModeNotice() { const { services } = useSession(); return services.mode === 'fixture' ? <div className="mode-notice" role="status"><span className="mode-dot" />Sample preview <span>· Saved in this browser only</span></div> : null; }
export function Shell() {
  const { profile } = useSession();
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.focus(); }, [location.pathname]);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a><header className="app-header"><Link to="/home" aria-label="Kiki home"><Wordmark /></Link><div className="header-actions"><span className="language-tag">{profile?.supportLanguage === 'or' ? 'Odia + English terms' : 'English + Odia help'}</span><Link to="/labs" className="lab-entry"><Icon name="science" /><span>Lab mode</span></Link></div></header><ModeNotice /><aside className="nav-rail"><nav aria-label="Main navigation">{tabs.map(tab => <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon name={tab.icon} /><span>{tab.name}</span></NavLink>)}</nav><div className="rail-note"><span className="tiny-dots"><i /><i /><i /><i /></span><p>A little clearer.<br />One concept at a time.</p></div></aside><main id="main-content" className="main-content" tabIndex={-1} ref={main}><Outlet /></main></div>;
}
