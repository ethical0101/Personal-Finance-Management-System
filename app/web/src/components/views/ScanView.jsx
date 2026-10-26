import { useEffect, useMemo, useRef, useState } from 'react'
import { api, money, todayStr } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import Icon from '../Icon.jsx'

const SAMPLES = [
  { id: 'r1', label: 'Supermarket bill' },
  { id: 'r2', label: 'Electricity bill' },
  { id: 'r3', label: 'Restaurant bill' },
]

// Shrink big phone photos before upload: keeps the request small (and fast)
// without hurting OCR accuracy.
function downscale(dataUrl, maxSide = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('That file could not be read as an image.'))
    img.src = dataUrl
  })
}
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })

export default function ScanView({ bumpRefresh, go }) {
  const [preview, setPreview] = useState(null)       // data URL shown to the user
  const [status, setStatus] = useState('idle')       // idle | scanning | result | saved
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [budgets, setBudgets] = useState([])
  const [result, setResult] = useState(null)         // raw scan result
  const [form, setForm] = useState({ merchant: '', total: '', date: todayStr(), categoryId: '', accountId: '' })
  const [savedInfo, setSavedInfo] = useState(null)
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    Promise.all([api('/categories'), api('/accounts'), api('/budgets')])
      .then(([c, a, b]) => { setCategories(c.filter(x => x.name !== 'Income')); setAccounts(a); setBudgets(b) })
      .catch(e => toast(e.message, 'error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDataUrl(raw) {
    setError(''); setResult(null); setSavedInfo(null)
    try {
      const small = await downscale(raw)
      setPreview(small)
      await scan(small)
    } catch (e) { setError(e.message); setStatus('idle') }
  }
  async function onFile(f) {
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image file (photo or screenshot of a bill).'); return }
    handleDataUrl(await readFile(f))
  }
  async function loadSample(id) {
    const blob = await (await fetch(`/samples/${id}.png`)).blob()
    handleDataUrl(await readFile(blob))
  }

  async function scan(dataUrl) {
    setStatus('scanning')
    try {
      const b64 = dataUrl.split(',')[1]
      const r = await api('/scan/receipt', { method: 'POST', body: { image: b64, mimeType: 'image/jpeg' } })
      setResult(r)
      setForm({
        merchant: r.merchant, total: String(r.total), date: r.date,
        categoryId: r.categoryId || categories[0]?.id || '', accountId: accounts[0]?.id || '',
      })
      setStatus('result')
    } catch (e) { setError(e.message); setStatus('idle') }
  }

  function reset() { setPreview(null); setResult(null); setStatus('idle'); setError(''); setSavedInfo(null) }

  // ---- live budget impact, recomputed as the user edits the amount/category ----
  const impact = useMemo(() => {
    if (status !== 'result') return null
    const amount = Number(form.total) || 0
    const curMonth = todayStr().slice(0, 7)
    if (form.date.slice(0, 7) !== curMonth) return { other: form.date.slice(0, 7) }
    const b = budgets.find(x => x.categoryId === form.categoryId)
    const cat = categories.find(c => c.id === form.categoryId)
    if (!b) return { none: true, category: cat?.name }
    const after = b.spent + amount
    return {
      category: cat?.name, limit: b.monthlyLimit, before: b.spent, after,
      pctBefore: Math.round((b.spent / b.monthlyLimit) * 100), pctAfter: Math.round((after / b.monthlyLimit) * 100),
      overBy: Math.max(0, after - b.monthlyLimit),
    }
  }, [status, form, budgets, categories])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api('/transactions', {
        method: 'POST',
        body: { type: 'expense', amount: Number(form.total), categoryId: form.categoryId, accountId: form.accountId, description: form.merchant, date: form.date },
      })
      toast(r.anomaly.isAnomaly ? 'Saved — flagged as unusual spending.' : 'Expense saved from your bill.', r.anomaly.isAnomaly ? 'error' : 'success')
      setSavedInfo({ merchant: form.merchant, amount: Number(form.total), category: categories.find(c => c.id === form.categoryId)?.name, impact, anomaly: r.anomaly.isAnomaly })
      setStatus('saved'); bumpRefresh()
      api('/budgets').then(setBudgets).catch(() => {})
    } catch (err) { toast(err.message, 'error') } finally { setSaving(false) }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <section>
      <div className="page-head">
        <div><h1>Scan a bill</h1><p>Take a photo of any receipt or bill. AI reads it, files it under the right category, and shows what it does to your budget — you confirm before anything is saved.</p></div>
      </div>

      <div className="scan-layout">
        {/* -------- left: image -------- */}
        <div>
          {!preview ? (
            <>
              <div className={`dropzone ${drag ? 'drag' : ''}`} role="button" tabIndex={0}
                onClick={() => fileRef.current?.click()} onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}>
                <div>
                  <div className="big-ico"><Icon name="upload" size={30} /></div>
                  <h3>Drop a bill here, or click to upload</h3>
                  <p>JPG, PNG or WebP. Photos taken on your phone work best in good light.</p>
                  <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button type="button" className="btn btn-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}><Icon name="upload" />Choose file</button>
                    <button type="button" className="btn btn-outline" onClick={e => { e.stopPropagation(); camRef.current?.click() }}><Icon name="camera" />Take photo</button>
                  </div>
                </div>
              </div>
              <div className="sample-row">
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-faint)', alignSelf: 'center' }}>No bill handy? Try a sample:</span>
                {SAMPLES.map(s => <button key={s.id} className="btn btn-sm btn-ghost" onClick={() => loadSample(s.id)}>{s.label}</button>)}
              </div>
            </>
          ) : (
            <div className="preview">
              <img src={preview} alt="Your bill" />
              {status === 'scanning' && <div className="scanline" />}
            </div>
          )}
          {preview && status !== 'scanning' && <div style={{ marginTop: 12 }}><button className="btn btn-ghost btn-sm" onClick={reset}>Scan a different bill</button></div>}
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={camRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          {error && <div className="card" style={{ marginTop: 14, background: 'var(--critical-soft)', borderColor: 'transparent' }}><b style={{ color: 'var(--critical)' }}>{error}</b></div>}
        </div>

        {/* -------- right: result -------- */}
        <div>
          {status === 'idle' && !preview && (
            <div className="card">
              <div className="section-title"><h3>How it works</h3></div>
              {[['1', 'Snap or upload', 'Any shop receipt, restaurant bill, or utility bill.'],
                ['2', 'AI reads it', 'Merchant, date, total and category are extracted for you.'],
                ['3', 'See the budget impact', 'Know before you save whether it pushes a budget over its limit.'],
                ['4', 'Confirm', 'Edit anything that looks off, then save. Your photo is never stored.']].map(([n, t, d]) => (
                <div className="list-row" key={n}><div className="ico out">{n}</div><div className="mid"><div className="t">{t}</div><div className="s" style={{ whiteSpace: 'normal' }}>{d}</div></div></div>
              ))}
            </div>
          )}

          {status === 'scanning' && (
            <div className="card">
              <div className="section-title"><h3>Reading your bill…</h3><span className="chip info">AI working</span></div>
              {[70, 40, 90, 55, 80].map((w, i) => <div key={i} className="skel" style={{ height: i === 0 ? 26 : 14, width: `${w}%`, marginBottom: 14 }} />)}
              <p style={{ fontSize: 12.5, marginTop: 6 }}>This usually takes a few seconds.</p>
            </div>
          )}

          {status === 'result' && result && (
            <form className="card" onSubmit={save}>
              <div className="result-head">
                <div><div className="eyebrow" style={{ font: '800 11px Manrope', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-faint)' }}>Detected</div>
                  <div className="merchant">{form.merchant || 'Unknown merchant'}</div></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className={`chip ${result.confidence >= 0.8 ? 'good' : 'warn'}`}>{Math.round(result.confidence * 100)}% confident</span>
                  {result.possibleDuplicate && <span className="chip critical">Possible duplicate</span>}
                  {result.dateWarning && <span className="chip warn">Check the date</span>}
                </div>
              </div>

              {result.dateWarning && <div className="impact" style={{ background: 'var(--warn-soft)' }}><div className="note" style={{ marginTop: 0, color: 'var(--warn)' }}>{result.dateWarning}</div></div>}

              {result.items.length > 0 && (
                <div className="items-list">
                  {result.items.map((it, i) => <div className="it" key={i}><span>{it.name}</span><b>{money(it.amount)}</b></div>)}
                </div>
              )}

              <div className="form-grid">
                <div className="field"><label>Merchant</label><input value={form.merchant} onChange={set('merchant')} required /></div>
                <div className="field"><label>Total (₹)</label><input type="number" step="0.01" min="0.01" value={form.total} onChange={set('total')} required /></div>
                <div className="field"><label>Date</label><input type="date" value={form.date} onChange={set('date')} required /></div>
                <div className="field"><label>Category</label><select value={form.categoryId} onChange={set('categoryId')}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Pay from account</label><select value={form.accountId} onChange={set('accountId')}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              </div>

              {impact && !impact.other && !impact.none && (
                <div className="impact">
                  <div className="row"><span>{impact.category} budget</span><span className="mono">{money(impact.after).replace('.00', '')} / {money(impact.limit).replace('.00', '')}</span></div>
                  <div className="progress-track" style={{ margin: '8px 0' }}>
                    <div className={`progress-fill ghost ${impact.pctAfter > 100 ? 'over' : ''}`} style={{ width: `${Math.min(100, impact.pctAfter)}%` }} />
                    <div className="progress-fill" style={{ width: `${Math.min(100, impact.pctBefore)}%`, position: 'relative', zIndex: 1 }} />
                  </div>
                  <div className="note" style={{ color: impact.overBy ? 'var(--critical)' : 'var(--ink-dim)' }}>
                    {impact.overBy
                      ? `Saving this puts ${impact.category} ${money(impact.overBy).replace('.00', '')} over its limit (${impact.pctBefore}% → ${impact.pctAfter}%).`
                      : `Budget goes from ${impact.pctBefore}% to ${impact.pctAfter}% — ${money(impact.limit - impact.after).replace('.00', '')} still available.`}
                  </div>
                </div>
              )}
              {impact?.none && <div className="impact"><div className="note" style={{ marginTop: 0 }}>No budget set for {impact.category}. <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('budgets')}>Set one</button></div></div>}
              {impact?.other && <div className="impact"><div className="note" style={{ marginTop: 0 }}>This bill is dated {impact.other}, so it won't change this month's budgets.</div></div>}

              <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-ghost" onClick={reset}>Discard</button>
                <button type="submit" className="btn btn-primary" disabled={saving}><Icon name="check" />{saving ? 'Saving…' : 'Save expense'}</button>
              </div>
            </form>
          )}

          {status === 'saved' && savedInfo && (
            <div className="card" style={{ textAlign: 'center', padding: 36 }}>
              <div className="big-ico" style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--good-soft)', color: 'var(--good)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="check" size={30} /></div>
              <h3 style={{ fontSize: 20, marginBottom: 6 }}>Saved to {savedInfo.category}</h3>
              <p>{savedInfo.merchant} · {money(savedInfo.amount)} was added and your balances and budgets are updated.</p>
              {savedInfo.anomaly && <p><span className="chip critical">Flagged as unusual — check Notifications</span></p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={reset}><Icon name="scan" />Scan another</button>
                <button className="btn btn-outline" onClick={() => go('budgets')}>View budgets</button>
                <button className="btn btn-ghost" onClick={() => go('dashboard')}>Dashboard</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
