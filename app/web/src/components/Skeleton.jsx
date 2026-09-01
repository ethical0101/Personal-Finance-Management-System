// Shared loading placeholders. Every view uses these instead of a bare
// "Loading..." string or (worse) silently showing an empty-state message
// while data is still in flight -- so "no data yet" and "not loaded yet"
// never look the same to the user.

export function SkelBar({ w = '100%', h = 14, style }) {
  return <div className="skel" style={{ width: w, height: h, ...style }} />
}

export function SkelKpis({ count = 4 }) {
  return (
    <div className="grid cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card kpi" key={i}>
          <SkelBar w="55%" h={11} />
          <SkelBar w="75%" h={26} style={{ marginTop: 10 }} />
          <SkelBar w="45%" h={11} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  )
}

export function SkelCards({ count = 3, cols = 3 }) {
  return (
    <div className={`grid cols-${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div className="card" key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <SkelBar w="50%" h={14} />
            <SkelBar w={48} h={18} />
          </div>
          <SkelBar w="65%" h={22} />
          <SkelBar w="40%" h={11} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  )
}

export function SkelRows({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <SkelBar w="30%" h={13} />
            <SkelBar w={70} h={16} />
          </div>
          <SkelBar w="100%" h={9} />
        </div>
      ))}
    </>
  )
}

export function SkelTableRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><SkelBar w={j === 0 ? '70%' : '55%'} h={12} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkelList({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <SkelBar w={8} h={8} style={{ borderRadius: '50%', marginTop: 6, flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <SkelBar w="80%" h={13} />
            <SkelBar w="35%" h={10} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </>
  )
}
