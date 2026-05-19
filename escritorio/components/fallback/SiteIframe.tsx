"use client";

import { useMemo } from "react";

export default function SiteIframe({ html }: { html: string }) {
  const srcDoc = useMemo(() => {
    if (html && html.trim()) return html;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Preview</title>
<style>
  body{margin:0;font-family:system-ui;background:#0b0b0d;color:#fff}
  .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:560px;border:1px solid #222;border-radius:16px;padding:20px;background:#0f0f12}
  h2{margin:0 0 8px 0}
  p{margin:0;opacity:.8;line-height:1.4}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h2>Esperando instrucción…</h2>
      <p>Escribí en el chat lo que querés construir y voy a generar el sitio automáticamente.</p>
    </div>
  </div>
</body>
</html>`;
  }, [html]);

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="h-[75dvh] bg-black">
        <iframe
          title="site-preview"
          srcDoc={srcDoc}
          className="w-full h-full"
          sandbox="allow-scripts allow-forms allow-same-origin"
        />
      </div>
    </div>
  );
}
