// Run inside the Strapi container: docker compose exec -T strapi node < tests/website.integration.cjs
const assert = require('node:assert/strict');
const { createStrapi } = require('@strapi/strapi');
const base = 'http://127.0.0.1:1337/api/website/';
const slug = 'verification-' + Date.now();
async function get(path) {
  const response = await fetch(base + path, { cache: 'no-store' });
  return { status: response.status, body: await response.json() };
}
(async () => {
  const app = await createStrapi({ distDir: './dist' }).load();
  const created = [];
  try {
    for (const [uid, path, data] of [
      ['api::product.product', 'products', { title: '产品发布流程检查', slug, summary: '临时验证数据', highlights: '亮点一\n亮点二', version: '测试版', ctaLabel: '咨询', ctaUrl: 'mailto:test@example.com', description: [{ type: 'paragraph', children: [{ type: 'text', text: '验证产品草稿不会公开' }] }] }],
      ['api::post.post', 'posts', { title: '发布流程检查', slug, category: '公司动态', summary: '临时验证数据', body: [{ type: 'paragraph', children: [{ type: 'text', text: '验证草稿不会公开' }] }] }],
      ['api::job.job', 'jobs', { title: '岗位流程检查', slug, department: '测试', location: '测试', employmentType: '全职', summary: '临时验证数据', description: [{ type: 'paragraph', children: [{ type: 'text', text: '验证岗位下架' }] }], applicationEmail: 'test@example.com' }],
    ]) {
      const docs = app.documents(uid);
      const entry = await docs.create({ data });
      created.push([uid, entry.documentId]);
      assert.equal((await get(path + '/' + slug)).status, 404, 'Draft detail must be hidden');
      assert.ok(!(await get(path)).body.data.some(row => row.slug === slug), 'Draft list must be hidden');
      await docs.publish({ documentId: entry.documentId });
      assert.equal((await get(path + '/' + slug)).body.data.title, data.title, 'Published detail must be visible');
      assert.ok((await get(path)).body.data.some(row => row.slug === slug), 'Published list must be visible');
      await docs.update({ documentId: entry.documentId, data: { title: '尚未发布的新标题' } });
      assert.equal((await get(path + '/' + slug)).body.data.title, data.title, 'Draft edits must not replace published content');
      await docs.unpublish({ documentId: entry.documentId });
      assert.equal((await get(path + '/' + slug)).status, 404, 'Unpublished detail must be hidden');
      assert.ok(!(await get(path)).body.data.some(row => row.slug === slug), 'Unpublished list must be hidden');
      const write = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
      assert.ok([404, 405].includes(write.status), 'Public website API must not allow writes');
      console.log('PASS:', path, 'draft / publish / edit / unpublish / read-only');
    }
    assert.equal((await get('home')).status, 200);
    console.log('PASS: homepage');
  } finally {
    for (const [uid, documentId] of created) await app.documents(uid).delete({ documentId });
    await app.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
