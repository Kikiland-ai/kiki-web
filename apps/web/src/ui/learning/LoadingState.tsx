import { Kiki } from './Kiki'
import styles from './LoadingState.module.css'

export type LoadingStateProps = {
  /** What is loading, as a plain sentence: "Loading your chapter…" */
  message: string
}

/** Kiki thinking beside a short message, announced politely to screen readers. */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className={styles.loading} role="status">
      <Kiki state="thinking" size={48} label="" />
      <p className={styles.message}>{message}</p>
    </div>
  )
}
