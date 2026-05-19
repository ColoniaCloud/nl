import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUserId } from "@/app/api/nubia/projects/route";
import {
  getProjectById,
  getDesign,
  getPaymentConfig,
  upsertDesign,
  updateProjectStatus,
} from "@/lib/nubia/db-nubia";
import { buildStoreConfig, copyTemplate, writeStoreConfig, queueNubiaBuild, fetchUnsplashPhotos } from "@/lib/nubia/nubia-deploy";

export const runtime = "nodejs";
const COOKIE_NAME = process.env.NL360_JWT_COOKIE_NAME || "nl360_jwt";

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
  }
  const userId = await getUserId(token);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Token invalido" }), { status: 401 });
  }

  const { project_id } = await req.json();
  if (!project_id) {
    return new Response(JSON.stringify({ error: "project_id requerido" }), { status: 400 });
  }

  const project = await getProjectById(project_id, userId);
  if (!project) {
    return new Response(JSON.stringify({ error: "Proyecto no encontrado" }), { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(sseMessage(data)));
      }

      // Keepalive
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* closed */ }
      }, 10000);

      try {
        send({ type: "status", message: "Preparando tienda..." });

        // Load design
        let design = await getDesign(project_id);
        if (!design) {
          await upsertDesign(project_id, {});
          design = await getDesign(project_id);
        }

        const payConfig = await getPaymentConfig(project_id);

        send({ type: "status", message: "Buscando imagenes para tu tienda..." });

        // Fetch Unsplash images based on industry
        const query = project.industry || project.name;
        const photos = await fetchUnsplashPhotos(query, 3);
        const images = {
          hero: photos[0] || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80",
          collection: photos[1] || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80",
          banner: photos[2] || "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&q=80",
        };

        send({ type: "status", message: "Configurando template..." });

        // Build store config
        const storeConfig = buildStoreConfig(project, design!, payConfig, design?.tagline || project.name, images);

        send({ type: "status", message: `Copiando template "${project.template}"...` });

        // Copy template files
        await copyTemplate(project.template, project.subdomain);

        // Write config
        writeStoreConfig(project.subdomain, storeConfig);

        send({ type: "status", message: "Iniciando build de Docker..." });

        await updateProjectStatus(project_id, "building", { build_started_at: new Date().toISOString() });

        const { queuePosition, run } = queueNubiaBuild({
          subdomain: project.subdomain,
          projectId: project_id,
        });

        if (queuePosition > 1) {
          send({ type: "status", message: `En cola (posicion ${queuePosition})...` });
        }

        const result = await run;

        const siteUrl = `https://${project.subdomain}.nl360.site`;
        send({ type: "done", site_url: siteUrl, project_id });
      } catch (err: any) {
        const msg = err?.message || "Error desconocido";
        console.error("[nubia/create-store]", msg);
        await updateProjectStatus(project_id, "error", { last_build_error: msg });
        send({ type: "error", message: msg });
      } finally {
        clearInterval(keepalive);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
