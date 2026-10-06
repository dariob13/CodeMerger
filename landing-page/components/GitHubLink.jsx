'use client';

import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BrandIcon from '@/components/BrandIcon';

export default function GitHubLink({ url }) {
  const content = <><BrandIcon name="github" /> GitHub <ArrowUpRight aria-hidden="true" /></>;
  if (url) return <Button variant="outline" size="lg" className="cta-button" asChild><a href={url} target="_blank" rel="noopener noreferrer">{content}</a></Button>;
  return <Button variant="outline" size="lg" className="cta-button" onClick={() => toast.info('The public GitHub repository is coming soon.', { description: 'The source download is available now.' })}>{content}</Button>;
}
