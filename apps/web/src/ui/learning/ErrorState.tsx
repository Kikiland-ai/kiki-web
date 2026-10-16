import { Button } from './Button'
import { AlertIcon, RetryIcon } from './icons'
import styles from './ErrorState.module.css'

export type ErrorStateProps = {
  /** Say what happened and what it means, in a plain sentence. No error codes, no apologies. */
  message: string
  /** Shows a Retry button when given. */
  onRetry?: () => void
}

/** An inline failure message with an optional Retry. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.error} role="alert">
      <span className={styles.icon}>
        <AlertIcon />
      </span>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="secondary" icon={<RetryIcon size={20} />} onClick={onRetry} className={styles.retry}>
          Retry
        </Button>
      )}
    </div>
  )
}
