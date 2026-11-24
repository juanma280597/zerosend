// Development test harness only. Never deployed; serves the already-built static output.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve('dist');
const config = await readFile('public/_headers', 'utf8');
const csp = config.match(/Content-Security-Policy: (.+)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'application/xml', '.txt': 'text/plain' };
createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let path = resolve(root, `.${pathname}`);
  if (!path.startsWith(root + sep) && path !== root) { response.writeHead(403).end(); return; }
  if (!extname(path)) path = resolve(path, 'index.html');
  try {
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Security-Policy': csp });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
}).listen(4321, '127.0.0.1');
