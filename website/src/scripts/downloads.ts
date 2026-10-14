const root = document.querySelector<HTMLElement>('#download-root');
function create(tag: string, text?: string, className?: string) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
async function request(path: string) {
  const response = await fetch('/api/website/' + path, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? '这个产品已下架或不存在，暂时无法下载。' : '下载信息暂时无法获取，请稍后重试。');
  return (await response.json()).data;
}
function error(message: string) {
  if (!root) return;
  const panel = create('div', undefined, 'download-error'); panel.setAttribute('role','alert'); panel.append(create('p',message));
  const retry = create('button','重新获取','button secondary'); retry.addEventListener('click',load); panel.append(retry); root.replaceChildren(panel);
}
function renderCenter(products: any[]) {
  if (!root) return;
  if (!products.length) { root.replaceChildren(create('p','目前没有已发布的产品。','empty')); return; }
  const list = create('div', undefined, 'download-product-list');
  products.forEach(product => {
    const card = create('article',undefined,'download-product');
    card.append(create('span','产品下载 / PRODUCT','section-label'),create('h2',product.title),create('p',product.summary));
    const link = create('a','选择下载版本 ↓','button dark') as HTMLAnchorElement; link.href='/downloads/'+encodeURIComponent(product.slug)+'/'; card.append(link); list.append(card);
  }); root.replaceChildren(list);
}
function renderVersions(data: any) {
  if (!root) return;
  if (!data.downloads.length) { root.replaceChildren(create('div','暂未提供下载文件。如需了解产品，请通过产品页联系团队。','download-empty')); return; }
  const container = create('div');
  const select = document.createElement('select'); select.className='platform-select'; select.id='download-platform';
  const label = create('label','选择平台'); label.setAttribute('for',select.id);
  const all = document.createElement('option'); all.value='all'; all.textContent='全部平台'; select.append(all);
  [...new Set<string>(data.downloads.map((item: any)=>item.platform))].forEach(platform=>{const option=document.createElement('option');option.value=platform;option.textContent=platform;select.append(option);});
  const controls=create('div',undefined,'download-controls');controls.append(label,select);container.append(controls);
  const list=create('div',undefined,'download-versions');
  for(const item of data.downloads){
    const row=create('article',undefined,'download-version');row.dataset.platform=item.platform;
    const meta=create('div',undefined,'download-version-meta');meta.append(create('span',item.platform,'platform-badge'),create('span',`版本 ${item.version}`));
    const info=create('div',undefined,'download-version-copy');info.append(meta,create('h2',item.label));
    if(item.notes)info.append(create('p',item.notes,'download-notes'));
    if(item.filename)info.append(create('p',`${item.filename}${item.size ? ' · '+(item.size>=1000?(item.size/1000).toFixed(1)+' MB':item.size.toFixed(1)+' KB'):''}`,'file-meta'));
    if(item.checksum)info.append(create('p','SHA256: '+item.checksum,'checksum'));
    row.append(info);
    if(typeof item.downloadUrl==='string' && item.downloadUrl.startsWith('/api/website/products/')){
      const link=create('a','立即下载 ↓','button dark') as HTMLAnchorElement;link.href=item.downloadUrl;link.setAttribute('aria-label',`下载 ${item.label} ${item.platform} ${item.version}`);row.append(link);
    }else row.append(create('span','文件准备中','file-meta'));
    list.append(row);
  }
  container.append(list);root.replaceChildren(container);
  select.addEventListener('change',()=>{list.querySelectorAll<HTMLElement>('.download-version').forEach(row=>row.hidden=select.value!=='all'&&row.dataset.platform!==select.value);});
}
async function load(){
  if(!root)return;
  root.replaceChildren(create('p','正在获取最新下载信息…','loading'));
  try{if(root.dataset.mode==='center')renderCenter(await request('products'));else renderVersions(await request('products/'+encodeURIComponent(root.dataset.slug! )+'/downloads'));}catch(err){error(err instanceof Error?err.message:'获取下载信息失败。');}
}
void load();
