import type { ComponentPropsWithRef, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'text'

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  /** primary: neutral ink key, one per screen. secondary: tonal key. text: no fill. */
  variant?: ButtonVariant
  /** Decorative icon before the label, e.g. `<RetryIcon />`. */
  icon?: ReactNode
}

/**
 * A tactile pill key with a darker bottom edge that presses down 2px.
 * Ported from Breadboard Button; variants follow the team contract (§5).
 * Write the label as the action that happens: "Start lesson".
 */
export function Button({ variant = 'primary', icon, type = 'button', className, children, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}
