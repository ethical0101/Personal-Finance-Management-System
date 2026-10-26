// Dependency-free SVG charts. Colours come from CSS tokens so both themes work.
import { money } from '../lib/api.js'

const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)']
export const seriesColor = i => SERIES[i % SERIES.length]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = ym => MONTHS[Number(ym.slice(5, 7)) - 1]

/** Paired income / expense bars for the last N months. */
export function TrendChart({ data }) {
  const W = 560, H = 190, padL = 8, padB = 24, padT = 12
  const max = Math.max(1, ...data.flatMap(d => [d.income, d.expense]))
  const nice = Math.ceil(max / 10000) * 10000 || max
  const innerH = H - padB - padT
  const group = (W - padL) / data.length
  const bw = Math.min(26, group * 0.28)
  const y = v => padT + innerH - (v / nice) * innerH
  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income versus expenses for the last six months">
      {[0, 0.5, 1].map(f => <line key={f} className="grid-line" x1={padL} x2={W} y1={y(nice * f)} y2={y(nice * f)} />)}
      {data.map((d, i) => {
        const cx = padL + group * i + group / 2
        return (
          <g key={d.month}>
            <rect x={cx - bw - 2} y={y(d.income)} width={bw} height={Math.max(2, padT + innerH - y(d.income))} rx="5" fill="var(--good)"><title>{`${monthLabel(d.month)} income ${money(d.income)}`}</title></rect>
            <rect x={cx + 2} y={y(d.expense)} width={bw} height={Math.max(2, padT + innerH - y(d.expense))} rx="5" fill="var(--accent)"><title>{`${monthLabel(d.month)} expenses ${money(d.expense)}`}</title></rect>
            <text x={cx} y={H - 6} textAnchor="middle">{monthLabel(d.month)}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Donut of spend by category with a total in the middle. */
export function Donut({ data, total }) {
  const R = 56, C = 2 * Math.PI * R
  let offset = 0
  const top = data.slice(0, 6)
  const rest = data.slice(6).reduce((s, d) => s + d.total, 0)
  const parts = rest > 0 ? [...top, { categoryName: 'Others', total: rest }] : top
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 140 140" role="img" aria-label="Spending by category">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
          {parts.map((p, i) => {
            const len = (p.total / total) * C
            const el = <circle key={p.categoryName} cx="70" cy="70" r={R} fill="none" stroke={seriesColor(i)} strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`} strokeDashoffset={-offset}><title>{`${p.categoryName} ${money(p.total)}`}</title></circle>
            offset += len
            return el
          })}
        </svg>
        <div className="mid"><div><b>{money(total).replace('.00', '')}</b><span>spent</span></div></div>
      </div>
      <div className="donut-legend">
        {parts.map((p, i) => (
          <div className="it" key={p.categoryName}><i style={{ background: seriesColor(i) }} /><span>{p.categoryName}</span><b>{Math.round((p.total / total) * 100)}%</b></div>
        ))}
      </div>
    </div>
  )
}

/** Circular 0-100 score gauge. */
export function ScoreRing({ score }) {
  const R = 52, C = 2 * Math.PI * R
  const color = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--c4)' : score >= 40 ? 'var(--accent)' : 'var(--critical)'
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Financial health score ${score} out of 100`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * C} ${C}`} />
      </svg>
      <div className="mid"><div><b>{score}</b><span>/ 100</span></div></div>
    </div>
  )
}
