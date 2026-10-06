'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { selectDownload } from '@/lib/downloads';

export default function DownloadButton({ platforms, sourceDownload }) {
  const [download, setDownload] = useState(() => selectDownload(platforms, sourceDownload));
  useEffect(() => {
    const device = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
    setDownload(selectDownload(platforms, sourceDownload, device));
  }, [platforms, sourceDownload]);
  return <Button size="lg" className="cta-button download-button" asChild>
    <a href={download.href} download={download.source} aria-label={`${download.label} for Code Merger`}><Download aria-hidden="true" />{download.label}</a>
  </Button>;
}
