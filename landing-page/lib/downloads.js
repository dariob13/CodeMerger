export function selectDownload(platforms, sourceDownload, device = '') {
  const platformId = /windows|win32|win64/i.test(device) ? 'windows'
    : /mac|darwin/i.test(device) ? 'macos'
    : /linux/i.test(device) ? 'linux' : null;
  const platform = platforms.find(item => item.id === platformId && item.confirmed && item.url);
  // Native release URLs take priority when they become available. Until then,
  // every visitor gets the working source bundle, including unknown platforms.
  if (platform && !platform.url.endsWith('.zip')) {
    return { href: platform.url, label: `Download for ${platform.name}`, source: false };
  }
  return { href: sourceDownload, label: 'Download source', source: true };
}
