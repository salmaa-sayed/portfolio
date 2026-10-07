const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp4':'video/mp4', '.json':'application/json' };
function handler(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(`${root}${path.sep}`) || /(^|\/)\./.test(pathname) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const size = fs.statSync(filename).size;
  const headers = { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'X-Content-Type-Options':'nosniff' };
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) { res.writeHead(416, { 'Content-Range':`bytes */${size}` }); res.end(); return; }
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  res.writeHead(range ? 206 : 200, { ...headers, 'Content-Length':end - start + 1 });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(filename, { start, end });
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
}
module.exports = { handler };
if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  http.createServer(handler).listen(port, '127.0.0.1', () => console.log(`Portfolio: http://localhost:${port}`));
}
