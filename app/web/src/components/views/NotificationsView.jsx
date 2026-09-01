import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelList } from '../Skeleton.jsx'

export default function NotificationsView({ refreshKey, bumpRefresh }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    api('/notifications')
      .then(n => { if (!cancelled) setNotes(n) })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function markRead(id) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
    bumpRefresh()
  }

  const visible = notes.filter(n => n.type !== 'recommendation-event')

  return (
    <section className="view active">
      <div className="page-head"><div><h1>Notifications</h1><p>Anomaly alerts and budget warnings.</p></div></div>
      <div className="card">
        {loading ? <SkelList count={3} /> : visible.length ? visible.map(n => (
          <div className={`notif-item ${n.read ? 'read' : 'unread'}`} key={n.id}>
            <span className="dot-status" />
            <div className="txt">{n.message}<div className="when">{new Date(n.createdAt).toLocaleString()}</div></div>
            {!n.read && <button className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)}>Mark read</button>}
          </div>
        )) : <div className="empty">No notifications yet.</div>}
      </div>
    </section>
  )
}
