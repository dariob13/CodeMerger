'use client';

import { useEffect, useRef } from 'react';

export default function SpotlightBackdrop({ children }) {
  const backdrop = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      backdrop.current?.style.setProperty('--spotlight-x', `${x}px`);
      backdrop.current?.style.setProperty('--spotlight-y', `${y}px`);
    };
    const move = event => {
      x = event.clientX; y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={backdrop} className="spotlight-backdrop" aria-hidden="true"><div className="backdrop-wireframe">{children}</div><div className="spotlight-glow" /><div className="spotlight-vignette" /></div>;
}
