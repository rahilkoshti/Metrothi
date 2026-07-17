import { useState, useEffect } from 'react';

interface CountdownProps {
  targetMs: number;
}

export function Countdown({ targetMs }: CountdownProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Force immediate re-evaluation when mounted
    setNow(Date.now());
    
    // Sync to the next second boundary
    const delay = 1000 - (Date.now() % 1000);
    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;
    
    timeout = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [targetMs]);

  const remaining = targetMs - now;

  if (remaining < 0) {
    return <span>Missed</span>;
  }
  if (remaining === 0) {
    return <span>0s</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return <span>{h}h {m}m {s}s</span>;
  }
  return <span>{m}:{String(s).padStart(2, '0')}</span>;
}
