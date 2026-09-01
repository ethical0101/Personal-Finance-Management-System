import { useEffect, useRef, useState } from 'react'

export default function MetricsView({ theme }) {
  const iframeRef = useRef(null)
  const [loading, setLoading] = useState(true)

  // Keep the embedded dashboard's theme in sync with the app's, even while
  // the tab is already open (the iframe reads ?theme= once on load, this
  // covers a live toggle without a full reload).
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (win) win.postMessage({ type: 'wealthline-theme', theme: theme || null }, window.location.origin)
  }, [theme])

  return (
    <section
      className="view active"
      style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Loading Metrics Command Deck…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Metrics Command Deck"
        src={`/metrics/?theme=${theme || 'system'}`}
        onLoad={() => setLoading(false)}
        style={{ flex: '1 1 auto', width: '100%', height: 'calc(100vh - 12px)', border: 'none', opacity: loading ? 0 : 1, transition: 'opacity .15s ease' }}
      />
    </section>
  )
}
