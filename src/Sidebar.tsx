import type { ReactNode } from 'react'

// A fixed column next to the globe, not an overlay on top of it — every
// control (picker, HUD, progress list) lives here instead of floating
// absolutely-positioned boxes across the map, so nothing ever competes with
// the globe for screen space.
export default function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside
      style={{
        width: 'clamp(260px, 26vw, 340px)',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'rgba(10, 19, 18, 0.92)',
        borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#e3ece9',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      {children}
    </aside>
  )
}
