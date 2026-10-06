'use client';

import { useEffect, useState } from 'react';
import FigmaIcon from '@/components/FigmaIcon';
import { Button } from '@/components/ui/button';
import { selectDownload } from '@/lib/downloads';

export default function DownloadButton({ platforms, sourceDownload, compact = false }) {
  const [download, setDownload] = useState(() => selectDownload(platforms, sourceDownload));
  useEffect(() => {
    const device = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
    setDownload(selectDownload(platforms, sourceDownload, device));
  }, [platforms, sourceDownload]);
  return <Button size={compact ? 'sm' : 'lg'} className={`cta-button download-button${compact ? ' nav-download' : ''}`} asChild>
    <a href={download.href} download={download.source} aria-label={`${download.label} for Code Merger`}>{download.label}{!compact && <FigmaIcon name="download" />}</a>
  </Button>;
}
