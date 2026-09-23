interface GlobeStatusProps {
  isLoading: boolean
  loadError: string | null
  retry: () => void
}

// Sits centered over the globe while country data is loading or failed to
// load, so a slow/failed fetch reads as "loading" or "broken, here's a
// retry button" instead of an unexplained blank dark sphere forever.
export default function GlobeStatus({ isLoading, loadError, retry }: GlobeStatusProps) {
  if (!isLoading && !loadError) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        padding: '16px 20px',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        background: 'rgba(10, 19, 18, 0.9)',
        color: '#e3ece9',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        textAlign: 'center',
      }}
    >
      {loadError ? (
        <>
          <div style={{ marginBottom: 10 }}>{loadError}</div>
          <button
            type="button"
            onClick={retry}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#4ade80',
              color: '#0a1312',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </>
      ) : (
        'Loading world data…'
      )}
    </div>
  )
}
