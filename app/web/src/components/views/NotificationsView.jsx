import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

export default function NotificationsView({ refreshKey, bumpRefresh }) {
  const [notes, setNotes] = useState([])

  useEffect(() => { api('/notifications').then(setNotes) }, [refreshKey])

  async function markRead(id) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
    bumpRefresh()
  }

  const visible = notes.filter(n => n.type !== 'recommendation-event')

  return (
    <section className="view active">
      <div className="page-head"><div><h1>Notifications</h1><p>Anomaly alerts and budget warnings.</p></div></div>
      <div className="card">
        {visible.length ? visible.map(n => (
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
