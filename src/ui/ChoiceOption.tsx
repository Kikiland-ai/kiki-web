import type { ComponentPropsWithRef, ReactNode } from 'react'
import { CheckIcon } from './icons'
import styles from './ChoiceOption.module.css'

export type ChoiceState = 'idle' | 'correct' | 'not_yet'

export type ChoiceOptionProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'checked' | 'children'> & {
  /** Whether the student picked this option. */
  selected: boolean
  /** After checking: correct shows a tick and "Correct"; not_yet a dashed outline and "Not yet". */
  state?: ChoiceState
  children: ReactNode
}

/**
 * One quiz answer. Wraps a native radio, so options sharing a `name` inside a
 * `ChoiceGroup` form a radio group: one Tab stop, arrow keys move and select.
 * Pass `name`, `value`, `onChange` and `disabled` as on any radio input.
 */
export function ChoiceOption({ selected, state = 'idle', children, className, ...inputProps }: ChoiceOptionProps) {
  const classes = [styles.option, selected && styles.selected, state !== 'idle' && styles[state], className]
    .filter(Boolean)
    .join(' ')
  return (
    <label className={classes}>
      <input type="radio" className={styles.input} checked={selected} {...inputProps} />
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
      {state === 'correct' && (
        <span className={styles.result}>
          <CheckIcon size={20} />
          Correct
        </span>
      )}
      {state === 'not_yet' && <span className={styles.result}>Not yet</span>}
    </label>
  )
}

export type ChoiceGroupProps = Omit<ComponentPropsWithRef<'fieldset'>, 'children'> & {
  /** The question, read out when the group is entered. */
  label: ReactNode
  children: ReactNode
}

/** A radio group for `ChoiceOption`s: a fieldset whose legend is the question. */
export function ChoiceGroup({ label, children, className, ...rest }: ChoiceGroupProps) {
  return (
    <fieldset className={[styles.group, className].filter(Boolean).join(' ')} {...rest}>
      <legend className={styles.legend}>{label}</legend>
      {children}
    </fieldset>
  )
}
