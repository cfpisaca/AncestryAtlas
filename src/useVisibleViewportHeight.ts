import { useEffect, useState } from 'react'

// iOS Safari never fires a `resize` event on `window` when the on-screen
// keyboard opens or closes — it leaves `window.innerHeight` (and therefore
// any `100vh` layout) untouched and just shrinks `visualViewport` instead.
// A page built on `100vh` ends up rendering its bottom portion right
// underneath where the keyboard now sits rather than actually giving that
// space back. Tracking `visualViewport.height` directly is what lets layout
// shrink to the space that's still visible, instead of continuing to fill
// (and hide) the space the keyboard just covered.
//
// Separately, focusing an input near the keyboard also makes iOS *pan* the
// visual viewport — `visualViewport.offsetTop` goes non-zero — to keep the
// input clear of it, without actually scrolling the document (`body` has
// `overflow: hidden` specifically to prevent that kind of scroll).
// `position: fixed` elements are pinned to the layout viewport, not the
// panned visual viewport, so once this pan happens they end up positioned
// above the area that's actually visible — this is why the sidebar's fixed
// top bar was disappearing after a few guesses (each refocus nudges the pan
// further). This exposes the live offset as a CSS custom property so
// index.css can pull that fixed chrome back down to wherever the visible
// area actually starts.
export function useVisibleViewportHeight(): string {
  const [height, setHeight] = useState(() =>
    typeof window !== 'undefined' && window.visualViewport ? `${window.visualViewport.height}px` : '100vh',
  )

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => {
      setHeight(`${viewport.height}px`)
      root.style.setProperty('--visual-viewport-offset-top', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--visual-viewport-offset-top')
    }
  }, [])

  return height
}
