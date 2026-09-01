import { useState } from 'react'

export default function Modal({ title, children, onClose, onSubmit, submitLabel = 'Save', submitDisabled = false }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSubmit(new FormData(e.target))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          {children}
          <div className="form-error">{error}</div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || submitDisabled}>{busy ? 'Saving…' : submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
