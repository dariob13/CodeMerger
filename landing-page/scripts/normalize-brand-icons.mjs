import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Trim only transparent canvas space, then give every brand the same square
// frame. Paths, colours and proportions stay intact; source SVGs stay intact.
const directory = fileURLToPath(new URL('../public/brands/', import.meta.url));
const agents = ['claude', 'openai', 'opencode', 'cursor', 'antigravity', 'hermes', 'grok'];
await fs.mkdir(path.join(directory, 'agents'), { recursive: true });

for (const name of agents) {
  const source = await fs.readFile(path.join(directory, `${name}.svg`), 'utf8');
  const [x, y, width, height] = source.match(/viewBox=["']([^"']+)["']/)[1].split(/\s+/).map(Number);
  const { data, info } = await sharp(Buffer.from(source)).resize(1024, 1024, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let py = 0; py < info.height; py++) {
    for (let px = 0; px < info.width; px++) {
      if (data[(py * info.width + px) * info.channels + 3] < 32) continue;
      left = Math.min(left, px); top = Math.min(top, py);
      right = Math.max(right, px); bottom = Math.max(bottom, py);
    }
  }
  if (right < left) throw new Error(`Empty brand icon: ${name}`);
  const artworkWidth = (right - left + 1) * width / info.width;
  const artworkHeight = (bottom - top + 1) * height / info.height;
  const centerX = x + (left + right + 1) * width / (2 * info.width);
  const centerY = y + (top + bottom + 1) * height / (2 * info.height);
  const size = Math.max(artworkWidth, artworkHeight) * 1.04;
  const viewBox = [centerX - size / 2, centerY - size / 2, size, size].map(n => n.toFixed(4)).join(' ');
  const framed = source.replace(/<svg\b[^>]*>/, tag => tag
    .replace(/\s(?:width|height)=["'][^"']*["']/g, '')
    .replace(/viewBox=["'][^"']+["']/, `viewBox="${viewBox}"`)
    .replace('<svg ', '<svg width="28" height="28" '));
  await fs.writeFile(path.join(directory, 'agents', `${name}.svg`), framed);
}
console.log(`Framed ${agents.length} agent icons to equal visible size.`);
