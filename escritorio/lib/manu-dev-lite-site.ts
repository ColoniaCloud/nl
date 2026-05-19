type AnyPage = {
  slug: string;
  title?: string;
  content_json?: any;
};

type LiteInput = {
  project: any;
  design: any;
  pages: AnyPage[];
  photos: string[];
  maxPages?: number;
  singlePageAnchors?: boolean;
  template?: string;
};

export type GenerationMode = "next" | "lite" | "lite_plus" | "auto";

export function normalizeGenerationMode(raw: unknown): GenerationMode {
  if (raw === "lite" || raw === "lite_plus" || raw === "next" || raw === "auto") return raw;
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (!value) return "auto";
    if (value === "lite_plus" || value === "liteplus" || value.includes("lite_plus") || value.includes("lite+")) return "lite_plus";
    if (value === "lite" || value.includes("lite")) return "lite";
    if (value === "next" || value.includes("next")) return "next";
    if (value === "auto" || value.includes("auto")) return "auto";
  }
  return "auto";
}

export function resolveEffectiveMode(mode: GenerationMode, pageCount: number): "next" | "lite" | "lite_plus" {
  if (mode === "auto") return "lite_plus";
  return mode;
}

export function validateLiteScope(pages: AnyPage[]) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, reason: "No hay paginas definidas para el proyecto." };
  }
  return { ok: true };
}

export function validateLiteManualScope(pages: AnyPage[]) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, reason: "No hay paginas definidas para el proyecto." };
  }
  return { ok: true };
}

export function validateLiteFallbackScope(pages: AnyPage[]) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, reason: "No hay paginas definidas para el proyecto." };
  }
  if (pages.length > 5) {
    return {
      ok: false,
      reason: "Fallback a Lite soporta hasta 5 paginas.",
    };
  }
  return { ok: true };
}

function slugToFile(slug: string): string {
  if (!slug || slug === "home") return "index.html";
  return `${slug.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}.html`;
}

