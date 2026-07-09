import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import DOMPurify from 'dompurify';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'blockquote', 'code', 'pre',
    'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  minHeight = 160,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const rawHtml = editor.getHTML();
      // Sanitize on every change — defends against pasted XSS
      onChange(sanitizeHtml(rawHtml));
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none px-3 py-2 rounded-b-md bg-background',
        style: `min-height: ${minHeight}px`,
        'data-placeholder': placeholder ?? '',
      },
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
        กำลังโหลด editor…
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card focus-within:ring-2 focus-within:ring-primary">
      {!readOnly && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean, onClick: () => void, label: string, Icon: typeof Bold) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active && 'bg-accent text-foreground',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  const addLink = () => {
    const url = window.prompt('ลิงก์ (URL) — พิมพ์ remove เพื่อลบ');
    if (!url) return;
    if (url === 'remove') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL รูปภาพ');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'ตัวหนา', Bold)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'ตัวเอียง', Italic)}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'ขีดทับ', Strikethrough)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'หัวข้อ 1', Heading1)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'หัวข้อ 2', Heading2)}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'หัวข้อ 3', Heading3)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'รายการแบบ bullet', List)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'รายการแบบตัวเลข', ListOrdered)}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'อ้างอิง', Quote)}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'บล็อกโค้ด', Code)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive('link'), addLink, 'ลิงก์', LinkIcon)}
      {btn(false, addImage, 'รูปภาพ', ImageIcon)}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn(false, () => editor.chain().focus().undo().run(), 'ย้อนกลับ', Undo)}
      {btn(false, () => editor.chain().focus().redo().run(), 'ทำซ้ำ', Redo)}
    </div>
  );
}

interface ReadOnlyProps {
  html: string;
  className?: string;
}

export function RichTextView({ html, className }: ReadOnlyProps) {
  if (!html) return null;
  const clean = sanitizeHtml(html);
  return (
    <div
      className={['prose prose-sm max-w-none', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
