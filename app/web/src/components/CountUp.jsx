import { useEffect, useRef, useState } from 'react'

/** Animates a number from 0 to `value` once it mounts (skipped for reduced-motion users). */
export default function CountUp({ value, format = v => Math.round(v).toLocaleString('en-IN'), duration = 900 }) {
  const [shown, setShown] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration)
      setShown(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])
  return <>{format(shown)}</>
}
