const paragraph = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

async function initializeProducts(strapi: any, store: any) {
  if (await store.get({ key: 'products-v1' })) return;
  const docs = strapi.documents('api::product.product');
  if (!(await docs.findFirst({ status: 'draft', filters: { slug: 'xin-workspace' } }))) {
    const product = await docs.create({ data: {
      title: '向新协作台', slug: 'xin-workspace', tagline: '让团队的好想法，有一个共同的起点。',
      summary: '一个用于演示产品发布流程的协作工具示例，展示产品介绍、功能亮点与咨询入口。',
      highlights: '集中呈现产品的核心价值\n用图文介绍功能与使用场景\n为访客提供清晰的咨询入口',
      version: '示例版 1.0', releaseDate: '2026-10-15', pricing: '演示产品 · 非真实销售',
      description: [paragraph('向新协作台是虚构的示例产品，用于展示运营发布流程，并非已上线的真实服务。'),
        { type: 'heading', level: 2, children: [{ type: 'text', text: '产品介绍' }] },
        paragraph('把这里替换成你们的产品定位、适用人群和核心功能。可以在编辑器中添加标题、段落、列表和图片。'),
        { type: 'heading', level: 2, children: [{ type: 'text', text: '如何发布自己的产品' }] },
        paragraph('在后台「内容管理 → 产品发布」中新建条目，填写名称、简介、产品图和详细介绍。保存后点击发布，刷新网站即可查看。'),
      ], ctaLabel: '咨询产品', ctaUrl: 'mailto:hello@example.com', sortOrder: 1,
    } });
    await docs.publish({ documentId: product.documentId });
  }
  const service = strapi.plugin('content-manager').service('content-types');
  const model = strapi.contentTypes['api::product.product'];
  const config = await service.findConfiguration(model);
  const labels: Record<string, string> = {
    title: '产品名称', slug: '链接标识（英文，如 product-001）', tagline: '产品一句话标语', summary: '产品简介',
    cover: '产品主图', gallery: '产品图集', highlights: '功能亮点（每行一个）', description: '产品详细介绍',
    version: '版本号', releaseDate: '发布日期（展示用途）', pricing: '价格说明', ctaLabel: '按钮文字',
    ctaUrl: '按钮链接（https:// 或 mailto:）', sortOrder: '排列顺序（越小越靠前）',
  };
  for (const [field, label] of Object.entries(labels)) {
    config.metadatas[field].edit.label = label;
    config.metadatas[field].list.label = label;
  }
  config.metadatas.slug.edit.description = '使用唯一的英文或数字标识，例如 product-001；网站用它生成产品详情链接。';
  config.metadatas.releaseDate.edit.description = '仅展示产品日期，不会自动或定时发布。上线和下架由发布按钮控制。';
  config.metadatas.ctaUrl.edit.description = '例如 https://你的产品网站 或 mailto:你的联系邮箱。不需要按钮时留空。';
  config.settings.mainField = 'title';
  config.layouts.list = ['title', 'version', 'releaseDate', 'sortOrder'];
  config.layouts.edit = [
    [{ name: 'title', size: 6 }, { name: 'slug', size: 6 }],
    [{ name: 'tagline', size: 12 }], [{ name: 'summary', size: 12 }],
    [{ name: 'cover', size: 6 }, { name: 'gallery', size: 6 }],
    [{ name: 'highlights', size: 12 }], [{ name: 'description', size: 12 }],
    [{ name: 'version', size: 6 }, { name: 'releaseDate', size: 6 }],
    [{ name: 'pricing', size: 6 }, { name: 'sortOrder', size: 6 }],
    [{ name: 'ctaLabel', size: 6 }, { name: 'ctaUrl', size: 6 }],
  ];
  await service.updateConfiguration(model, config);
  await store.set({ key: 'products-v1', value: true });
  strapi.log.info('产品发布模板已初始化。');
}

