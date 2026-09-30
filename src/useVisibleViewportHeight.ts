import { useEffect, useState } from 'react'

// iOS Safari never fires a `resize` event on `window` when the on-screen
// keyboard opens or closes — it leaves `window.innerHeight` (and therefore
// any `100vh` layout) untouched and just shrinks `visualViewport` instead.
// A page built on `100vh` ends up rendering its bottom portion right
// underneath where the keyboard now sits rather than actually giving that
// space back. Tracking `visualViewport.height` directly is what lets layout
// shrink to the space that's still visible, instead of continuing to fill
// (and hide) the space the keyboard just covered.
export function useVisibleViewportHeight(): string {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' && window.visualViewport ? `${window.visualViewport.height}px` : '100vh',
  )

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setHeight(`${viewport.height}px`)
    update()
    viewport.addEventListener('resize', update)
    return () => viewport.removeEventListener('resize', update)
  }, [])

  return height
}
