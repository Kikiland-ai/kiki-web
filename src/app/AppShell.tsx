import { NavLink, Outlet } from 'react-router'
import { FixtureBanner } from '../ui'
import { HomeIcon, LabIcon, LearnIcon, LibraryIcon, ProfileIcon } from '../ui/icons'
import { DEMO_PLAN_ID } from '../features/learning/routes'
import styles from './AppShell.module.css'

const tabs = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: `/chapters/${DEMO_PLAN_ID}`, label: 'Learn', Icon: LearnIcon },
  { to: '/library', label: 'Library', Icon: LibraryIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

/**
 * Responsive shell: navigation rail on laptop (>= 1024px), four-tab bottom
 * navigation below that. Lab mode stays top-right on every size.
 */
export function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.banner}>
        <FixtureBanner />
      </div>
      <header className={styles.header}>
        <NavLink to="/home" className={styles.brand}>
          <img src="/kiki-dots.svg" alt="" width={28} height={28} />
          <span>Kiki</span>
        </NavLink>
        <NavLink
          to="/labs"
          className={({ isActive }) => `${styles.labMode} ${isActive ? styles.active : ''}`}
          aria-label="Lab mode"
          title="Lab mode"
        >
          <LabIcon />
        </NavLink>
      </header>

      <nav className={styles.nav} aria-label="Main">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
