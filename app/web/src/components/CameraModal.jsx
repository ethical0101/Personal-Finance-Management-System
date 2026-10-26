import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/** Live camera capture (desktop webcams and phones). Calls onCapture(dataUrl) with a JPEG photo. */
export default function CameraModal({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setError('This browser cannot open the camera here.'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); setReady(true) }
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow camera access in the browser address bar, or upload a photo instead.'
          : e.name === 'NotFoundError' ? 'No camera was found on this device. Upload a photo instead.'
          : 'Could not start the camera. Upload a photo instead.')
      }
    }
    start()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function snap() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCapture(c.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal wide camera-modal">
        <h3>Take a photo of the bill</h3>
        {error ? (
          <>
            <div className="form-error" style={{ minHeight: 0, margin: '0 0 14px' }}>{error}</div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={onFallback}><Icon name="upload" />Upload a photo</button>
            </div>
          </>
        ) : (
          <>
            <div className="cam-frame">
              <video ref={videoRef} playsInline muted />
              <div className="cam-guide" />
              {!ready && <div className="cam-wait">Starting camera…</div>}
            </div>
            <p style={{ fontSize: 12.5, margin: '10px 0 0' }}>Lay the bill flat, fill the frame, keep the text sharp.</p>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={snap} disabled={!ready}><Icon name="camera" />Capture</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
