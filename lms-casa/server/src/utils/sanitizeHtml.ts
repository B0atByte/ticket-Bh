import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'code', 'pre',
  'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'style'];

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
  // Strip on* event handlers + javascript: URLs (default behaviour of DOMPurify)
};

export function sanitizeRichHtml(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  if (input.trim() === '') return '';
  return DOMPurify.sanitize(input, CONFIG);
}
