import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
process.env.SITE_BUILD_TOKEN = 'test-only-token';
process.env.STRAPI_URL = 'http://127.0.0.1:4323';
process.env.SITE_OUTPUT_ROOT = '/tmp/site-output-test';
let snapshot = { home: { brandName: '构建验证', slogan: '成功版本', aboutTitle: '关于测试' }, products: [], posts: [], jobs: [] };
const mock = http.createServer((req,res) => { res.setHeader('content-type','application/json');res.end(JSON.stringify({data:snapshot})); });
await new Promise(resolve=>mock.listen(4323,'127.0.0.1',resolve));
await import('/opt/app/scripts/builder.mjs');
const headers = {'x-site-build-token':process.env.SITE_BUILD_TOKEN};
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function wait(predicate) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline){const status=await (await fetch('http://127.0.0.1:4322/status',{headers})).json();if(predicate(status))return status;await delay(500);}
  throw new Error('Builder state timeout');
}
try {
  assert.equal((await fetch('http://127.0.0.1:4322/rebuild',{method:'POST'})).status,401);
  await wait(status=>status.lastSuccess);
  const previous=await fs.readlink('/tmp/site-output-test/current');
  const html=await fs.readFile('/tmp/site-output-test/current/index.html','utf8');
  assert.ok(html.includes('成功版本'));
  console.log('PASS: initial real Astro generation and protected trigger');
  const source='/opt/app/src/pages/index.astro';
  const original=await fs.readFile(source,'utf8');
  await fs.writeFile(source,'---\nconst broken = ;\n---\n');
  snapshot.home.slogan='不能上线的版本';
  assert.equal((await fetch('http://127.0.0.1:4322/rebuild',{method:'POST',headers})).status,202);
  await wait(status=>status.lastError && !status.building);
  assert.equal(await fs.readlink('/tmp/site-output-test/current'),previous);
  assert.equal(await fs.readFile('/tmp/site-output-test/current/index.html','utf8'),html);
  console.log('PASS: failed Astro build preserves complete previous site');
  await fs.writeFile(source,original);
  await fetch('http://127.0.0.1:4322/rebuild',{method:'POST',headers});
  await wait(status=>!status.lastError && status.lastSuccess && !status.building);
  assert.ok((await fs.readFile('/tmp/site-output-test/current/index.html','utf8')).includes('不能上线的版本'));
  assert.notEqual(await fs.readlink('/tmp/site-output-test/current'),previous);
  console.log('PASS: retry succeeds and switches static release atomically');
  process.exit(0);
} catch(error){console.error(error);process.exit(1);}
