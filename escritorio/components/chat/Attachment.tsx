import type { ChatAttachment } from "./types";

export default function Attachment({ item }: { item: ChatAttachment }) {
  if (item.type === "image") {
    return (
      <figure className="overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.title} className="h-auto w-full" />
        <figcaption className="px-3 py-2 text-xs text-muted-foreground">
          {item.title}
        </figcaption>
      </figure>
    );
  }

  if (item.type === "video") {
    return (
      <div className="overflow-hidden rounded-lg border">
        <video controls className="w-full">
          <source src={item.url} />
          Tu navegador no soporta video.
        </video>
        <div className="px-3 py-2 text-xs text-muted-foreground">{item.title}</div>
      </div>
    );
  }

  // doc
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border p-3 hover:bg-muted/40 transition"
    >
      <div className="text-sm font-medium">{item.title}</div>
      <div className="text-xs text-muted-foreground">Abrir documento →</div>
    </a>
  );
}
