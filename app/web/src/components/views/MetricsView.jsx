import { useEffect, useRef } from 'react'

export default function MetricsView({ theme }) {
  const iframeRef = useRef(null)

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
      style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}
    >
      <iframe
        ref={iframeRef}
        title="Metrics Command Deck"
        src={`/metrics/?theme=${theme || 'system'}`}
        style={{ flex: '1 1 auto', width: '100%', height: 'calc(100vh - 12px)', border: 'none' }}
      />
    </section>
  )
}
