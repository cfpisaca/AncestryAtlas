import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// A fixed column next to the globe, not an overlay on top of it — every
// control (picker, HUD, progress list) lives here instead of floating
// absolutely-positioned boxes across the map, so nothing ever competes with
// the globe for screen space. Below 768px (see index.css) there's no room
// for both side by side, so this becomes a closed-by-default slide-out
// drawer instead — the globe is what you see first on a phone.
//
// `persistent` is the one exception: content passed there (WorldQuiz's
// timer + guess input) stays reachable even while the drawer is closed,
// since closing it shouldn't mean you can't keep playing. It's rendered as
// a sibling of <aside>, not a child of it, even though visually it sits
// right on top of the drawer — nesting a `position: fixed` element inside
// another `position: fixed` element that also scrolls (<aside> is both:
// see its own `overflow-y: auto`) is a known trouble spot on iOS Safari,
// where the descendant's fixed positioning can get computed relative to
// that scrolling ancestor instead of the true viewport. It doesn't happen
// every time, which is exactly what made it hard to pin down — sometimes
// the bar would render fine, sometimes it'd end up confined to the
// drawer's own width/position instead of spanning the full screen (visible
// as "the bar disappeared" whenever that coincided with the drawer being
// closed off-screen). Being a plain sibling instead of a nested descendant
// sidesteps the whole class of bug rather than trying to out-guess when it
// triggers.
//
// It's a render prop (not a plain node) so the caller can place the open/
// close toggle wherever makes sense in its own layout (e.g. inline next to
// an input, matching its height) instead of Sidebar bolting it on beside
// whatever content it's given.
export default function Sidebar({
  persistent,
  children,
}: {
  persistent?: (toggle: ReactNode) => ReactNode
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const persistentRef = useRef<HTMLDivElement>(null)
  const toggleStandaloneRef = useRef<HTMLDivElement>(null)
  const [persistentHeight, setPersistentHeight] = useState(0)

  // Belt-and-suspenders on top of the sibling-not-child fix above: this
  // fixed bar sits directly above the globe's continuously-rendering WebGL
  // canvas, which is separately a known spot for iOS Safari's compositor to
  // blank a layer's paint — still fully present and still receiving taps,
  // just not painted. A periodic, imperceptible repaint nudge means even if
  // that happens, it can't stay that way for more than about a second.
  useEffect(() => {
    const nudge = (el: HTMLElement | null) => {
      if (!el) return
      el.style.opacity = '0.999'
      requestAnimationFrame(() => {
        el.style.opacity = '1'
      })
    }
    const interval = setInterval(() => {
      nudge(persistentRef.current)
      nudge(toggleStandaloneRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // The persistent bar is `position: fixed` on mobile, so the scrollable
  // drawer content below it needs matching top padding or its own content
  // renders underneath it. Measuring the real height (rather than guessing
  // a fixed px value) keeps that padding correct as the bar's content
  // changes, e.g. the guess input only appearing once the quiz starts.
  // Deliberately a mount-only effect (`[]`, not `[persistent]`): `persistent`
  // is a render-prop closure that's a new function identity on every parent
  // re-render, and re-creating the observer that often raced its own
  // callback — it kept getting disconnected before delivering an updated
  // reading, leaving `persistentHeight` stuck at whatever size happened to
  // exist on the very first frame. One long-lived observer on the DOM node
  // itself (which is stable) reports every real size change over its life.
  useLayoutEffect(() => {
    const el = persistentRef.current
    if (!el) return
    // Read the element's own border-box height directly rather than
    // `entry.contentRect`, which is content-box only (excludes this
    // element's padding and border) — using that under-measured the bar by
    // exactly its padding + border, so the padding-top compensating for it
    // was too small and content underneath peeked out from behind it.
    const observer = new ResizeObserver(() => setPersistentHeight(el.getBoundingClientRect().height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const toggleButtonEl = (
    <button
      type="button"
      onClick={() => setIsOpen((open) => !open)}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'rgba(255, 255, 255, 0.08)',
        color: '#e3ece9',
        fontSize: 16,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {isOpen ? '✕' : '☰'}
    </button>
  )

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop${isOpen ? ' sidebar-open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-label="Close menu"
      />
      {persistent && (
        <div ref={persistentRef} className="sidebar-persistent" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {persistent(<div className="sidebar-persistent-toggle">{toggleButtonEl}</div>)}
        </div>
      )}
      <aside
        className={`sidebar${isOpen ? ' sidebar-open' : ''}${persistent ? ' sidebar-has-persistent' : ''}`}
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
          ...(persistentHeight > 0
            ? ({ '--sidebar-persistent-height': `${persistentHeight}px` } as React.CSSProperties)
            : {}),
        }}
      >
        {!persistent && !isOpen && (
          <div ref={toggleStandaloneRef} className="sidebar-toggle-standalone">
            {toggleButtonEl}
          </div>
        )}
        {children}
      </aside>
    </>
  )
}