async function initializeDownloads(strapi: any, store: any) {
  if (await store.get({ key: 'downloads-v1' })) return;
  const service = strapi.plugin('content-manager').service('content-types');
  const model = strapi.contentTypes['api::product.product'];
  const config = await service.findConfiguration(model);
  config.metadatas.downloads.edit.label = '产品下载版本';
  config.metadatas.downloads.edit.description = '可添加 Windows、macOS、Linux 等多个版本。每项上传文件或填写外部链接；同时填写时优先使用上传文件。';
  if (!config.layouts.edit.flat().some((field: any) => field.name === 'downloads')) config.layouts.edit.push([{ name: 'downloads', size: 12 }]);
  await service.updateConfiguration(model, config);
  const components = strapi.plugin('content-manager').service('components');
  const component = strapi.components['product.download'];
  const componentConfig = await components.findConfiguration(component);
  const labels: Record<string, string> = { label: '下载名称', platform: '适用平台', version: '下载版本号', file: '下载文件（最大 200MB）', externalUrl: '外部下载链接（可替代上传）', notes: '安装或版本说明', checksum: 'SHA256 校验值（可选）' };
  for (const [field, label] of Object.entries(labels)) { componentConfig.metadatas[field].edit.label = label; componentConfig.metadatas[field].list.label = label; }
  componentConfig.settings.mainField = 'label';
  await components.updateConfiguration(component, componentConfig);
  const docs = strapi.documents('api::product.product');
  if (!(await docs.findFirst({ status: 'draft', filters: { slug: 'download-demo' } }))) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'website-download-demo-'));
    try {
      const filepath = path.join(tmp, 'download-demo.txt');
      await writeFile(filepath, '产品下载功能演示\n\n这是一份说明文件，不是安装程序。\n请运营在产品发布后台上传正式安装包，并填写平台、版本号和安装说明后发布。\n');
      const [file] = await strapi.plugin('upload').service('upload').upload({ data: { fileInfo: { name: 'download-demo.txt' } }, files: { filepath, originalFilename: 'download-demo.txt', mimetype: 'text/plain', size: (await stat(filepath)).size } });
      const entry = await docs.create({ data: { title: '产品下载演示', slug: 'download-demo', summary: '用于测试下载流程的说明文件示例，不是实际安装包。', description: [paragraph('这个产品用于演示下载页面。你可以在后台添加多个平台的下载项，上传正式安装包或填写外部下载链接。')], version: '演示版', sortOrder: 99,
        downloads: [{ label: '下载功能说明', platform: '通用 · 文本说明', version: '1.0-demo', file: file.id, notes: '此文件仅供验证下载流程，不包含可执行程序。' }],
      } });
      await docs.publish({ documentId: entry.documentId });
    } finally { await rm(tmp, { recursive: true, force: true }); }
  }
  await store.set({ key: 'downloads-v1', value: true });
}

