import fs from 'node:fs';
import path from 'node:path';
export const content = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.content/snapshot.json'), 'utf8'));
export const home = content.home;
export const brand = home?.brandName || '品牌宣传站';
export const productUrl = (slug: string) => `/products/${encodeURIComponent(slug)}/`;
export const downloadsUrl = (slug: string) => `/downloads/${encodeURIComponent(slug)}/`;
export function safeUrl(value: string | null | undefined, image = false) {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return (image ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:']).includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function blocks(nodes: any[] = []): string {
  return nodes.map(node => {
    if (node.type === 'text') {
      let text = escape(node.text);
      for (const [mark, tag] of [['bold', 'strong'], ['italic', 'em'], ['underline', 'u'], ['strikethrough', 's'], ['code', 'code']]) if (node[mark]) text = `<${tag}>${text}</${tag}>`;
      return text;
    }
    if (node.type === 'image') { const url = safeUrl(node.image?.url, true); return url ? `<img src="${escape(url)}" alt="${escape(node.image.alternativeText)}" loading="lazy">` : ''; }
    const children = blocks(node.children || []);
    if (node.type === 'link') { const href = safeUrl(node.url); return href ? `<a href="${escape(href)}" rel="noopener noreferrer">${children}</a>` : children; }
    const tag = ({ paragraph: 'p', heading: `h${Math.max(2, Math.min(6, Number(node.level) || 2))}`, list: node.format === 'ordered' ? 'ol' : 'ul', 'list-item': 'li', quote: 'blockquote', code: 'pre' } as Record<string, string>)[node.type] || 'p';
    return `<${tag}>${children}</${tag}>`;
  }).join('');
}
