// Inline 24px line icons. Decorative unless a label is passed by the caller.
type IconProps = { size?: number }

function Svg({ size = 24, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
  </Svg>
)

export const LearnIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </Svg>
)

export const LibraryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h4v16H4zM10 4h4v16h-4z" />
    <path d="m16.5 4.5 3.8-1 3.2 15.6-3.8.9z" />
  </Svg>
)

export const ProfileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
)

/** Lab mode: an oscilloscope screen with a waveform. */
export const LabIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="19" height="14" rx="2" />
    <path d="M5 11c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0" />
    <path d="M8 21h8" />
  </Svg>
)
