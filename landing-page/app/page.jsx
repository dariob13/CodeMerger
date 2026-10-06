import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DownloadButton from '@/components/DownloadButton';
import GitHubLink from '@/components/GitHubLink';
import FigmaIcon from '@/components/FigmaIcon';
import PixelHorse from '@/components/PixelHorse';
import { product } from '@/lib/product';

const platformIcons = { macos: 'apple', linux: 'linux', windows: 'windows' };

export default function Home() {
  return <div className="landing-screen">
    <a className="skip-link" href="#main">Skip to content</a>
    <PixelHorse />
    <header className="site-header">
      <a href="/" className="brand" aria-label="Code Merger home"><FigmaIcon name="merge" /><span>code<span className="brand-light">merger</span><span className="brand-period">.</span></span></a>
      <nav className="nav-actions" aria-label="Main navigation"><GitHubLink url={product.githubUrl} compact /><DownloadButton platforms={product.platforms} sourceDownload={product.sourceDownload} compact /></nav>
    </header>
    <main id="main" className="hero-layout" data-node-id="1:939">
      <div className="hero-copy">
        <h1><span>One chat for your coding agents.</span> Switch agents. Keep your context. Your agents. Your accounts. One conversation.</h1>
        <div className="primary-actions"><DownloadButton platforms={product.platforms} sourceDownload={product.sourceDownload} /><GitHubLink url={product.githubUrl} /></div>
        <p className="download-note">Source .zip <span aria-hidden="true"> {"\u00b7"} </span> Node.js {product.nodeVersion}</p>
      </div>
      <section className="agents-section" aria-label="Supported and upcoming coding agents">
        <ul className="agent-list">{product.agents.map(agent => <li key={agent.name} className={`agent-row${agent.confirmed ? '' : ' upcoming'}`}>
          <span className="agent-identity"><FigmaIcon name={agent.icon} /><span>{agent.name}</span></span>
          <span className="agent-detail">{agent.confirmed ? agent.detail : 'Coming soon'}</span>
        </li>)}</ul>
      </section>
    </main>
    <footer className="site-footer">
      <nav className="platforms" aria-label="Code Merger platform downloads"><span className="platforms-label">Available for</span>
        {product.platforms.map(platform => <Tooltip key={platform.id}><TooltipTrigger asChild>
          {platform.confirmed && platform.url ? <Button variant="link" size="sm" className="platform-download" asChild><a href={platform.url} download aria-label={`Download Code Merger source for ${platform.name}`}><FigmaIcon name={platformIcons[platform.id]} />{platform.name}</a></Button> : <span className="platform-unavailable" tabIndex={0} aria-label={`${platform.name} support is unverified`}><FigmaIcon name={platformIcons[platform.id]} />{platform.name}<span>unverified</span></span>}
        </TooltipTrigger><TooltipContent sideOffset={8}>{platform.detail}</TooltipContent></Tooltip>)}
      </nav>
      <p className="setup-note">Extract, run <code>npm install</code>, then <code>npm run dev</code>.</p>
    </footer>
  </div>;
}
