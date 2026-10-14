import { useState } from 'react'
import type { DialLevel } from '../../contracts'

const KEY = 'kiki.dialLevel'
/** Onboarding's "mostly Odia" suggestion (contract §9), until the profile says otherwise. */
const DEFAULT: DialLevel = 2

function read(): DialLevel {
  try {
    const n = Number(window.localStorage.getItem(KEY))
    return n >= 1 && n <= 5 ? (n as DialLevel) : DEFAULT
  } catch {
    return DEFAULT
  }
}

/**
 * The student's dial notch. Stand-in: kept in this browser until the profile
 * (LearnerApi, Akshita) loads and saves dialLevel. Only the student moves it.
 */
export function useDialLevel(): [DialLevel, (level: DialLevel) => void] {
  const [level, setLevel] = useState<DialLevel>(read)
  return [
    level,
    (next) => {
      setLevel(next)
      try {
        window.localStorage.setItem(KEY, String(next))
      } catch {
        // Still works for this visit
      }
    },
  ]
}
