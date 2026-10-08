"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import DOMPurify from "isomorphic-dompurify";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, Heading2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface EmailMessageEditorProps {
  subject: string;
  onSubjectChange: (subject: string) => void;
  body: string;
  onBodyChange: (html: string) => void;
  placeholder?: string;
}

export function EmailMessageEditor({ subject, onSubjectChange, body, onBodyChange, placeholder }: EmailMessageEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: body,
    onUpdate: ({ editor }) => {
      onBodyChange(DOMPurify.sanitize(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none min-h-[160px] px-3 py-2 outline-none text-sm leading-relaxed",
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
          "[&_a]:underline [&_a]:text-emerald-400",
          "[&_p]:my-1"
        ),
      },
    },
  });

  if (!editor) return null;

  function toolBtn(active: boolean, onClick: () => void, Icon: typeof Bold, label: string) {
    return (
      <button
        type="button"
        title={label}
        onClick={onClick}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          active ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
        )}
      >
        <Icon className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder={placeholder ? `Asunto — ${placeholder}` : "Asunto del email"}
        className="bg-muted border-border"
      />
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40">
          {toolBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold, "Negrita")}
          {toolBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic, "Cursiva")}
          {toolBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon, "Subrayado")}
          {toolBtn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), Strikethrough, "Tachado")}
          <span className="w-px h-4 bg-border mx-1" />
          {toolBtn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, "Encabezado")}
          {toolBtn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), Quote, "Cita")}
          <span className="w-px h-4 bg-border mx-1" />
          {toolBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List, "Lista")}
          {toolBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, "Lista numerada")}
          <span className="w-px h-4 bg-border mx-1" />
          {toolBtn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), AlignLeft, "Alinear izquierda")}
          {toolBtn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), AlignCenter, "Centrar")}
          {toolBtn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), AlignRight, "Alinear derecha")}
          <span className="w-px h-4 bg-border mx-1" />
          {toolBtn(editor.isActive("link"), () => {
            const url = window.prompt("URL del link:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }, LinkIcon, "Link")}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
