import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import type { ButtonVariant } from './Button'
import styles from './Button.module.css'

export type LinkButtonProps = LinkProps & {
  variant?: ButtonVariant
  icon?: ReactNode
}

/**
 * A link that looks like a Button, for actions that go somewhere ("Continue",
 * "Chapter test"). Navigation stays a real link: it opens in a new tab and
 * screen readers announce it as a link.
 */
export function LinkButton({ variant = 'primary', icon, className, children, ...rest }: LinkButtonProps) {
  const classes = [styles.button, styles[variant], styles.link, className].filter(Boolean).join(' ')
  return (
    <Link className={classes} {...rest}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  )
}
