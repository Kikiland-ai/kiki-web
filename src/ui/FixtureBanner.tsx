import { isFixtureMode } from '../config/mode'
import styles from './FixtureBanner.module.css'

/** Shown whenever screens display synthetic data instead of live evidence. */
export function FixtureBanner() {
  if (!isFixtureMode) return null
  return (
    <div className={styles.banner} role="status">
      Fixture mode: sample data, not a real learner's progress.
    </div>
  )
}
