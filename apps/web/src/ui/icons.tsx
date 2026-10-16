import type { ReactNode } from 'react';
// Local vectors keep controls readable and correctly sized while web fonts are unavailable.
const paths: Record<string, ReactNode> = {
  arrow_forward: <path d="M4 12h16m-6-6 6 6-6 6" />,
  arrow_back: <path d="M20 12H4m6-6-6 6 6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  check_circle: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  add: <path d="M12 4v16M4 12h16" />,
  remove: <path d="M4 12h16" />,
  pause: <path d="M8 5v14M16 5v14" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  refresh: <path d="M20 6v5h-5M20 11a8 8 0 1 0-2 7" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  folder_open: <path d="M3 19V5h6l2 3h10v3M3 19l3-8h16l-3 8Z" />,
  auto_stories: <><path d="M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15" /></>,
  science: <><path d="M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10" /></>,
  open_in_new: <><path d="M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7" /></>,
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />,
  upload_file: <><path d="M14 2H4v20h16V8Zm0 0v6h6M12 18v-7m-3 3 3-3 3 3" /></>,
  visibility: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  quiz: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3M12 18h.01" /></>,
  logout: <path d="M9 3H3v18h6M9 12h12m-5-5 5 5-5 5" />,
  tune: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6M16 9v6M10 15v6" /></>,
  account_tree: <><rect x="9" y="2" width="6" height="5" /><rect x="2" y="17" width="6" height="5" /><rect x="16" y="17" width="6" height="5" /><path d="M12 7v5H5v5m7-5h7v5" /></>,
  translate: <><path d="M2 5h11M7 2v3m3 0c-1 5-3 8-7 10m1-7c1 3 4 6 7 7M13 21l4-10 4 10m-6-4h4" /></>,
  language: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
};
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`material-symbols-rounded ${className}`} aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">{paths[name] ?? paths.info}</svg>;
}
