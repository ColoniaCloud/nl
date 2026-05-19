"use client";

export default function IframeView({ title, src }: { title: string; src: string }) {
  return (
    <div className="h-full w-full">
      <iframe title={title} src={src} className="h-full w-full" style={{ border: 0 }} />
    </div>
  );
}