export default {
  register({ strapi }: { strapi: any }) {
    const types = new Set(['api::site-setting.site-setting', 'api::product.product', 'api::post.post', 'api::job.job']);
    strapi.documents.use(async (context: any, next: any) => {
      const result = await next();
      if (types.has(context.uid) && ['publish', 'unpublish', 'delete'].includes(context.action) && process.env.SITE_BUILD_TOKEN && process.env.SITE_BUILDER_URL) {
        // The builder queues work; publishing does not wait for an Astro build.
        void fetch(`${process.env.SITE_BUILDER_URL}/rebuild`, { method: 'POST', headers: { 'x-site-build-token': process.env.SITE_BUILD_TOKEN }, signal: AbortSignal.timeout(3000) })
          .then(response => { if (!response.ok) throw new Error('Builder unavailable'); })
          .catch(() => strapi.log.warn('静态更新通知暂未送达，构建服务会定期检查已发布内容并重试。'));
      }
      return result;
    });
  },
  async bootstrap({ strapi }: { strapi: any }) {
    const store = strapi.store({ type: 'core', name: 'website-demo' });
    await initializeProducts(strapi, store);
    await initializeDownloads(strapi, store);
    if (await store.get({ key: 'initialized-v1' })) return;

    const settings = strapi.documents('api::site-setting.site-setting');
    if (!(await settings.findFirst({ status: 'draft' }))) {
      const entry = await settings.create({ data: {
        brandName: '向新科技', eyebrow: 'IDEAS INTO IMPACT', slogan: '让好想法，\n发生在明天之前。',
        subtitle: '我们相信，每一次向前，都始于一个值得尝试的想法。\n用设计与技术，把可能变成日常。',
        aboutTitle: '向新而行，\n把事情做好。',
        aboutText: '这里是一个可由运营管理的示例品牌站。我们把品牌表达、公司动态和团队招聘放在一起，让每一次内容更新都更简单。\n\n你可以在后台替换这里的公司介绍，写下你们真实的业务、理念与团队故事。',
        contactEmail: 'hello@example.com', address: '办公地址待填写',
      } });
      await settings.publish({ documentId: entry.documentId });
    }

    const posts = [
      { title: '从一个想法，到一次新的出发', slug: 'a-new-beginning', category: '公司动态', featured: true,
        summary: '欢迎来到向新。用一个简单的内容空间，记录我们的探索、进展和下一步。',
        body: [paragraph('这是一篇示例帖子，帮助你了解发布流程。'), paragraph('真正好的表达，源于真实发生的事情。你可以在这里发布团队动态、产品进展或品牌故事，让访客更了解你们。'), paragraph('运营使用方法：在 Strapi「内容管理 → 推广帖子」中修改标题、摘要与正文，然后点击发布。刷新网站即可看到更新。')] },
      { title: '把复杂留给技术，把简单交给用户', slug: 'design-for-everyday', category: '产品资讯', featured: false,
        summary: '一个关于产品体验的示例话题：从真实需求出发，让每一步都更清晰。',
        body: [paragraph('这是一篇产品资讯示例。'), paragraph('这里可以介绍你的产品、服务或最新功能。建议先讲清楚帮助用户解决什么问题，再补充使用场景和具体操作。'), paragraph('在后台上传封面图片、调整分类和摘要，发布后会同步展示到网站。')] },
      { title: '下一次见面，聊聊你的好想法', slug: 'meet-new-ideas', category: '活动推广', featured: false,
        summary: '用一篇活动帖子，邀请大家了解主题、安排与参与方式。',
        body: [paragraph('这是一篇活动推广示例，尚无真实活动安排。'), paragraph('发布真实活动时，请补充活动时间、地点、参与条件以及报名方式。'), paragraph('活动结束后，你也可以将文章改成活动回顾，或取消发布。')] },
    ];
    for (const data of posts) {
      const service = strapi.documents('api::post.post');
      if (await service.findFirst({ filters: { slug: data.slug }, status: 'draft' })) continue;
      const entry = await service.create({ data });
      await service.publish({ documentId: entry.documentId });
    }

    const jobs = [
      { title: '品牌内容运营', slug: 'brand-content-editor', department: '品牌与增长', location: '上海 / 可协商', employmentType: '全职', sortOrder: 1,
        summary: '把品牌故事讲清楚，让每一条内容都与用户产生连接。' },
      { title: '产品设计师', slug: 'product-designer', department: '设计团队', location: '上海', employmentType: '全职', sortOrder: 2,
        summary: '从问题出发，用清晰的设计连接想法与体验。' },
      { title: '前端开发实习生', slug: 'frontend-intern', department: '技术团队', location: '远程 / 上海', employmentType: '实习', sortOrder: 3,
        summary: '参与真实页面的制作，在协作中积累经验。' },
    ];
    for (const job of jobs) {
      const service = strapi.documents('api::job.job');
      if (await service.findFirst({ filters: { slug: job.slug }, status: 'draft' })) continue;
      const entry = await service.create({ data: { ...job, applicationEmail: 'jobs@example.com', description: [
        paragraph('此岗位为演示内容，并非真实招聘。请运营替换职位信息与收件邮箱后再用于正式网站。'),
        { type: 'heading', level: 2, children: [{ type: 'text', text: '你将参与' }] },
        paragraph(job.summary), paragraph('与团队一起规划工作，持续沟通并推进项目。'),
        { type: 'heading', level: 2, children: [{ type: 'text', text: '我们期待' }] },
        paragraph('有责任心，愿意学习，能够清晰表达并与团队协作。请在后台补充这个岗位的具体技能、经验要求及薪资范围。'),
      ] } });
      await service.publish({ documentId: entry.documentId });
    }

    const labels: Record<string, Record<string, string>> = {
      'api::site-setting.site-setting': { brandName: '品牌名称', eyebrow: '首页英文标语', slogan: '首页主标语（slogan）', subtitle: '首页副标题', heroImage: '首页主视觉图片', aboutTitle: '公司介绍标题', aboutText: '公司介绍正文', contactEmail: '联系邮箱', address: '办公地址' },
      'api::post.post': { title: '帖子标题', slug: '链接标识（英文）', category: '分类（公司动态 / 产品资讯 / 活动推广）', summary: '列表摘要', cover: '封面图片', body: '帖子正文', featured: '优先展示' },
      'api::job.job': { title: '职位名称', slug: '链接标识（英文）', department: '所属部门', location: '工作地点', employmentType: '工作类型（全职 / 兼职 / 实习）', summary: '岗位简介', description: '职责与要求', applicationEmail: '简历接收邮箱', sortOrder: '排列顺序（越小越靠前）' },
    };
    const service = strapi.plugin('content-manager').service('content-types');
    for (const [uid, fields] of Object.entries(labels)) {
      const model = strapi.contentTypes[uid];
      const config = await service.findConfiguration(model);
      for (const [field, label] of Object.entries(fields)) {
        if (config.metadatas[field]) {
          config.metadatas[field].edit.label = label;
          config.metadatas[field].list.label = label;
        }
      }
      config.settings.mainField = uid.includes('site-setting') ? 'brandName' : 'title';
      await service.updateConfiguration(model, config);
    }
    await store.set({ key: 'initialized-v1', value: true });
    strapi.log.info('示例宣传站已初始化：中文编辑表单、帖子、首页设置和招聘岗位。');
  },
};
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
