const postFields = ['title', 'slug', 'category', 'summary', 'featured', 'publishedAt'];
const jobFields = ['title', 'slug', 'department', 'location', 'employmentType', 'summary', 'sortOrder'];
const productFields = ['title', 'slug', 'tagline', 'summary', 'version', 'releaseDate', 'pricing', 'sortOrder'];
const imageFields = ['url', 'alternativeText', 'width', 'height'];
const downloadPopulate = { downloads: { populate: { file: { fields: ['name', 'url', 'size', 'ext', 'mime', 'provider'] } } } };

async function publishedProductDownloads(slug: string) {
  return strapi.documents('api::product.product').findFirst({
    status: 'published', filters: { slug }, fields: ['title', 'slug'], populate: downloadPopulate,
  } as any) as any;
}

async function allPublished(uid: string, fields: string[], populate: any, sort: string[]) {
  const rows: any[] = [];
  for (let start = 0; ; start += 100) {
    const page = await (strapi.documents as any)(uid).findMany({ status: 'published', fields, populate, sort, start, limit: 100 });
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

export default {
  async snapshot(ctx: any) {
    const token = process.env.SITE_BUILD_TOKEN;
    const supplied = ctx.get('x-site-build-token');
    if (!token || !supplied || Buffer.byteLength(token) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))) return ctx.unauthorized();
    ctx.set('Cache-Control', 'no-store');
    const [home, products, posts, jobs] = await Promise.all([
      strapi.documents('api::site-setting.site-setting').findFirst({ status: 'published', fields: ['brandName', 'eyebrow', 'slogan', 'subtitle', 'aboutTitle', 'aboutText', 'contactEmail', 'address'], populate: { heroImage: { fields: imageFields } } } as any),
      allPublished('api::product.product', [...productFields, 'description', 'highlights', 'ctaLabel', 'ctaUrl'], { cover: { fields: imageFields }, gallery: { fields: imageFields } }, ['sortOrder:asc', 'documentId:asc']),
      allPublished('api::post.post', [...postFields, 'body'], { cover: { fields: imageFields } }, ['featured:desc', 'publishedAt:desc', 'documentId:asc']),
      allPublished('api::job.job', [...jobFields, 'description', 'applicationEmail'], {}, ['sortOrder:asc', 'documentId:asc']),
    ]);
    ctx.body = { data: { home, products, posts, jobs } };
  },
  async downloads(ctx: any) {
    const product = await publishedProductDownloads(ctx.params.slug);
    if (!product) return ctx.notFound('产品不存在或已下架');
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: { title: product.title, slug: product.slug, downloads: (product.downloads || []).map((item: any) => ({
      id: item.id, label: item.label, platform: item.platform, version: item.version, notes: item.notes,
      checksum: item.checksum, filename: item.file?.name || null, size: item.file?.size || null,
      downloadUrl: (item.file || item.externalUrl) ? `/api/website/products/${encodeURIComponent(product.slug)}/downloads/${item.id}/file` : null,
    })) } };
  },
  async downloadFile(ctx: any) {
    const product = await publishedProductDownloads(ctx.params.slug);
    const item = product?.downloads?.find((row: any) => String(row.id) === ctx.params.id);
    if (!item) return ctx.notFound('下载项不存在或已下架');
    ctx.set('Cache-Control', 'no-store');
    if (item.file) {
      if (item.file.provider !== 'local') {
        if (!/^https?:\/\//i.test(item.file.url)) return ctx.notFound();
        ctx.redirect(item.file.url); return;
      }
      const root = path.resolve(process.cwd(), 'public/uploads');
      if (!item.file.url?.startsWith('/uploads/')) return ctx.notFound();
      const filePath = path.resolve(root, item.file.url.slice('/uploads/'.length));
      if (!filePath.startsWith(root + path.sep)) return ctx.notFound();
      let info;
      try { info = await stat(filePath); } catch { return ctx.notFound('文件已移除'); }
      if (!info.isFile()) return ctx.notFound();
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('X-Content-Type-Options', 'nosniff');
      ctx.set('Content-Disposition', `attachment; filename="download${String(item.file.ext || '').replace(/[^a-zA-Z0-9.]/g, '')}"; filename*=UTF-8''${encodeURIComponent(item.file.name)}`);
      ctx.set('Content-Length', String(info.size));
      ctx.body = createReadStream(filePath); return;
    }
    if (/^https?:\/\//i.test(item.externalUrl || '')) { ctx.redirect(item.externalUrl); return; }
    return ctx.notFound('尚未配置下载文件');
  },
  async products(ctx: any) {
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: await strapi.documents('api::product.product').findMany({
      status: 'published', fields: productFields, populate: { cover: { fields: imageFields } },
      sort: ['sortOrder:asc', 'publishedAt:desc'], limit: 100,
    } as any) };
  },
  async product(ctx: any) {
    const data = await strapi.documents('api::product.product').findFirst({
      status: 'published', filters: { slug: ctx.params.slug },
      fields: [...productFields, 'description', 'highlights', 'ctaLabel', 'ctaUrl'],
      populate: { cover: { fields: imageFields }, gallery: { fields: imageFields } },
    } as any);
    if (!data) return ctx.notFound('产品不存在或尚未发布');
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data };
  },
  async home(ctx: any) {
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: await strapi.documents('api::site-setting.site-setting').findFirst({
      status: 'published',
      fields: ['brandName', 'eyebrow', 'slogan', 'subtitle', 'aboutTitle', 'aboutText', 'contactEmail', 'address'],
      populate: { heroImage: { fields: imageFields } },
    } as any) };
  },
  async posts(ctx: any) {
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: await strapi.documents('api::post.post').findMany({
      status: 'published', fields: postFields, populate: { cover: { fields: imageFields } },
      sort: ['featured:desc', 'publishedAt:desc'], limit: 100,
    } as any) };
  },
  async post(ctx: any) {
    const data = await strapi.documents('api::post.post').findFirst({
      status: 'published', filters: { slug: ctx.params.slug }, fields: [...postFields, 'body'],
      populate: { cover: { fields: imageFields } },
    } as any);
    if (!data) return ctx.notFound('帖子不存在或尚未发布');
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data };
  },
  async jobs(ctx: any) {
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data: await strapi.documents('api::job.job').findMany({
      status: 'published', fields: jobFields, sort: ['sortOrder:asc', 'publishedAt:desc'], limit: 100,
    } as any) };
  },
  async job(ctx: any) {
    const data = await strapi.documents('api::job.job').findFirst({
      status: 'published', filters: { slug: ctx.params.slug }, fields: [...jobFields, 'description', 'applicationEmail'],
    } as any);
    if (!data) return ctx.notFound('岗位不存在或尚未发布');
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { data };
  },
};
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
