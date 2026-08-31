export default function MetricsView() {
  return (
    <section
      className="view active"
      style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}
    >
      <iframe
        title="Metrics Command Deck"
        src="/metrics/"
        style={{ flex: '1 1 auto', width: '100%', height: 'calc(100vh - 12px)', border: 'none' }}
      />
    </section>
  )
}