function asSections(contentJson: any): string[] {
  try {
    if (Array.isArray(contentJson)) return contentJson.map((s) => String(s));
    if (typeof contentJson === "string") {
      const parsed = JSON.parse(contentJson);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    }
  } catch {}
  return [];
}

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitIdeas(raw: string, fallback: string[]): string[] {
  const clean = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return fallback;
  const parts = clean
    .split(/\.|\||;|\n|\r/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
    .slice(0, 6);
  return parts.length > 0 ? parts : fallback;
}

function getIndustryBullets(industry: string): string[] {
  const v = industry.toLowerCase();
  if (v.includes("marketing") || v.includes("agencia")) {
    return ["Estrategia digital", "Captacion de clientes", "Optimzacion de conversion"];
  }
  if (v.includes("salud") || v.includes("clinica") || v.includes("medic")) {
    return ["Atencion profesional", "Seguimiento cercano", "Protocolos claros"];
  }
  if (v.includes("abogado") || v.includes("legal")) {
    return ["Asesoria clara", "Acompanamiento legal", "Respuesta oportuna"];
  }
  if (v.includes("restaurante") || v.includes("comida") || v.includes("bar")) {
    return ["Calidad en cada detalle", "Servicio rapido", "Experiencia memorable"];
  }
  if (v.includes("inmobili") || v.includes("real estate")) {
    return ["Asesoria integral", "Propiedades verificadas", "Gestion transparente"];
  }
  return ["Atencion personalizada", "Calidad consistente", "Resultados medibles"];
}

function getProjectParagraphs(input: LiteInput): string[] {
  const description = String(input.project?.description || "").trim();
  const extra = String(input.project?.extra_content || "").trim();
  const combined = [description, extra].filter(Boolean).join(". ");
  return splitIdeas(combined, [
    "Trabajamos con enfoque practico para resolver prioridades reales del negocio.",
    "Cada entrega se construye para generar traccion comercial y mejorar la experiencia del cliente.",
    "Nuestro proceso combina claridad estrategica, ejecucion ordenada y seguimiento continuo.",
  ]);
}

function getFallbackSectionContent(label: string, input: LiteInput): string {
  const businessName = escapeHtml(input.project?.name || "Tu negocio");
  const industry = escapeHtml(input.project?.industry || "servicios");
  const location = escapeHtml(input.project?.location || "tu zona");
  const audience = escapeHtml(input.project?.audience || "personas y empresas");
  const projectParagraphs = getProjectParagraphs(input).map((p) => escapeHtml(p));
  const industryBullets = getIndustryBullets(String(input.project?.industry || "")).map((b) => escapeHtml(b));
  const key = label.toLowerCase();

  if (key.includes("servicio") || key.includes("producto") || key.includes("solucion")) {
    return `<div class="cards-grid">
  ${industryBullets
    .map(
      (b, idx) => `<article class="card card-soft"><p class="kicker">Propuesta ${idx + 1}</p><h3>${b}</h3><p>Aplicado a ${businessName} con foco en ${audience} en ${location}.</p></article>`
    )
    .join("\n")}
</div>`;
  }

  if (key.includes("beneficio") || key.includes("por que") || key.includes("ventaja")) {
    return `<div class="feature-list">
  <article class="feature-item"><h3>Metodo claro</h3><p>Priorizamos objetivos concretos para avanzar con velocidad y orden.</p></article>
  <article class="feature-item"><h3>Ejecucion cuidada</h3><p>Cada punto del proyecto mantiene consistencia visual y de mensaje.</p></article>
  <article class="feature-item"><h3>Mejora continua</h3><p>Medimos, ajustamos y optimizamos para sostener resultados.</p></article>
</div>`;
  }

  if (key.includes("testimonio") || key.includes("rese") || key.includes("caso")) {
    return `<div class="cards-grid cards-3">
  <article class="card quote"><p>"Excelente experiencia trabajando con ${businessName}."</p><span>Cliente local - ${location}</span></article>
  <article class="card quote"><p>"Se nota el profesionalismo y el foco en resultados reales."</p><span>Empresa del sector ${industry}</span></article>
  <article class="card quote"><p>"Recomendable por claridad, velocidad y acompanamiento."</p><span>Cliente recurrente</span></article>
</div>`;
  }

  if (key.includes("faq") || key.includes("pregunta")) {
    return `<div class="faq-list">
  <details class="card"><summary>Como es el proceso de trabajo?</summary><p>Empezamos con un diagnostico corto, definimos prioridades y ejecutamos por etapas.</p></details>
  <details class="card"><summary>En cuanto tiempo se ven avances?</summary><p>Normalmente en las primeras semanas ya hay entregables visibles y mejoras concretas.</p></details>
  <details class="card"><summary>Puedo ajustar el alcance mas adelante?</summary><p>Si, el plan es flexible para incorporar nuevas necesidades.</p></details>
</div>`;
  }

  if (key.includes("contacto") || key.includes("contact") || key.includes("reserva")) {
    return `<div class="contact-panel">
  <p>Contanos brevemente tu objetivo y te respondemos con una propuesta clara para ${audience}.</p>
  <a class="btn btn-primary" href="#cta-final">Quiero recibir propuesta</a>
</div>`;
  }

  if (key.includes("historia") || key.includes("about") || key.includes("nosotros") || key.includes("equipo")) {
    return `<div class="content-stack">
  <p>${projectParagraphs[0]}</p>
  <p>${projectParagraphs[1] || projectParagraphs[0]}</p>
  <ul>
    <li>Compromiso real con la calidad del servicio</li>
    <li>Comunicacion simple y decisiones con criterio</li>
    <li>Foco permanente en resultados sostenibles</li>
  </ul>
</div>`;
  }

  return `<div class="content-stack"><p>${projectParagraphs[0]}</p><p>${projectParagraphs[1] || projectParagraphs[0]}</p></div>`;
}

function normalizeSectionLabel(raw: string): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;

  if (value === "hero" || value === "inicio") return null;
  if (value.includes("servicio") || value.includes("producto") || value.includes("solucion")) return "Servicios";
  if (value.includes("beneficio") || value.includes("ventaja") || value.includes("porque") || value.includes("por que")) return "Beneficios";
  if (value.includes("testimonio") || value.includes("resena") || value.includes("reseña") || value.includes("caso")) return "Testimonios";
  if (value.includes("historia") || value.includes("nosotros") || value.includes("equipo") || value.includes("about")) return "Nosotros";
  if (value.includes("faq") || value.includes("pregunta")) return "FAQ";
  if (value.includes("articulo") || value.includes("blog") || value.includes("contenido")) return "Blog";
  if (value.includes("contact") || value.includes("formulario") || value.includes("reserva") || value.includes("turno")) return "Contacto";

  // Keep unknown labels but with title-case, so user-provided specific sections survive.
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readProjectSocialLinks(project: any): { name: string; url: string; platform: string }[] {
  try {
    const raw = project?.social_links;
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && x.platform && (x.url || x.value))
      .map((x) => ({
        platform: String(x.platform),
        name: String(x.name || x.platform),
        url: String(x.url || x.value || ""),
      }))
      .filter((x) => /^https?:\/\//i.test(x.url));
  } catch {
    return [];
  }
}

function getIndustryThemeClass(industry: string): string {
  const v = String(industry || "").toLowerCase();
  if (v.includes("b2b") || v.includes("saas") || v.includes("software") || v.includes("tecnolog") || v.includes("empresa") || v.includes("consultor") || v.includes("industrial")) return "theme-b2b-premium";
  if (v.includes("marca personal") || v.includes("personal") || v.includes("coach") || v.includes("creador") || v.includes("portfolio") || v.includes("fotograf") || v.includes("autor") || v.includes("artist") || v.includes("creativ")) return "theme-editorial";
  if (v.includes("marketing") || v.includes("agencia") || v.includes("publicidad")) return "theme-marketing";
  if (v.includes("salud") || v.includes("clinica") || v.includes("medic") || v.includes("dental")) return "theme-health";
  if (v.includes("abogado") || v.includes("legal") || v.includes("estudio jurid")) return "theme-legal";
  if (v.includes("restaurante") || v.includes("comida") || v.includes("gastro") || v.includes("cafe") || v.includes("bar")) return "theme-food";
  if (v.includes("inmobili") || v.includes("real estate") || v.includes("propiedad")) return "theme-realestate";
  if (v.includes("educacion") || v.includes("academia") || v.includes("curso") || v.includes("escuela")) return "theme-education";
  return "theme-professional";
}

function baseLayout(params: {
  title: string;
  businessName: string;
  navLinks: { href: string; label: string }[];
  body: string;
  primaryColor: string;
  accentColor: string;
  themeClass: string;
}) {
  const { title, businessName, navLinks, body, primaryColor, accentColor, themeClass } = params;
  const nav = navLinks
    .map((l) => `<a href="${l.href}" class="nav-link">${l.label}</a>`)
    .join("\n");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/styles.css" />
    <style>:root{--primary:${primaryColor};--accent:${accentColor};}</style>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  </head>
  <body x-data="siteUi()" class="${themeClass}">
    <header class="site-header">
      <div class="container header-row">
        <a class="brand" href="/index.html">${businessName}</a>
        <button class="menu-btn" @click="open = !open">Menu</button>
        <nav class="desktop-nav">${nav}</nav>
      </div>
      <nav class="mobile-nav" x-show="open" x-transition>${nav}</nav>
    </header>
    ${body}
    <footer class="site-footer">
      <div class="container footer-row">
        <p>${businessName} - Sitio Lite</p>
        <p id="year"></p>
      </div>
    </footer>
    <script src="/assets/app.js"></script>
  </body>
</html>`;
}

function buildHomePage(input: LiteInput, navLinks: { href: string; label: string }[]) {
  const businessName = input.project?.name || "Negocio";
  const industry = input.project?.industry || "servicios";
  const description = input.project?.description || "Soluciones profesionales para tu necesidad.";
  const heroImage = input.photos[0] || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80";

  const body = `
<main>
  <section class="hero" style="background-image:url('${heroImage}')">
    <div class="overlay"></div>
    <div class="container hero-content">
      <p class="eyebrow">${industry}</p>
      <h1>${businessName}</h1>
      <p>${description}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#contacto">Quiero una propuesta</a>
        <a class="btn btn-ghost" href="/contacto.html">Contacto</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container grid-3">
      <article class="card"><h3>Rapidez</h3><p>Implementacion enfocada en resultados.</p></article>
      <article class="card"><h3>Calidad</h3><p>Diseno moderno y claro para convertir mejor.</p></article>
      <article class="card"><h3>Acompanamiento</h3><p>Soporte para evolucionar tu presencia digital.</p></article>
    </div>
  </section>

  <section class="section section-alt" id="contacto">
    <div class="container contact-box">
      <h2>Hablemos de tu proyecto</h2>
      <p>Estamos listos para ayudarte a lanzar una presencia web efectiva.</p>
      <a class="btn btn-primary" href="/contacto.html">Ir a contacto</a>
    </div>
  </section>
</main>`;

  return {
    path: "index.html",
    content: baseLayout({
      title: `${businessName} | Inicio`,
      businessName,
      navLinks,
      body,
      primaryColor: input.design?.primary_color || "#1a365d",
      accentColor: input.design?.accent_color || "#0ea5e9",
      themeClass: getIndustryThemeClass(industry),
    }),
  };
}

function toAnchorId(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base || "seccion";
}

function buildLandingAnchorsPage(input: LiteInput) {
  const businessName = input.project?.name || "Negocio";
  const industry = input.project?.industry || "servicios";
  const description = input.project?.description || "Soluciones profesionales para tu necesidad.";
  const heroImage = input.photos[0] || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80";
  const themeClass = getIndustryThemeClass(industry);

  const sourceSections = Array.from(
    new Set(
      input.pages
        .flatMap((p) => asSections(p.content_json))
        .map((s) => normalizeSectionLabel(String(s)))
        .filter((s): s is string => Boolean(s))
    )
  );
  const fallbackSections = ["Servicios", "Beneficios", "Testimonios", "FAQ", "Contacto"];
  const sections = (sourceSections.length > 0 ? sourceSections : fallbackSections).slice(0, 8);
  const socialLinks = readProjectSocialLinks(input.project);
  const lead = escapeHtml((getProjectParagraphs(input)[0] || "Soluciones profesionales para tu necesidad.").slice(0, 180));

  const navLinks = [
    { href: "#inicio", label: "Inicio" },
    ...sections.map((s) => ({ href: `#${toAnchorId(s)}`, label: s })),
    ...(socialLinks.length > 0 ? [{ href: "#redes", label: "Redes" }] : []),
  ];

  const sectionBlocks = sections
    .map((s) => {
      const id = toAnchorId(s);
      return `<section id="${id}" class="section section-block"><div class="container"><div class="section-head"><h2>${escapeHtml(s)}</h2><p>${lead}</p></div>${getFallbackSectionContent(s, input)}</div></section>`;
    })
    .join("\n");

  const socialBlock = socialLinks.length > 0
    ? `<section id="redes" class="section section-block"><div class="container"><div class="section-head"><h2>Redes sociales</h2><p>Conecta con ${escapeHtml(businessName)} y sigue nuestras novedades.</p></div><div id="socialLinks" class="social-links"></div></div></section>`
    : "";

  const body = `
<main id="inicio">
  <section class="hero">
    <img class="hero-image" src="${heroImage}" alt="${escapeHtml(businessName)}" />
    <div class="overlay"></div>
    <div class="container hero-content">
      <p class="eyebrow">${escapeHtml(industry)}</p>
      <h1>${escapeHtml(businessName)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="hero-points">${getIndustryBullets(String(input.project?.industry || ""))
        .slice(0, 3)
        .map((b) => `<span>${escapeHtml(b)}</span>`)
        .join("")}</div>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#${toAnchorId(sections[0] || "contacto")}">Conocer mas</a>
        <a class="btn btn-ghost" href="#cta-final">Contacto</a>
      </div>
    </div>
  </section>

  ${sectionBlocks}
  ${socialBlock}

  <section id="cta-final" class="section section-alt">
    <div class="container contact-box">
      <h2>Hablemos de tu proyecto</h2>
      <p>En menos de 24 horas podemos proponerte un siguiente paso claro para ${escapeHtml(businessName)}.</p>
      <a class="btn btn-primary" href="#inicio">Volver arriba</a>
    </div>
  </section>
</main>`;

  return {
    path: "index.html",
    content: baseLayout({
      title: `${businessName} | Landing`,
      businessName,
      navLinks,
      body,
      primaryColor: input.design?.primary_color || "#1a365d",
      accentColor: input.design?.accent_color || "#0ea5e9",
      themeClass,
    }),
  };
}

