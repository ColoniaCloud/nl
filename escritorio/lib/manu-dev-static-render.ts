// ─── Static dynamic-page renderer ──────────────────────────────────────────────
// Renders Store and Blog pages for lite/lite_plus sites deterministically from the
// database (NO LLM), reusing the site's existing layout shell (head + header +
// footer + scripts) so colors, fonts and navigation match the rest of the site.
//
// Used by the rebuild flow: on every rebuild we regenerate tienda.html, blog.html
// and blog-<slug>.html from the current DB state. Because it is deterministic, the
// marketing pages of the site are never altered.

import fs from "fs/promises";
import path from "path";

const SITES_DIR = "/opt/docker-apps/sites";

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape text and turn blank-line-separated blocks into <p>, single \n into <br>. */
function richText(s: unknown): string {
  const text = String(s ?? "").trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map(block => `<p class="mb-4 leading-relaxed text-black/70">${esc(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

function parseJsonArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fmtPrice(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return "";
  return `$${n.toLocaleString("es-AR")}`;
}

function safeSlug(slug: string): string {
  return String(slug || "").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}

// ── Layout shell ─────────────────────────────────────────────────────────────

interface Shell {
  head: string; // <!doctype>..<body ..> .. </header>
  tail: string; // <footer> .. </html>
}

/** Extract the reusable layout (everything up to </header>, and from <footer>). */
function extractShell(html: string): Shell | null {
  const lower = html.toLowerCase();
  const headerEnd = lower.indexOf("</header>");
  const footerStart = lower.lastIndexOf("<footer");
  if (headerEnd === -1 || footerStart === -1 || footerStart < headerEnd) return null;
  return {
    head: html.slice(0, headerEnd + "</header>".length),
    tail: html.slice(footerStart),
  };
}

function assemblePage(shell: Shell, mainInner: string, title?: string): string {
  let head = shell.head;
  if (title) {
    head = head.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  }
  return `${head}\n<main class="flex-1">\n${mainInner}\n</main>\n${shell.tail}`;
}

// ── Navigation link injection (best-effort, idempotent) ───────────────────────

interface NavLink {
  href: string;
  label: string;
}

/** Insert links into the desktop <nav> and the mobile menu, cloning sibling styling. */
export function injectNavLinks(html: string, links: NavLink[]): string {
  if (links.length === 0) return html;
  let out = html;

  // Desktop nav: clone the class of the first nav anchor and insert before </nav>.
  const navMatch = out.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
  if (navMatch) {
    const navInner = navMatch[1];
    const sampleClass = navInner.match(/<a\b[^>]*class="([^"]*)"/i)?.[1] ?? "";
    const toAdd = links.filter(l => !new RegExp(`href="${l.href}"`).test(navInner));
    if (toAdd.length > 0) {
      const inject = toAdd
        .map(l => `<a href="${l.href}" class="${sampleClass}">${esc(l.label)}</a>`)
        .join("\n          ");
      out = out.replace(/<\/nav>/i, `  ${inject}\n        </nav>`);
    }
  }

  // Mobile menu: clone a "mobile" anchor's class and insert after the last one.
  const mobileAnchors = [...out.matchAll(/<a\b[^>]*class="([^"]*mobile[^"]*)"[^>]*>[\s\S]*?<\/a>/gi)];
  if (mobileAnchors.length > 0) {
    const last = mobileAnchors[mobileAnchors.length - 1];
    const sampleClass = last[1];
    // Idempotency scoped to the mobile menu only (desktop may already have the link).
    const mobileText = mobileAnchors.map(m => m[0]).join("");
    const toAdd = links.filter(l => mobileText.indexOf(`href="${l.href}"`) === -1);
    if (toAdd.length > 0) {
      const inject = toAdd
        .map(l => `\n        <a href="${l.href}" class="${sampleClass}">${esc(l.label)}</a>`)
        .join("");
      const insertAt = (last.index ?? 0) + last[0].length;
      out = out.slice(0, insertAt) + inject + out.slice(insertAt);
    }
  }

  return out;
}

// ── Footer social links (deterministic update) ────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Host fragment used to locate an existing social anchor for each platform.
const SOCIAL_HOSTS: Record<string, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
  tiktok: ["tiktok.com"],
  whatsapp: ["wa.me"],
  youtube: ["youtube.com"],
  twitter: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
  pinterest: ["pinterest.com"],
  telegram: ["t.me"],
  email: ["mailto:"],
};

export interface EnrichedSocial {
  platform: string;
  url: string;
  value?: string;
}

/**
 * Update the social links baked into a page's footer:
 *  - rewrite the href of anchors matching an enabled platform's host
 *  - remove social icon anchors (those containing an <svg>) for disabled platforms
 *
 * Adding a brand-new platform that was not present at generation time is NOT done
 * here (would need its SVG icon); that requires a full regeneration.
 */
export function updateFooterSocialLinks(html: string, links: EnrichedSocial[]): string {
  let out = html;
  const active = new Set(links.map(l => l.platform));

  // 1) Update hrefs for enabled platforms.
  for (const link of links) {
    const hosts = SOCIAL_HOSTS[link.platform];
    if (!hosts) continue;
    const newUrl = link.platform === "email" ? `mailto:${link.value ?? link.url}` : link.url;
    const safeHref = `href="${esc(newUrl)}"`;
    for (const h of hosts) {
      const re = new RegExp(`href="[^"]*${escapeRegex(h)}[^"]*"`, "g");
      out = out.replace(re, () => safeHref);
    }
  }

  // 2) Remove social anchors for platforms no longer enabled. Generated sites use
  //    either SVG icons or text links, but both carry a "social" class — require one
  //    of those signals so we never strip an unrelated link (e.g. a contact mailto).
  for (const [platform, hosts] of Object.entries(SOCIAL_HOSTS)) {
    if (active.has(platform)) continue;
    for (const h of hosts) {
      const re = new RegExp(`<a\\b[^>]*href="[^"]*${escapeRegex(h)}[^"]*"[^>]*>[\\s\\S]*?<\\/a>`, "gi");
      out = out.replace(re, m => (/<svg/i.test(m) || /class="[^"]*social/i.test(m) ? "" : m));
    }
  }

  // Clean up <li> wrappers left empty after removing a social anchor.
  out = out.replace(/<li[^>]*>\s*<\/li>/gi, "");

  return out;
}

/** Apply footer social-link updates to every .html page of a static site. */
export async function applyFooterSocialLinks(subdomain: string, links: EnrichedSocial[]): Promise<void> {
  const safe = subdomain.replace(/[^a-z0-9-]/g, "");
  const siteDir = path.join(SITES_DIR, safe);
  let entries: string[];
  try {
    entries = (await fs.readdir(siteDir)).filter(f => f.toLowerCase().endsWith(".html"));
  } catch {
    return;
  }
  for (const file of entries) {
    const fp = path.join(siteDir, file);
    try {
      const orig = await fs.readFile(fp, "utf8");
      const updated = updateFooterSocialLinks(orig, links);
      if (updated !== orig) await fs.writeFile(fp, updated, "utf8");
    } catch {
      /* skip unreadable file */
    }
  }
}

// ── Store rendering ────────────────────────────────────────────────────────────

interface StoreInfo {
  shipping?: string;
  returns?: string;
  how_to_buy?: string;
}

function renderProductCard(p: any): string {
  const images = parseJsonArray(p.images);
  const tags = parseJsonArray(p.tags);
  const img = images[0]
    ? `<div class="aspect-[4/3] overflow-hidden bg-black/5">
        <img src="${esc(images[0])}" alt="${esc(p.name)}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
      </div>`
    : "";
  const price = fmtPrice(p.price);
  const sale = fmtPrice(p.sale_price);
  const priceBlock = sale
    ? `<span class="text-xl font-bold text-primary">${sale}</span> <span class="text-sm text-black/40 line-through">${price}</span>`
    : price
      ? `<span class="text-xl font-bold text-primary">${price}</span>`
      : "";
  const tagBlock = tags.length
    ? `<div class="mt-3 flex flex-wrap gap-1.5">${tags
        .map((t: any) => `<span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">${esc(t)}</span>`)
        .join("")}</div>`
    : "";
  return `<article class="group rounded-2xl border border-black/10 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      ${img}
      <div class="p-5">
        <h3 class="font-heading text-lg font-semibold text-secondary">${esc(p.name)}</h3>
        ${p.description ? `<p class="mt-1 text-sm text-black/60">${esc(p.description)}</p>` : ""}
        ${priceBlock ? `<div class="mt-3 flex items-baseline gap-2">${priceBlock}</div>` : ""}
        ${tagBlock}
      </div>
    </article>`;
}

function renderStoreInfo(info: StoreInfo): string {
  const cards = [
    { label: "Envíos", value: info.shipping },
    { label: "Devoluciones", value: info.returns },
    { label: "Cómo comprar", value: info.how_to_buy },
  ].filter(c => c.value && c.value.trim());
  if (cards.length === 0) return "";
  return `<section class="mt-16 grid gap-6 sm:grid-cols-${Math.min(cards.length, 3)}">
      ${cards
        .map(
          c => `<div class="rounded-2xl border border-black/10 bg-black/[0.02] p-6">
        <h3 class="font-heading text-base font-semibold text-secondary">${esc(c.label)}</h3>
        <div class="mt-2 text-sm">${richText(c.value)}</div>
      </div>`
        )
        .join("\n      ")}
    </section>`;
}

function renderStoreMain(products: any[], storeInfo: StoreInfo): string {
  const grid =
    products.length > 0
      ? `<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        ${products.map(renderProductCard).join("\n        ")}
      </div>`
      : `<p class="text-center text-black/50 py-12">Pronto agregaremos productos.</p>`;
  return `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <header class="mb-10 text-center">
      <h1 class="font-heading text-3xl sm:text-4xl font-bold text-secondary">Tienda</h1>
    </header>
    ${grid}
    ${renderStoreInfo(storeInfo)}
  </div>`;
}

// ── Blog rendering ───────────────────────────────────────────────────────────

function renderPostCard(post: any): string {
  const img = post.featured_image
    ? `<div class="aspect-[16/9] overflow-hidden bg-black/5">
        <img src="${esc(post.featured_image)}" alt="${esc(post.title)}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
      </div>`
    : "";
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  return `<article class="group rounded-2xl border border-black/10 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col">
      ${img}
      <div class="p-5 flex flex-col flex-1">
        ${date ? `<p class="text-xs text-black/40">${esc(date)}</p>` : ""}
        <h3 class="mt-1 font-heading text-lg font-semibold text-secondary">${esc(post.title)}</h3>
        ${post.summary ? `<p class="mt-2 text-sm text-black/60 flex-1">${esc(post.summary)}</p>` : "<div class='flex-1'></div>"}
        <a href="blog-${safeSlug(post.slug)}.html" class="mt-4 inline-block text-sm font-semibold text-primary hover:text-accent transition-colors">Leer más →</a>
      </div>
    </article>`;
}

function renderBlogIndexMain(posts: any[]): string {
  const grid =
    posts.length > 0
      ? `<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        ${posts.map(renderPostCard).join("\n        ")}
      </div>`
      : `<p class="text-center text-black/50 py-12">Pronto publicaremos contenido.</p>`;
  return `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <header class="mb-10 text-center">
      <h1 class="font-heading text-3xl sm:text-4xl font-bold text-secondary">Blog</h1>
    </header>
    ${grid}
  </div>`;
}

function renderBlogPostMain(post: any, showAuthor: boolean): string {
  const tags = parseJsonArray(post.tags);
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const hero = post.featured_image
    ? `<div class="aspect-[16/9] overflow-hidden rounded-2xl bg-black/5 mb-8">
        <img src="${esc(post.featured_image)}" alt="${esc(post.title)}" class="w-full h-full object-cover" />
      </div>`
    : "";
  const tagBlock = tags.length
    ? `<div class="mt-8 flex flex-wrap gap-1.5">${tags
        .map((t: any) => `<span class="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">${esc(t)}</span>`)
        .join("")}</div>`
    : "";
  return `<article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <a href="blog.html" class="text-sm font-semibold text-primary hover:text-accent transition-colors">← Volver al blog</a>
    <h1 class="mt-4 font-heading text-3xl sm:text-4xl font-bold text-secondary">${esc(post.title)}</h1>
    ${date || showAuthor ? `<p class="mt-2 text-sm text-black/40">${esc(date)}</p>` : ""}
    <div class="mt-8">${hero}</div>
    <div class="prose">${richText(post.content)}</div>
    ${tagBlock}
  </article>`;
}

// ── Public entry point ───────────────────────────────────────────────────────

export interface RegenerateInput {
  subdomain: string;
  projectId: number;
  pool: any;
}

/**
 * Regenerate Store/Blog static pages for a lite/lite_plus site from the DB and
 * inject nav links. Safe to call on every rebuild; never throws fatally.
 * Returns the list of files written (for logging).
 */
export async function regenerateStaticDynamicPages(input: RegenerateInput): Promise<string[]> {
  const { subdomain, projectId, pool } = input;
  const safe = subdomain.replace(/[^a-z0-9-]/g, "");
  const siteDir = path.join(SITES_DIR, safe);
  const written: string[] = [];

  // Project flags
  const [prows] = (await pool.execute(
    "SELECT name, has_store, store_info, has_blog, blog_config FROM md_projects WHERE id = ? LIMIT 1",
    [projectId]
  )) as any;
  const project = prows[0];
  if (!project) return written;

  const hasStore = project.has_store === 1 || project.has_store === true;
  const hasBlog = project.has_blog === 1 || project.has_blog === true;
  if (!hasStore && !hasBlog) return written;

  // Build nav links and inject into every existing page first, so the shell we
  // read afterwards already contains them.
  const links: NavLink[] = [];
  if (hasStore) links.push({ href: "tienda.html", label: "Tienda" });
  if (hasBlog) links.push({ href: "blog.html", label: "Blog" });

  let htmlFiles: string[];
  try {
    htmlFiles = (await fs.readdir(siteDir)).filter(
      f => f.toLowerCase().endsWith(".html") && f !== "tienda.html" && f !== "blog.html" && !f.startsWith("blog-")
    );
  } catch {
    return written;
  }

  for (const file of htmlFiles) {
    const fp = path.join(siteDir, file);
    try {
      const orig = await fs.readFile(fp, "utf8");
      const injected = injectNavLinks(orig, links);
      if (injected !== orig) await fs.writeFile(fp, injected, "utf8");
    } catch {
      /* skip unreadable file */
    }
  }

  // Read the home page to extract the (now nav-injected) layout shell.
  let shell: Shell | null = null;
  try {
    const home = await fs.readFile(path.join(siteDir, "index.html"), "utf8");
    shell = extractShell(home);
  } catch {
    shell = null;
  }
  if (!shell) return written; // can't render without a layout to reuse

  // ── Store ──
  if (hasStore) {
    const [products] = (await pool.execute(
      "SELECT * FROM md_products WHERE project_id = ? AND active = 1 ORDER BY id DESC",
      [projectId]
    )) as any;
    let storeInfo: StoreInfo = {};
    try {
      storeInfo = project.store_info
        ? typeof project.store_info === "string"
          ? JSON.parse(project.store_info)
          : project.store_info
        : {};
    } catch {
      storeInfo = {};
    }
    const page = assemblePage(shell, renderStoreMain(products, storeInfo), `Tienda | ${project.name}`);
    await fs.writeFile(path.join(siteDir, "tienda.html"), page, "utf8");
    written.push("tienda.html");
  }

  // ── Blog ──
  if (hasBlog) {
    const [posts] = (await pool.execute(
      "SELECT * FROM md_blog_posts WHERE project_id = ? AND published = 1 ORDER BY created_at DESC",
      [projectId]
    )) as any;
    let showAuthor = false;
    try {
      const cfg = project.blog_config
        ? typeof project.blog_config === "string"
          ? JSON.parse(project.blog_config)
          : project.blog_config
        : {};
      showAuthor = !!cfg.show_author;
    } catch {
      /* default false */
    }

    const indexPage = assemblePage(shell, renderBlogIndexMain(posts), `Blog | ${project.name}`);
    await fs.writeFile(path.join(siteDir, "blog.html"), indexPage, "utf8");
    written.push("blog.html");

    for (const post of posts) {
      const postPage = assemblePage(shell, renderBlogPostMain(post, showAuthor), `${post.title} | ${project.name}`);
      const fname = `blog-${safeSlug(post.slug)}.html`;
      await fs.writeFile(path.join(siteDir, fname), postPage, "utf8");
      written.push(fname);
    }
  }

  return written;
}
