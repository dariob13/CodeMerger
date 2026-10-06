'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import FigmaIcon from '@/components/FigmaIcon';
import GitHubStars from '@/components/GitHubStars';

export default function GitHubLink({ url, compact = false }) {
  const content = <>{!compact && <FigmaIcon name="github" />}<span>GitHub</span><span className="github-divider" /><GitHubStars url={url} compact={compact} /><FigmaIcon name={compact ? 'arrow-nav' : 'arrow'} /></>;
  const className = `cta-button github-button${compact ? ' nav-github' : ''}`;
  if (url) return <Button variant={compact ? 'ghost' : 'outline'} size="lg" className={className} asChild><a href={url} target="_blank" rel="noopener noreferrer">{content}</a></Button>;
  return <Button variant={compact ? 'ghost' : 'outline'} size="lg" className={className} onClick={() => toast.info('The public GitHub repository is coming soon.', { description: 'The source download is available now.' })}>{content}</Button>;
}