function buildInnerPage(
  input: LiteInput,
  page: AnyPage,
  navLinks: { href: string; label: string }[]
) {
  const businessName = input.project?.name || "Negocio";
  const industry = input.project?.industry || "servicios";
  const title = page.title || page.slug;
  const sections = asSections(page.content_json);

  const sectionBlocks = (sections.length > 0 ? sections : ["Informacion", "Beneficios", "Contacto"])
    .slice(0, 6)
    .map(
      (s) => `<article class="card"><h3>${s}</h3><p>Contenido de ${title} adaptado al negocio ${businessName}.</p></article>`
    )
    .join("\n");

  const body = `
<main class="section">
  <div class="container">
    <h1>${title}</h1>
    <p class="lead">Pagina optimizada en modo Lite para una experiencia rapida y estable.</p>
    <div class="grid-2">${sectionBlocks}</div>
  </div>
</main>`;

  return {
    path: slugToFile(page.slug),
    content: baseLayout({
      title: `${businessName} | ${title}`,
      businessName,
      navLinks,
      body,
      primaryColor: input.design?.primary_color || "#1a365d",
      accentColor: input.design?.accent_color || "#0ea5e9",
      themeClass: getIndustryThemeClass(industry),
    }),
  };
}

function buildStyles(templateId?: string) {
  // Delegate to the template system — defaults to "professional"
  const { buildTemplateStyles } = require("./manu-dev-lite-templates");
  return buildTemplateStyles(templateId || "professional");
}

