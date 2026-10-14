const assert = require('node:assert/strict');
const { createStrapi } = require('@strapi/strapi');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const base = 'http://127.0.0.1:1337/api/website/';
const site = 'http://website';
const slug = 'ssg-download-verification-' + Date.now();
const text = 'Download integration verification: harmless text file.\n';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(route) { const response = await fetch(base + route, { cache: 'no-store' }); return { status: response.status, data: response.ok ? (await response.json()).data : null }; }
async function waitForPage(status, expectedText) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const response = await fetch(`${site}/products/${slug}/`, { cache: 'no-store' });
    const html = await response.text();
    if (response.status === status && (!expectedText || html.includes(expectedText))) return html;
    await sleep(1500);
  }
  throw new Error('Automatic static deployment did not reach expected state');
}
(async () => {
  const app = await createStrapi({ distDir: './dist' }).load();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'astro-download-test-'));
  let entry, file;
  const docs = app.documents('api::product.product');
  try {
    assert.equal((await api('snapshot')).status, 401, 'Build snapshot must require token');
    const filepath = path.join(tmp, 'verification.txt'); await fs.writeFile(filepath, text);
    [file] = await app.plugin('upload').service('upload').upload({ data: {}, files: { filepath, originalFilename: 'verification.txt', mimetype: 'text/plain', size: Buffer.byteLength(text) } });
    const download = { label: '验证说明文件', platform: '通用', version: '1.0', file: file.id, notes: '临时测试数据' };
    entry = await docs.create({ data: { title: '静态与下载验证产品', slug, summary: '临时验证数据', description: [{ type: 'paragraph', children: [{ type: 'text', text: '测试静态输出包含正文' }] }], downloads: [download] } });
    assert.equal((await api(`products/${slug}/downloads`)).status, 404, 'Draft downloads must be hidden');
    await docs.publish({ documentId: entry.documentId });
    const metadata = await api(`products/${slug}/downloads`);
    assert.equal(metadata.data.downloads[0].version, '1.0');
    assert.ok(!JSON.stringify(metadata.data).includes('/uploads/'), 'Client must download through API');
    let url = metadata.data.downloads[0].downloadUrl;
    const response = await fetch('http://127.0.0.1:1337' + url);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-disposition'), /attachment/); assert.equal(await response.text(), text);
    console.log('PASS: real upload / API metadata / attachment download / protected draft');
    const html = await waitForPage(200, '测试静态输出包含正文');
    assert.ok(html.includes('静态与下载验证产品'), 'HTML must contain content without browser API fetching');
    assert.ok(!html.includes('正在加载详情'), 'Detail must be static');
    console.log('PASS: publish triggers Astro build and independent static URL');
    await docs.update({ documentId: entry.documentId, data: { title: '未发布修改', downloads: [{ ...download, version: '2.0' }] } });
    assert.equal((await api(`products/${slug}/downloads`)).data.downloads[0].version, '1.0');
    assert.ok((await (await fetch(`${site}/products/${slug}/`)).text()).includes('静态与下载验证产品'));
    console.log('PASS: draft edits do not affect live static page or download metadata');
    await docs.publish({ documentId: entry.documentId });
    assert.equal((await api(`products/${slug}/downloads`)).data.downloads[0].version, '2.0');
    url = (await api(`products/${slug}/downloads`)).data.downloads[0].downloadUrl;
    await waitForPage(200, '未发布修改');
    await docs.unpublish({ documentId: entry.documentId });
    assert.equal((await api(`products/${slug}/downloads`)).status, 404);
    assert.equal((await fetch('http://127.0.0.1:1337' + url)).status, 404);
    await waitForPage(404);
    console.log('PASS: unpublish immediately blocks download API and removes static detail');
  } finally {
    if (entry) await docs.delete({ documentId: entry.documentId });
    if (file) await app.plugin('upload').service('upload').remove(file);
    await fs.rm(tmp, { recursive: true, force: true });
    await app.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
