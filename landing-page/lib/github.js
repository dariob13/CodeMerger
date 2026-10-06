export function repositoryApiUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(parsed.hostname)) return null;
    const [owner, name] = parsed.pathname.split('/').filter(Boolean);
    const repository = name?.replace(/\.git$/, '');
    if (!/^[\w-]+$/.test(owner || '') || !/^[\w.-]+$/.test(repository || '')) return null;
    return `https://api.github.com/repos/${owner}/${repository}`;
  } catch {
    return null;
  }
}

export async function readRepositoryStars(apiUrl, { signal, fetcher = fetch } = {}) {
  const response = await fetcher(apiUrl, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('Star count is unavailable');
  const { stargazers_count: count } = await response.json();
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid star count');
  return count;
}

export function formatStars(count) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(count);
}
