import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: true });

const linkRenderer = {
  link({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a target="_blank" rel="noopener noreferrer" href="${href}"${titleAttr}>${text}</a>`;
  },
};
marked.use({ renderer: linkRenderer });

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { marked, DOMPurify };
