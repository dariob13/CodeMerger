import tiles from '@/lib/horse-tiles.json';

export default function PixelHorse() {
  return <div className="pixel-horse" aria-hidden="true"><div className="horse-field">
    {tiles.map(tile => <span key={tile.id} data-node-id={tile.id} className="horse-tile" style={{ left: `${tile.x / 1404 * 100}%`, top: `${tile.y / 728 * 100}%`, '--tile-opacity': tile.opacity }} />)}
  </div></div>;
}
