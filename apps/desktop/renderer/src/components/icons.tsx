import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>
const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconCollections = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h12M4 10h16M4 14h16M4 18h12" />
  </svg>
)
export const IconEnv = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)
export const IconHistory = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const IconApis = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7l4-3 4 3 4-3 4 3v10l-4 3-4-3-4 3-4-3z" />
  </svg>
)
export const IconMock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="9" width="18" height="9" rx="2" />
    <path d="M5 9V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
    <path d="M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
)
export const IconMonitor = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 17l5-7 4 5 3-3 6 7" />
    <circle cx="8" cy="10" r="1.5" />
  </svg>
)
export const IconFlow = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="15" y="3" width="6" height="6" rx="1.5" />
    <rect x="9" y="15" width="6" height="6" rx="1.5" />
    <path d="M6 9v3a2 2 0 0 0 2 2h4M18 9v3a2 2 0 0 1-2 2h-4" />
  </svg>
)
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
  </svg>
)

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconFilter = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 5h18l-7 9v6l-4-2v-4z" />
  </svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconChevDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconChevRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const IconFolder = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconSend = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M22 2 11 13" />
    <path d="m22 2-7 20-4-9-9-4z" />
  </svg>
)
export const IconSave = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M7 3v6h9V3M7 21v-7h10v7" />
  </svg>
)
export const IconCode = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16" />
  </svg>
)
export const IconEdit = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20h4l11-11-4-4L4 16z" />
  </svg>
)
export const IconEye = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)
export const IconMore = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18" cy="12" r="1.2" fill="currentColor" />
  </svg>
)
export const IconConsole = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m7 9 3 3-3 3M13 15h5" />
  </svg>
)
export const IconRunner = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8 6 4-6 4z" fill="currentColor" stroke="none" />
  </svg>
)
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
)
export const IconGlobe = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18" />
  </svg>
)
export const IconSparkles = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
)
export const IconWorkspace = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)
export const IconImport = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 21h16" />
  </svg>
)
export const IconExport = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21V9" />
    <path d="m7 14 5-5 5 5" />
    <path d="M4 3h16" />
  </svg>
)
export const IconFolderPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 11v6M9 14h6" />
  </svg>
)
export const IconFilePlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M12 12v6M9 15h6" />
  </svg>
)
export const IconCopy = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)
export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)
export const IconKey = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="14" r="4" />
    <path d="m11 11 9-9" />
    <path d="m17 5 3 3M15 7l3 3" />
  </svg>
)
