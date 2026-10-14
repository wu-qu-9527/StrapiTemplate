export default {
  routes: [
    { method: 'GET', path: '/website/snapshot', handler: 'website.snapshot', config: { auth: false } },
    { method: 'GET', path: '/website/products/:slug/downloads', handler: 'website.downloads', config: { auth: false } },
    { method: 'GET', path: '/website/products/:slug/downloads/:id/file', handler: 'website.downloadFile', config: { auth: false } },
    { method: 'GET', path: '/website/products', handler: 'website.products', config: { auth: false } },
    { method: 'GET', path: '/website/products/:slug', handler: 'website.product', config: { auth: false } },
    { method: 'GET', path: '/website/home', handler: 'website.home', config: { auth: false } },
    { method: 'GET', path: '/website/posts', handler: 'website.posts', config: { auth: false } },
    { method: 'GET', path: '/website/posts/:slug', handler: 'website.post', config: { auth: false } },
    { method: 'GET', path: '/website/jobs', handler: 'website.jobs', config: { auth: false } },
    { method: 'GET', path: '/website/jobs/:slug', handler: 'website.job', config: { auth: false } },
  ],
};
