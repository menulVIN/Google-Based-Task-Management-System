// Minimal static server used only to preview the dashboard mock locally.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'D:/task-tracker/dev';
const PORT = 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

createServer(async (req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/_mock-dashboard.html';
  const path = normalize(join(ROOT, file));
  if (!path.startsWith(normalize(ROOT))) { res.writeHead(403).end('no'); return; }
  try {
    const buf = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log('mock server on http://localhost:' + PORT));
