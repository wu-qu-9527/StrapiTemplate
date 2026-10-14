import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';

const token = process.env.SITE_BUILD_TOKEN;
if (!token) throw new Error('SITE_BUILD_TOKEN is required');
const root = process.env.SITE_OUTPUT_ROOT || '/site';
const strapiUrl = process.env.STRAPI_URL || 'http://strapi:1337';
let running = false, pending = false, timer, lastHash = null;
let status = { building: false, lastSuccess: null, lastError: null };
await fs.mkdir(path.join(root, 'releases'), { recursive: true });
await fs.mkdir('.content', { recursive: true });
try { status.lastSuccess = JSON.parse(await fs.readFile(path.join(root, 'build-status.json'), 'utf8')).lastSuccess; } catch {}
function authorized(req) {
  const supplied = req.headers['x-site-build-token'];
  return typeof supplied === 'string' && Buffer.byteLength(token) === Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(token), Buffer.from(supplied));
}
function queue() {
  pending = true;
  if (running || timer) return;
  timer = setTimeout(() => { timer = null; void rebuild(); }, 2000);
}
function build(outDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], { cwd: process.cwd(), env: { ...process.env, SITE_BUILD_DIR: outDir, ASTRO_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { tail = (tail + chunk.toString()).slice(-3000); process.stdout.write(chunk); });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 5 * 60 * 1000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`Astro build failed (${code}): ${tail.slice(-800)}`)); });
  });
}
async function persist() { await fs.writeFile(path.join(root, 'build-status.json'), JSON.stringify(status)); }
async function rebuild() {
  if (running) { pending = true; return; }
  running = true; pending = false;
  let release, switched = false;
  try {
    const response = await fetch(`${strapiUrl}/api/website/snapshot`, { headers: { 'x-site-build-token': token }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Strapi snapshot returned ${response.status}`);
    const { data } = await response.json();
    for (const key of ['products', 'posts', 'jobs']) {
      if (!Array.isArray(data[key])) throw new Error(`Invalid snapshot: ${key}`);
      for (const entry of data[key]) if (!entry.slug || /[\/\\\x00-\x1F]/.test(entry.slug) || ['.', '..'].includes(entry.slug)) throw new Error('Invalid content URL slug');
    }
    const json = JSON.stringify(data);
    const hash = createHash('sha256').update(json).digest('hex');
    if (hash === lastHash) { status.lastError = null; return; }
    status.building = true; await persist();
    release = path.join(root, 'releases', `${Date.now()}-${hash.slice(0, 10)}`);
    await fs.writeFile('.content/snapshot.json', json);
    await build(release);
    if (!existsSync(path.join(release, 'index.html')) || !existsSync(path.join(release, 'downloads/index.html'))) throw new Error('Incomplete static output');
    // Keep assets used by pages opened just before the atomic switch.
    if (existsSync(path.join(root, 'current/_astro'))) await fs.cp(path.join(root, 'current/_astro'), path.join(release, '_astro'), { recursive: true, force: false });
    const info = { builtAt: new Date().toISOString(), contentHash: hash, products: data.products.length, posts: data.posts.length, jobs: data.jobs.length };
    await fs.writeFile(path.join(release, 'build-info.json'), JSON.stringify(info));
    const link = path.join(root, '.current-next');
    await fs.rm(link, { force: true });
    await fs.symlink(path.relative(root, release), link);
    await fs.rename(link, path.join(root, 'current'));
    switched = true;
    lastHash = hash; status.lastSuccess = info; status.lastError = null;
    console.log(`Static site updated: ${info.builtAt}`);
    const releases = (await fs.readdir(path.join(root, 'releases'))).sort().reverse();
    for (const old of releases.slice(3)) await fs.rm(path.join(root, 'releases', old), { recursive: true, force: true }).catch(error => console.warn('Old release cleanup deferred:', error.message));
  } catch (error) {
    status.lastError = { at: new Date().toISOString(), message: error.message };
    console.error('Static build failed; keeping previous site:', error.message);
    if (release && !switched) await fs.rm(release, { recursive: true, force: true });
  } finally {
    status.building = false; running = false; await persist();
    if (pending) queue();
  }
}
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') { res.writeHead(existsSync(path.join(root, 'current/index.html')) ? 200 : 503); res.end('builder'); return; }
  if (!authorized(req)) { res.writeHead(401); res.end('Unauthorized'); return; }
  if (req.method === 'GET' && req.url === '/status') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(status)); return; }
  if (req.method === 'POST' && req.url === '/rebuild') { req.resume(); queue(); res.writeHead(202); res.end('Queued'); return; }
  res.writeHead(404); res.end('Not found');
});
server.listen(4322, '0.0.0.0');
queue();
setInterval(queue, 30000);
