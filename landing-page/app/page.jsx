import { GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DownloadButton from '@/components/DownloadButton';
import GitHubLink from '@/components/GitHubLink';
import GitHubStars from '@/components/GitHubStars';
import AnimatedBackdrop from '@/components/AnimatedBackdrop';
import BrandIcon from '@/components/BrandIcon';
import { product } from '@/lib/product';

const platformIcons = { macos: 'apple', linux: 'linux', windows: 'windows' };

export default function Home() {
  return <div className="single-screen">
    <a className="skip-link" href="#main">Skip to content</a>
    <AnimatedBackdrop />

    <header className="site-header"><a href="/" className="brand" aria-label="Code Merger home"><GitMerge aria-hidden="true" /><span>code<span className="brand-light">merger</span><span className="brand-period">.</span></span></a></header>

    <main id="main" className="main-content">
      <div className="hero-copy entrance">
        <h1>One chat for your <span>coding agents.</span></h1>
        <p className="hero-description">Switch agents. Keep your context.</p>
      </div>

      <div className="action-area entrance">
        <div className="primary-actions"><DownloadButton platforms={product.platforms} sourceDownload={product.sourceDownload} /><div className="github-action-group"><GitHubLink url={product.githubUrl} /><GitHubStars url={product.githubUrl} /></div></div>
        <p className="download-note">Source .zip <span aria-hidden="true">·</span> Node.js {product.nodeVersion}</p>
      </div>

      <section className="agents-section entrance" aria-label="Supported and upcoming coding agents">
        <ul className="providers">
          {product.agents.map(agent => <li key={agent.name}><Badge variant="ghost" className="provider" tabIndex={0} aria-label={`${agent.name}${agent.confirmed ? '' : ' — Coming soon'}`}><BrandIcon name={agent.icon} className="provider-icon" agent /></Badge></li>)}
        </ul>
        <p className="agent-note">Your agents. Your accounts. One conversation.</p>
      </section>
    </main>

    <footer className="site-footer"><nav aria-label="Code Merger platform downloads"><p className="platforms-label">AVAILABLE FOR</p><ul className="platforms">
      {product.platforms.map(platform => {
        const icon = platformIcons[platform.id];
        return <li key={platform.id}><Tooltip><TooltipTrigger asChild>
          {platform.confirmed && platform.url ? <Button variant="link" size="sm" className="platform-download" asChild><a href={platform.url} download aria-label={`Download Code Merger source for ${platform.name}`}><BrandIcon name={icon} />{platform.name}</a></Button> : <span className="platform-unavailable" tabIndex={0} aria-label={`${platform.name} support is unverified`}><BrandIcon name={icon} />{platform.name}<span>unverified</span></span>}
        </TooltipTrigger><TooltipContent sideOffset={8}>{platform.detail}</TooltipContent></Tooltip></li>;
      })}
    </ul><p className="setup-note">Extract, run <code>npm install</code>, then <code>npm run dev</code>.</p></nav></footer>
  </div>;
}
