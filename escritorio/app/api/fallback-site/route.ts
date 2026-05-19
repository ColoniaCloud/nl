import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs"; // importante: el SDK corre en Node

type ReqBody = {
  prompt: string;              // lo que el usuario quiere
  brandName?: string;          // opcional (ej: "Cafe Roma")
  styleHint?: string;          // opcional (ej: "minimal, modern")
};

function buildPrompt(input: ReqBody) {
  const brand = input.brandName?.trim() || "";
  const style = input.styleHint?.trim() || "";

  return `
Generá UN (1) documento HTML completo para renderizar dentro de un <iframe srcDoc>.

REQUISITOS ESTRICTOS:
- Devolvé SOLO HTML (sin markdown, sin backticks, sin explicaciones).
- Debe ser un HTML completo: <!doctype html><html>...<body>...</body></html>
- Usar React 18 UMD + ReactDOM 18 UMD + Babel standalone vía CDN (unpkg).
- El código React debe estar en <script type="text/babel"> y renderizar en <div id="root"></div>.
- No usar imports/exports.
- No hacer fetch ni llamadas a red (excepto los CDNs de react/react-dom/babel).
- Debe verse prolijo con CSS en <style> (sin Tailwind).
- Incluir secciones: Hero, Beneficios/Features, Sección de prueba social (testimonios), CTA, FAQ, Footer.
- Copy en español. Diseño responsive.
- Evitar imágenes externas: si necesitás, usá placeholders CSS (gradientes, bloques).

CONTEXTO:
- Marca (si aplica): ${brand || "(no especificada)"}
- Estilo (si aplica): ${style || "(no especificado)"}
- Pedido del usuario: ${JSON.stringify(input.prompt)}

Ahora devolvé SOLO el HTML:
`.trim();
}

/**
 * Extrae texto de la respuesta del SDK de forma tolerante a cambios.
 * (El SDK expone generateContent; la forma del response puede variar por versión.)
 */
function extractText(resp: any): string {
  if (!resp) return "";
  if (typeof resp.text === "string") return resp.text;
  if (typeof resp.text === "function") return resp.text();
  // Fallback: candidatos
  const c0 = resp.candidates?.[0];
  const parts = c0?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p: any) => p?.text ?? "").join("");
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    if (!body?.prompt || body.prompt.trim().length < 3) {
      return NextResponse.json({ error: "prompt requerido" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Falta GOOGLE_API_KEY" }, { status: 500 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const ai = new GoogleGenAI({ apiKey });

    // generateContent con timeout de 30s para evitar cuelgues indefinidos
    const geminiWithTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([promise, new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms)
      )]);

    const resp = await geminiWithTimeout(ai.models.generateContent({
      model,
      contents: buildPrompt(body),
      config: {
        // suficiente para un HTML completo
        maxOutputTokens: 3200,
        temperature: 0.7,
      },
    }), 30_000);

    const html = extractText(resp).trim();

    function injectErrorOverlay(doc: string) {
  // agrega un overlay de errores si algo truena en runtime
  const overlay = `
<script>
(function(){
  function show(msg){
    try{
      var el=document.createElement('div');
      el.style.cssText="position:fixed;inset:0;z-index:99999;background:#0b0b0d;color:#fff;font-family:ui-monospace,Menlo,monospace;padding:16px;overflow:auto";
      el.innerHTML="<h2 style='margin:0 0 8px 0'>Preview error</h2><pre style='white-space:pre-wrap;opacity:.9'>"+String(msg).slice(0,5000)+"</pre>";
      document.body.innerHTML="";
      document.body.appendChild(el);
    }catch(e){}
  }
  window.addEventListener('error', function(e){ show(e.error && e.error.stack ? e.error.stack : e.message); });
  window.addEventListener('unhandledrejection', function(e){ show(e.reason && e.reason.stack ? e.reason.stack : e.reason); });
})();
</script>
`;

  // lo inyecta antes de </body> si existe, sino al final
  if (doc.toLowerCase().includes("</body>")) {
    return doc.replace(/<\/body>/i, overlay + "\n</body>");
  }
  return doc + "\n" + overlay;
}

const safeHtml = injectErrorOverlay(html);
return NextResponse.json({ html: safeHtml });


    // Validaciones mínimas para que el iframe no explote
    const lower = html.toLowerCase();
    const looksLikeHtml =
    lower.includes("<!doctype html") || (lower.includes("<html") && lower.includes("</html>"));

    if (!looksLikeHtml) {
    return NextResponse.json(
    {
      error: "Gemini devolvió contenido inválido (no parece HTML).",
      raw: html.slice(0, 2000),
    },
    { status: 502 }
  );
}

    return NextResponse.json({ html });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error en fallback-site", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
