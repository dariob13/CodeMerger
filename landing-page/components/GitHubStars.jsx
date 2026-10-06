'use client';

import { useEffect, useState } from 'react';
import FigmaIcon from '@/components/FigmaIcon';
import { formatStars, readRepositoryStars, repositoryApiUrl } from '@/lib/github';

export default function GitHubStars({ url, compact = false }) {
  const [result, setResult] = useState(null);
  const apiUrl = repositoryApiUrl(url);
  const count = result?.apiUrl === apiUrl ? result.count : null;

  useEffect(() => {
    if (!apiUrl) return;
    let disposed = false;
    let pending = false;
    let controller;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      controller = new AbortController();
      try {
        const count = await readRepositoryStars(apiUrl, { signal: controller.signal });
        if (!disposed) setResult({ apiUrl, count });
      } catch {
        // Retain the last successful value through offline/rate-limit errors.
      } finally {
        pending = false;
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [apiUrl]);

  return <span className="star-counter" role="status" aria-live="polite" aria-atomic="true" aria-label={count == null ? 'GitHub stars: count not available yet' : `${count.toLocaleString('en')} GitHub stars`}>
    <FigmaIcon name={compact ? 'star-nav' : 'star'} />
    <span className="star-count">{count == null ? '—' : formatStars(count)}</span>
    <span className="sr-only">stars</span>
  </span>;
}
