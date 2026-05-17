'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Slim top-of-page progress bar. Starts on internal anchor / Link clicks and
// on form submissions, finishes when the pathname changes (i.e. the new route
// has mounted). Capped with a safety timeout so it never gets stuck on screen.
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    const t = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 200);
    timersRef.current.push(t);
  };

  const start = () => {
    clearTimers();
    setActive(true);
    setProgress(10);
    // Stepped ramp so users feel constant motion on slow connections.
    timersRef.current.push(setTimeout(() => setProgress(35), 200));
    timersRef.current.push(setTimeout(() => setProgress(60), 800));
    timersRef.current.push(setTimeout(() => setProgress(80), 2000));
    // Safety: if no navigation arrives within 8s, drop the bar so the page
    // doesn't look permanently busy.
    timersRef.current.push(setTimeout(finish, 8000));
  };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Internal anchor / Link click
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (!href) return;
        if (anchor.target && anchor.target !== '_self') return;
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        try {
          const url = new URL(anchor.href, window.location.href);
          if (url.origin !== window.location.origin) return;
          // Same pathname + search → not really navigating
          if (url.pathname === window.location.pathname && url.search === window.location.search) {
            return;
          }
        } catch {
          return;
        }
        start();
        return;
      }

      // Form submission via a submit-typed button
      const button = target.closest('button');
      if (button && button.form && button.type === 'submit') {
        start();
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
    // start/finish only touch refs and setState (stable identities), so we
    // don't need to rebind the listener every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pathname changed → navigation done. Defer to a timeout so the effect
  // body doesn't update state synchronously.
  useEffect(() => {
    const t = setTimeout(() => finish(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] pointer-events-none"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 200ms ease-out' }}
    >
      <div
        className="h-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
        style={{
          width: `${progress}%`,
          transition: 'width 300ms ease-out',
        }}
      />
    </div>
  );
}
