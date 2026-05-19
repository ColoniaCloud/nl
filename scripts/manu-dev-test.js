const { GoogleGenAI } = require("@google/genai");
const mysql = require("mysql2/promise");
const fs = require("fs/promises");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const SITES_DIR = "/opt/docker-apps/sites";
const BUILD_SCRIPT = "/opt/docker-apps/scripts/manu-dev-build.sh";
const SUBDOMAIN = process.env.MANU_DEV_TEST_SUBDOMAIN || "test-restaurante";

async function main() {
  console.log("=== MANU DEV END-TO-END TEST ===\n");

  // 1. DB connection
  console.log("[1] Connecting to MySQL...");
  const pool = mysql.createPool({
    host: "mysql_db", port: 3306,
    user: "nlevel", password: "NLevel@360",
    database: "manu_dev",
  });

  const [prows] = await pool.execute(
    `SELECT p.*, d.primary_color, d.secondary_color, d.accent_color
     FROM md_projects p
     LEFT JOIN md_design d ON d.project_id = p.id
     WHERE p.subdomain = ?`,
    [SUBDOMAIN]
  );
  const project = prows[0];
  if (!project) throw new Error("Project not found");
  console.log("    Project:", project.name, "| Industry:", project.industry);

  const [pgrows] = await pool.execute(
    "SELECT * FROM md_pages WHERE project_id = ?",
    [project.id]
  );
  console.log("    Pages:", pgrows.map((p) => p.title).join(", "));

  // 2. Unsplash
  console.log("\n[2] Fetching Unsplash photos...");
  const key = process.env.UNSPLASH_ACCESS_KEY;
  let photos = [];
  if (key) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=restaurant+argentina&count=4&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${key}` } }
      );
      const data = await res.json();
      photos = data.map((p) => p.urls.regular + "&w=1200&q=80");
      console.log("    Got", photos.length, "photos");
    } catch (e) {
      console.log("    Unsplash skip:", e.message);
    }
  }

  // 3. Gemini code generation
  console.log("\n[3] Calling Gemini to generate site code...");
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("Missing GOOGLE_API_KEY/GEMINI_API_KEY for test generation");
  }
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const photoLines = photos.length
    ? "\nFOTOS UNSPLASH DISPONIBLES:\n" + photos.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "";

  const pageList = pgrows
    .map((p) => {
      const s = JSON.parse(p.content_json || "[]");
      return `- ${p.title} (slug: ${p.slug}, secciones: ${s.join(", ")})`;
    })
    .join("\n");

  const prompt = `Genera un sitio web Next.js 15 para "${project.name}" (${project.industry}).
Descripción: ${project.description}
Color primario: ${project.primary_color || "#8B0000"}, secundario: ${project.secondary_color || "#F5F5DC"}
Páginas: ${pageList}
${photoLines}

USA ESTE FORMATO para cada archivo:
===FILE:ruta/archivo===
[contenido]
===END===

Archivos requeridos:
===FILE:package.json===
{"name":"site","version":"1.0.0","scripts":{"build":"next build","start":"next start"},"dependencies":{"next":"15.0.0","react":"18.3.1","react-dom":"18.3.1","lucide-react":"^0.460.0"}}
===END===
===FILE:next.config.js===
module.exports = {}
===END===
===FILE:Dockerfile===
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","start"]
===END===
===FILE:app/layout.jsx===
[nav + footer, links a páginas]
===END===
===FILE:app/globals.css===
[:root con --color-primary, responsive]
===END===
===FILE:app/page.jsx===
[hero + secciones del negocio, usa <img> para fotos Unsplash]
===END===

CSS puro (sin Tailwind). .jsx sin TypeScript. Contenido real en español.`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { maxOutputTokens: 8192, temperature: 0.3 },
  });

  const raw = resp.text ?? "";
  console.log("    Response length:", raw.length, "chars");

  // Parse file delimiter format
  const files = [];
  const regex = /===FILE:([^\n]+)===\n([\s\S]*?)===END===/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].replace(/\n$/, "") });
  }
  if (files.length === 0) throw new Error("No files parsed from response");
  const parsed = { files };
  console.log("    Files generated:", parsed.files.map((f) => f.path).join(", "));

  // 4. Write files
  console.log("\n[4] Writing files to", SITES_DIR + "/" + SUBDOMAIN);
  const siteDir = path.join(SITES_DIR, SUBDOMAIN);
  await fs.mkdir(siteDir, { recursive: true });

  for (const file of parsed.files) {
    const safePath = path.normalize(file.path).replace(/^(\.\.\/)+/, "");
    const fullPath = path.join(siteDir, safePath);
    if (!fullPath.startsWith(siteDir)) {
      console.log("    SKIP (path traversal):", file.path);
      continue;
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, "utf8");
    console.log("    Written:", file.path);
  }

  // 5. Docker build + run
  console.log("\n[5] Running build script...");
  try {
    const { stdout, stderr } = await execAsync(`sh ${BUILD_SCRIPT} ${SUBDOMAIN}`, {
      timeout: 300000,
    });
    const containerId = stdout.trim().split("\n").pop() || "";
    console.log("    Container ID:", containerId);

    // 6. Update DB
    await pool.execute(
      "UPDATE md_projects SET status = 'active', container_id = ?, site_url = ? WHERE id = ?",
      [containerId, `https://${SUBDOMAIN}.nl360.site`, project.id]
    );
    console.log("    DB updated: status=active");
    console.log("\n=== SUCCESS ===");
    console.log("Site URL: https://" + SUBDOMAIN + ".nl360.site");
  } catch (e) {
    console.error("    BUILD FAILED:", e.message);
    console.error(e.stderr || "");
  }

  await pool.end();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