function buildClientScript() {
  return `function siteUi(){return {open:false}};
document.getElementById('year')&&(document.getElementById('year').textContent=''+new Date().getFullYear());
(function(){
  var holder=document.getElementById('socialLinks');
  if(!holder)return;
  fetch('/assets/social-links.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():[]}).then(function(items){
    if(!Array.isArray(items)||items.length===0){holder.innerHTML='<p class="lead">Todavia no hay redes configuradas.</p>';return;}
    holder.innerHTML=items.map(function(item){
      var name=String(item.name||item.platform||'Red');
      var url=String(item.url||'#');
      return '<a class="social-chip" href="'+url+'" target="_blank" rel="noreferrer noopener">'+name+'</a>';
    }).join('');
  }).catch(function(){holder.innerHTML='<p class="lead">No se pudieron cargar las redes.</p>';});
})();`;
}

function buildSocialLinksJson(input: LiteInput) {
  const links = readProjectSocialLinks(input.project);
  return JSON.stringify(links, null, 2);
}

function buildDockerfileLite() {
  return `FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
EXPOSE 3000`;
}

function buildNginxConf() {
  return `server {
  listen 3000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}`;
}

export function buildLiteSiteFiles(input: LiteInput) {
  const templateId = input.template || "professional";

  if (input.singlePageAnchors) {
    return [
      buildLandingAnchorsPage(input),
      { path: "assets/styles.css", content: buildStyles(templateId) },
      { path: "assets/app.js", content: buildClientScript() },
      { path: "assets/social-links.json", content: buildSocialLinksJson(input) },
      { path: "Dockerfile", content: buildDockerfileLite() },
      { path: "nginx.conf", content: buildNginxConf() },
    ];
  }

  const maxPages = Number.isFinite(input.maxPages as number) && (input.maxPages as number) > 0
    ? Math.floor(input.maxPages as number)
    : 3;

  const home = input.pages.find((p) => p.slug === "home") || input.pages[0];
  const others = input.pages.filter((p) => p !== home).slice(0, Math.max(0, maxPages - 1));

  const navLinks = [home, ...others].map((p) => ({
    href: `/${slugToFile(p.slug)}`,
    label: p.title || (p.slug === "home" ? "Inicio" : p.slug),
  }));

  const files = [
    buildHomePage(input, navLinks),
    ...others.map((p) => buildInnerPage(input, p, navLinks)),
    { path: "assets/styles.css", content: buildStyles(templateId) },
    { path: "assets/app.js", content: buildClientScript() },
    { path: "assets/social-links.json", content: buildSocialLinksJson(input) },
    { path: "Dockerfile", content: buildDockerfileLite() },
    { path: "nginx.conf", content: buildNginxConf() },
  ];

  return files;
}
