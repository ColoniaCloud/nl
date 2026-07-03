// ─── Lite Template System ────────────────────────────────────────────────────
// 5 visually distinct CSS templates for Lite mode (nl360_free).
// Each template shares the same HTML class names but provides a unique look.
// User colors (--primary, --accent) are injected via inline <style> in the layout.

export type LiteTemplateId = "professional" | "bold" | "elegant" | "fresh" | "minimal";

export interface LiteTemplateMeta {
  id: LiteTemplateId;
  name: string;
  description: string;
  fonts: string;
}

export const LITE_TEMPLATES: Record<LiteTemplateId, LiteTemplateMeta> = {
  professional: {
    id: "professional",
    name: "Professional",
    description: "Limpio y corporativo. Ideal para servicios y consultoria.",
    fonts: "Space Grotesk / Manrope",
  },
  bold: {
    id: "bold",
    name: "Bold",
    description: "Tipografia impactante y gradientes fuertes. Para agencias y tech.",
    fonts: "DM Sans / Inter",
  },
  elegant: {
    id: "elegant",
    name: "Elegant",
    description: "Serif refinado con tonos calidos. Para abogados, coaches y premium.",
    fonts: "Playfair Display / Lato",
  },
  fresh: {
    id: "fresh",
    name: "Fresh",
    description: "Bordes suaves y colores vivos. Para gastronomia, salud y retail.",
    fonts: "Nunito / Open Sans",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Ultra simple con mucho espacio. Para portfolio y marca personal.",
    fonts: "Work Sans / IBM Plex Sans",
  },
};

export function getTemplateList(): LiteTemplateMeta[] {
  return Object.values(LITE_TEMPLATES);
}

export function isValidTemplate(id: string): id is LiteTemplateId {
  return id in LITE_TEMPLATES;
}

// ─── Shared base reset (used by all templates) ──────────────────────────────

const BASE_RESET = `*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto;display:block}
button{cursor:pointer;font:inherit}`;

const BASE_LAYOUT = `.container{max-width:1120px;margin:0 auto;padding:0 1.25rem}
.site-header{position:sticky;top:0;z-index:30}
.header-row{height:80px;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.desktop-nav{display:none;gap:1.25rem}
.menu-btn{border:none;background:transparent;font-size:1.5rem;line-height:1}
.mobile-nav{display:flex;flex-direction:column;gap:.75rem;padding:0 1.25rem 1rem}
.hero{min-height:88vh;position:relative;display:flex;align-items:center;overflow:hidden}
.hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.overlay{position:absolute;inset:0}
.hero-content{position:relative;color:#fff;max-width:720px;padding:5rem 1.25rem}
.hero-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.hero-points{margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem}
.section{padding:5rem 0}
.section-head{max-width:700px;margin-bottom:2rem}
.grid-3,.grid-2{display:grid;gap:1.25rem}.grid-3{grid-template-columns:1fr}.grid-2{grid-template-columns:1fr}
.cards-grid{display:grid;grid-template-columns:1fr;gap:1.25rem}
.cards-3{grid-template-columns:1fr}
.feature-list{display:grid;grid-template-columns:1fr;gap:1rem}
.faq-list{display:grid;gap:.75rem}
.faq-list details summary{cursor:pointer}
.content-stack{max-width:680px}
.social-links{display:flex;flex-wrap:wrap;gap:.6rem}
.contact-box{text-align:center;max-width:640px;margin:0 auto}
.footer-row{min-height:64px;padding:1rem 0;display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.85rem}
@media(min-width:760px){.cards-grid{grid-template-columns:repeat(2,1fr)}.feature-list{grid-template-columns:repeat(3,1fr)}.cards-3{grid-template-columns:repeat(3,1fr)}}
@media(min-width:980px){.desktop-nav{display:flex}.menu-btn,.mobile-nav{display:none}.grid-3{grid-template-columns:repeat(3,1fr)}.grid-2{grid-template-columns:repeat(2,1fr)}}`;

// ─── Template: Professional ─────────────────────────────────────────────────

function buildProfessional(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Manrope:wght@400;500;700&display=swap');
${BASE_RESET}
html,body{font-family:Manrope,system-ui,sans-serif;color:#0b1220;background:#f2f4f8}
${BASE_LAYOUT}

.brand{font-family:Space Grotesk,sans-serif;font-weight:700;letter-spacing:.01em;font-size:1.2rem;color:#111827}
.site-header{background:rgba(250,251,255,.88);backdrop-filter:blur(12px);border-bottom:1px solid #d7deea}
.nav-link{color:#334155;font-weight:600;font-size:.9rem;transition:color .2s}.nav-link:hover{color:var(--primary)}

.overlay{background:linear-gradient(135deg,rgba(2,6,23,.74),rgba(15,23,42,.35))}
.hero h1{font-family:Space Grotesk,sans-serif;font-size:clamp(2.2rem,6vw,4.2rem);font-weight:700;line-height:1.05;margin:.3rem 0 .8rem}
.eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:.76rem;font-weight:700;opacity:.9}
.hero p{font-size:1.05rem;line-height:1.7;max-width:600px}
.hero-points span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);padding:.35rem .65rem;border-radius:999px;font-size:.78rem;font-weight:600}

.btn{display:inline-block;padding:.75rem 1.5rem;border-radius:.6rem;font-weight:700;font-size:.92rem;transition:transform .2s,box-shadow .2s}
.btn-primary{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.18)}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.22)}
.btn-ghost{border:1.5px solid rgba(255,255,255,.7);color:#fff;border-radius:.6rem}.btn-ghost:hover{background:rgba(255,255,255,.1)}

.section-block{background:linear-gradient(180deg,#f7f9fc,#eef2f7)}
.section:nth-of-type(even).section-block{background:#f0f3f9}
.section-alt{background:linear-gradient(180deg,#e4e9f3,#d8dfeb)}
.section-head h2{font-family:Space Grotesk,sans-serif;font-size:clamp(1.4rem,2.2vw,2rem);line-height:1.2;margin-bottom:.5rem}
.section-head p{color:#4b5563;line-height:1.65}
.lead{color:#475569;line-height:1.65}

.card{background:#fff;padding:1.5rem;border-radius:.9rem;border:1px solid #dde5f2;box-shadow:0 8px 28px rgba(15,23,42,.07);transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-4px);box-shadow:0 14px 36px rgba(15,23,42,.12)}
.card-soft{background:linear-gradient(180deg,#fff,#f7f9fd)}
.kicker{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:.4rem;font-weight:700}
.card h3{font-family:Space Grotesk,sans-serif;margin-bottom:.45rem;font-size:1.05rem}
.card p{color:#334155;line-height:1.6;font-size:.94rem}

.feature-item{background:#fff;border:1px solid #dde5f2;border-radius:.9rem;padding:1.25rem;box-shadow:0 6px 18px rgba(15,23,42,.06)}
.feature-item h3{margin-bottom:.4rem;font-size:1rem}.feature-item p{color:#475569;line-height:1.6;font-size:.92rem}
.quote p{font-style:italic;font-size:1rem;line-height:1.65}.quote span{display:block;margin-top:.6rem;color:#64748b;font-size:.84rem}
.faq-list details summary{font-weight:700;color:#0f172a;padding:.6rem 0}.faq-list details p{margin:.5rem 0 0;color:#475569;line-height:1.6}
.content-stack p{margin-bottom:.85rem;color:#334155;line-height:1.7}.content-stack ul{padding-left:1.2rem;color:#334155;line-height:1.65}
.contact-panel{background:#fff;border:1px solid #dbe4f2;border-radius:.9rem;padding:1.5rem;box-shadow:0 8px 22px rgba(15,23,42,.08)}
.contact-box h2{font-family:Space Grotesk,sans-serif;font-size:clamp(1.4rem,2vw,2rem);margin-bottom:.5rem}
.contact-box p{color:#475569;line-height:1.65;margin-bottom:1.25rem}
.social-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .75rem;border-radius:.6rem;background:#0f172a;color:#fff;font-size:.84rem;font-weight:600;transition:opacity .2s}.social-chip:hover{opacity:.85}
.site-footer{border-top:1px solid #d6deea;background:#f8fbff;color:#64748b}`;
}

// ─── Template: Bold ─────────────────────────────────────────────────────────

function buildBold(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700;900&family=Inter:wght@400;500;600&display=swap');
${BASE_RESET}
html,body{font-family:Inter,system-ui,sans-serif;color:#e2e8f0;background:#0a0a0f}
${BASE_LAYOUT}

.brand{font-family:DM Sans,sans-serif;font-weight:900;font-size:1.3rem;color:#fff;letter-spacing:-.02em}
.site-header{background:rgba(10,10,15,.92);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.08)}
.nav-link{color:#94a3b8;font-weight:600;font-size:.9rem;transition:color .2s}.nav-link:hover{color:var(--accent)}

.overlay{background:linear-gradient(135deg,rgba(0,0,0,.82),rgba(10,10,15,.45))}
.hero h1{font-family:DM Sans,sans-serif;font-size:clamp(2.5rem,7vw,5rem);font-weight:900;line-height:.98;letter-spacing:-.03em;margin:.3rem 0 1rem}
.eyebrow{letter-spacing:.2em;text-transform:uppercase;font-size:.7rem;font-weight:700;color:var(--accent)}
.hero p{font-size:1.1rem;line-height:1.7;color:rgba(255,255,255,.85);max-width:580px}
.hero-points span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);padding:.35rem .7rem;border-radius:.5rem;font-size:.78rem;font-weight:600;color:rgba(255,255,255,.9)}

.btn{display:inline-block;padding:.8rem 1.75rem;border-radius:.5rem;font-weight:700;font-size:.95rem;transition:transform .2s}
.btn-primary{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;box-shadow:0 0 30px rgba(var(--primary-rgb,59,130,246),.35)}.btn-primary:hover{transform:scale(1.04)}
.btn-ghost{border:2px solid rgba(255,255,255,.3);color:#fff}.btn-ghost:hover{background:rgba(255,255,255,.06)}

.section-block{background:#0f0f16}
.section:nth-of-type(even).section-block{background:#121219}
.section-alt{background:linear-gradient(180deg,#161622,#1a1a28)}
.section-head h2{font-family:DM Sans,sans-serif;font-size:clamp(1.5rem,2.5vw,2.2rem);line-height:1.12;font-weight:900;letter-spacing:-.02em;color:#fff;margin-bottom:.6rem}
.section-head p{color:#94a3b8;line-height:1.65}
.lead{color:#94a3b8;line-height:1.65}

.card{background:rgba(255,255,255,.04);padding:1.5rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.08);box-shadow:0 0 0 transparent;transition:border-color .3s,box-shadow .3s}
.card:hover{border-color:var(--accent);box-shadow:0 0 24px rgba(var(--accent-rgb,14,165,233),.15)}
.card-soft{background:rgba(255,255,255,.03)}
.kicker{font-size:.7rem;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);margin-bottom:.45rem;font-weight:700}
.card h3{font-family:DM Sans,sans-serif;font-weight:700;color:#fff;margin-bottom:.45rem;font-size:1.1rem}
.card p{color:#a1adc0;line-height:1.6;font-size:.94rem}

.feature-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:.75rem;padding:1.25rem}
.feature-item h3{margin-bottom:.4rem;color:#fff;font-weight:700;font-size:1rem}.feature-item p{color:#8896ab;line-height:1.6;font-size:.92rem}
.quote{border-left:3px solid var(--accent);padding-left:1rem}.quote p{font-style:italic;color:#c8d2de;line-height:1.65}.quote span{display:block;margin-top:.6rem;color:#64748b;font-size:.84rem}
.faq-list details summary{font-weight:700;color:#e2e8f0;padding:.6rem 0}.faq-list details p{margin:.5rem 0 0;color:#94a3b8;line-height:1.6}
.content-stack p{margin-bottom:.85rem;color:#b0bdd0;line-height:1.7}.content-stack ul{padding-left:1.2rem;color:#b0bdd0;line-height:1.65}
.contact-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:.75rem;padding:1.5rem}
.contact-box h2{font-family:DM Sans,sans-serif;font-weight:900;font-size:clamp(1.5rem,2.2vw,2.2rem);color:#fff;margin-bottom:.5rem}
.contact-box p{color:#94a3b8;line-height:1.65;margin-bottom:1.25rem}
.social-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .75rem;border-radius:.5rem;background:rgba(255,255,255,.08);color:#fff;font-size:.84rem;font-weight:600;border:1px solid rgba(255,255,255,.1);transition:border-color .2s}.social-chip:hover{border-color:var(--accent)}
.site-footer{border-top:1px solid rgba(255,255,255,.06);background:#0a0a0f;color:#64748b}`;
}

// ─── Template: Elegant ──────────────────────────────────────────────────────

function buildElegant(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;800&family=Lato:wght@300;400;700&display=swap');
${BASE_RESET}
html,body{font-family:Lato,system-ui,sans-serif;color:#2c2a27;background:#faf8f5;font-weight:300}
${BASE_LAYOUT}

.brand{font-family:Playfair Display,Georgia,serif;font-weight:700;font-size:1.25rem;color:#1a1714}
.site-header{background:rgba(250,248,245,.92);backdrop-filter:blur(10px);border-bottom:1px solid #e8e2d8}
.nav-link{color:#6b6156;font-weight:400;font-size:.92rem;letter-spacing:.04em;transition:color .2s}.nav-link:hover{color:var(--primary)}

.overlay{background:linear-gradient(160deg,rgba(26,23,20,.72),rgba(60,50,38,.3))}
.hero h1{font-family:Playfair Display,Georgia,serif;font-size:clamp(2.2rem,6vw,4rem);font-weight:800;line-height:1.08;margin:.3rem 0 .9rem;letter-spacing:-.01em}
.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;font-weight:700;opacity:.85}
.hero p{font-size:1.05rem;line-height:1.75;font-weight:300;max-width:560px}
.hero-points span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);padding:.35rem .7rem;border-radius:2rem;font-size:.76rem;font-weight:400;letter-spacing:.03em}

.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:2rem;font-weight:700;font-size:.9rem;letter-spacing:.03em;transition:transform .2s,box-shadow .2s}
.btn-primary{background:var(--primary);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.12)}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.16)}
.btn-ghost{border:1.5px solid rgba(255,255,255,.6);color:#fff;border-radius:2rem}.btn-ghost:hover{background:rgba(255,255,255,.08)}

.section-block{background:linear-gradient(180deg,#faf8f5,#f3efe8)}
.section:nth-of-type(even).section-block{background:#f6f2ec}
.section-alt{background:linear-gradient(180deg,#ece6dc,#e2dacf)}
.section-head h2{font-family:Playfair Display,Georgia,serif;font-size:clamp(1.4rem,2.2vw,2rem);line-height:1.2;font-weight:700;margin-bottom:.6rem;color:#1a1714}
.section-head p{color:#6b6156;line-height:1.7;font-weight:300}
.lead{color:#6b6156;line-height:1.7;font-weight:300}

.card{background:#fff;padding:1.75rem;border-radius:1.1rem;border:1px solid #e8e2d8;box-shadow:0 4px 20px rgba(26,23,20,.06);transition:transform .3s,box-shadow .3s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(26,23,20,.1)}
.card-soft{background:linear-gradient(180deg,#fffefb,#faf7f2)}
.kicker{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:#9a8d7e;margin-bottom:.45rem;font-weight:700}
.card h3{font-family:Playfair Display,Georgia,serif;font-weight:700;margin-bottom:.5rem;font-size:1.05rem;color:#1a1714}
.card p{color:#5c5549;line-height:1.7;font-size:.94rem;font-weight:300}

.feature-item{background:#fff;border:1px solid #e8e2d8;border-radius:1.1rem;padding:1.5rem;box-shadow:0 4px 14px rgba(26,23,20,.05)}
.feature-item h3{margin-bottom:.45rem;font-family:Playfair Display,serif;font-size:1rem;color:#1a1714}.feature-item p{color:#6b6156;line-height:1.65;font-size:.92rem;font-weight:300}
.quote{border-left:3px solid var(--primary)}.quote p{font-style:italic;font-size:1.02rem;line-height:1.7;padding-left:1rem;color:#4a4239}.quote span{display:block;margin-top:.65rem;padding-left:1rem;color:#9a8d7e;font-size:.84rem}
.faq-list details summary{font-weight:700;color:#1a1714;padding:.6rem 0;font-family:Playfair Display,serif}.faq-list details p{margin:.5rem 0 0;color:#6b6156;line-height:1.65;font-weight:300}
.content-stack p{margin-bottom:.9rem;color:#4a4239;line-height:1.75;font-weight:300}.content-stack ul{padding-left:1.2rem;color:#4a4239;line-height:1.7}
.contact-panel{background:#fff;border:1px solid #e8e2d8;border-radius:1.1rem;padding:1.75rem;box-shadow:0 4px 18px rgba(26,23,20,.06)}
.contact-box h2{font-family:Playfair Display,Georgia,serif;font-weight:700;font-size:clamp(1.4rem,2vw,2rem);color:#1a1714;margin-bottom:.6rem}
.contact-box p{color:#6b6156;line-height:1.7;margin-bottom:1.25rem;font-weight:300}
.social-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .8rem;border-radius:2rem;background:#1a1714;color:#faf8f5;font-size:.84rem;font-weight:400;letter-spacing:.02em;transition:opacity .2s}.social-chip:hover{opacity:.85}
.site-footer{border-top:1px solid #e8e2d8;background:#faf8f5;color:#9a8d7e}`;
}

// ─── Template: Fresh ────────────────────────────────────────────────────────

function buildFresh(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800&family=Open+Sans:wght@400;500;600&display=swap');
${BASE_RESET}
html,body{font-family:Open Sans,system-ui,sans-serif;color:#1e293b;background:#f0fdf4}
${BASE_LAYOUT}

.brand{font-family:Nunito,sans-serif;font-weight:800;font-size:1.2rem;color:#166534}
.site-header{background:rgba(240,253,244,.9);backdrop-filter:blur(12px);border-bottom:1px solid #bbf7d0}
.nav-link{color:#3f6212;font-weight:600;font-size:.9rem;transition:color .2s}.nav-link:hover{color:var(--primary)}

.overlay{background:linear-gradient(135deg,rgba(5,46,22,.7),rgba(20,83,45,.3))}
.hero h1{font-family:Nunito,sans-serif;font-size:clamp(2.2rem,6vw,4rem);font-weight:800;line-height:1.06;margin:.3rem 0 .85rem}
.eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:.74rem;font-weight:700;color:rgba(255,255,255,.9)}
.hero p{font-size:1.05rem;line-height:1.7;max-width:580px;color:rgba(255,255,255,.9)}
.hero-points span{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:.38rem .7rem;border-radius:999px;font-size:.78rem;font-weight:600}

.btn{display:inline-block;padding:.75rem 1.5rem;border-radius:999px;font-weight:700;font-size:.92rem;transition:transform .2s,box-shadow .2s}
.btn-primary{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.14)}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.18)}
.btn-ghost{border:2px solid rgba(255,255,255,.65);color:#fff;border-radius:999px}.btn-ghost:hover{background:rgba(255,255,255,.1)}

.section-block{background:linear-gradient(180deg,#f0fdf4,#dcfce7)}
.section:nth-of-type(even).section-block{background:#ecfdf5}
.section-alt{background:linear-gradient(180deg,#bbf7d0,#a7f3d0)}
.section-head h2{font-family:Nunito,sans-serif;font-size:clamp(1.4rem,2.2vw,2rem);line-height:1.2;font-weight:800;margin-bottom:.55rem;color:#14532d}
.section-head p{color:#3f6212;line-height:1.65}
.lead{color:#3f6212;line-height:1.65}

.card{background:#fff;padding:1.5rem;border-radius:1.25rem;border:1px solid #bbf7d0;box-shadow:0 8px 24px rgba(22,101,52,.08);transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-4px);box-shadow:0 14px 34px rgba(22,101,52,.13)}
.card-soft{background:linear-gradient(180deg,#fff,#f0fdf4)}
.kicker{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#4d7c0f;margin-bottom:.4rem;font-weight:700}
.card h3{font-family:Nunito,sans-serif;font-weight:700;margin-bottom:.45rem;font-size:1.05rem;color:#14532d}
.card p{color:#334155;line-height:1.65;font-size:.94rem}

.feature-item{background:#fff;border:1px solid #bbf7d0;border-radius:1.25rem;padding:1.25rem;box-shadow:0 6px 16px rgba(22,101,52,.06)}
.feature-item h3{margin-bottom:.4rem;color:#14532d;font-weight:700;font-size:1rem}.feature-item p{color:#475569;line-height:1.6;font-size:.92rem}
.quote p{font-style:italic;font-size:1rem;line-height:1.7;color:#1e293b}.quote span{display:block;margin-top:.6rem;color:#65a30d;font-size:.84rem}
.faq-list details summary{font-weight:700;color:#14532d;padding:.6rem 0}.faq-list details p{margin:.5rem 0 0;color:#475569;line-height:1.6}
.content-stack p{margin-bottom:.85rem;color:#334155;line-height:1.7}.content-stack ul{padding-left:1.2rem;color:#334155;line-height:1.65}
.contact-panel{background:#fff;border:1px solid #bbf7d0;border-radius:1.25rem;padding:1.5rem;box-shadow:0 8px 20px rgba(22,101,52,.07)}
.contact-box h2{font-family:Nunito,sans-serif;font-weight:800;font-size:clamp(1.4rem,2vw,2rem);color:#14532d;margin-bottom:.5rem}
.contact-box p{color:#3f6212;line-height:1.65;margin-bottom:1.25rem}
.social-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .75rem;border-radius:999px;background:#14532d;color:#f0fdf4;font-size:.84rem;font-weight:600;transition:opacity .2s}.social-chip:hover{opacity:.85}
.site-footer{border-top:1px solid #bbf7d0;background:#f0fdf4;color:#4d7c0f}`;
}

// ─── Template: Minimal ──────────────────────────────────────────────────────

function buildMinimal(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;600;700&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
${BASE_RESET}
html,body{font-family:IBM Plex Sans,system-ui,sans-serif;color:#18181b;background:#fff;font-weight:300}
${BASE_LAYOUT}

.brand{font-family:Work Sans,sans-serif;font-weight:700;font-size:1.15rem;color:#18181b;letter-spacing:-.01em}
.site-header{background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid #e4e4e7}
.nav-link{color:#71717a;font-weight:400;font-size:.9rem;transition:color .2s}.nav-link:hover{color:#18181b}

.overlay{background:linear-gradient(160deg,rgba(0,0,0,.6),rgba(0,0,0,.2))}
.hero{min-height:80vh}
.hero h1{font-family:Work Sans,sans-serif;font-size:clamp(2rem,5.5vw,3.8rem);font-weight:700;line-height:1.08;margin:.3rem 0 .85rem;letter-spacing:-.02em}
.eyebrow{letter-spacing:.2em;text-transform:uppercase;font-size:.68rem;font-weight:600;opacity:.8}
.hero p{font-size:1rem;line-height:1.75;font-weight:300;max-width:520px;opacity:.9}
.hero-points span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);padding:.3rem .6rem;border-radius:.35rem;font-size:.76rem;font-weight:400}

.btn{display:inline-block;padding:.7rem 1.5rem;border-radius:.35rem;font-weight:600;font-size:.9rem;transition:opacity .2s}
.btn-primary{background:#18181b;color:#fff}.btn-primary:hover{opacity:.85}
.btn-ghost{border:1px solid rgba(255,255,255,.5);color:#fff}.btn-ghost:hover{background:rgba(255,255,255,.06)}

.section{padding:5.5rem 0}
.section-block{background:#fff}
.section:nth-of-type(even).section-block{background:#fafafa}
.section-alt{background:#f4f4f5}
.section-head h2{font-family:Work Sans,sans-serif;font-size:clamp(1.3rem,2vw,1.8rem);line-height:1.25;font-weight:700;letter-spacing:-.01em;margin-bottom:.6rem;color:#18181b}
.section-head p{color:#71717a;line-height:1.7;font-weight:300}
.lead{color:#71717a;line-height:1.7;font-weight:300}

.card{background:#fff;padding:1.5rem;border-radius:.5rem;border:1px solid #e4e4e7;box-shadow:none;transition:box-shadow .3s}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)}
.card-soft{background:#fafafa}
.kicker{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:#a1a1aa;margin-bottom:.4rem;font-weight:600}
.card h3{font-family:Work Sans,sans-serif;font-weight:600;margin-bottom:.45rem;font-size:1rem;color:#18181b}
.card p{color:#52525b;line-height:1.7;font-size:.92rem;font-weight:300}

.feature-item{background:#fff;border:1px solid #e4e4e7;border-radius:.5rem;padding:1.25rem}
.feature-item h3{margin-bottom:.4rem;color:#18181b;font-weight:600;font-size:.95rem}.feature-item p{color:#71717a;line-height:1.65;font-size:.9rem;font-weight:300}
.quote p{font-style:normal;font-size:.95rem;line-height:1.75;color:#3f3f46;font-weight:300}.quote span{display:block;margin-top:.55rem;color:#a1a1aa;font-size:.82rem}
.faq-list details summary{font-weight:600;color:#18181b;padding:.6rem 0}.faq-list details p{margin:.5rem 0 0;color:#71717a;line-height:1.65;font-weight:300}
.content-stack p{margin-bottom:.9rem;color:#3f3f46;line-height:1.75;font-weight:300}.content-stack ul{padding-left:1.2rem;color:#3f3f46;line-height:1.7}
.contact-panel{background:#fafafa;border:1px solid #e4e4e7;border-radius:.5rem;padding:1.5rem}
.contact-box h2{font-family:Work Sans,sans-serif;font-weight:700;font-size:clamp(1.3rem,2vw,1.8rem);color:#18181b;letter-spacing:-.01em;margin-bottom:.5rem}
.contact-box p{color:#71717a;line-height:1.7;margin-bottom:1.25rem;font-weight:300}
.social-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .7rem;border-radius:.35rem;background:#18181b;color:#fff;font-size:.82rem;font-weight:500;transition:opacity .2s}.social-chip:hover{opacity:.85}
.site-footer{border-top:1px solid #e4e4e7;background:#fff;color:#a1a1aa}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

const BUILDERS: Record<LiteTemplateId, () => string> = {
  professional: buildProfessional,
  bold: buildBold,
  elegant: buildElegant,
  fresh: buildFresh,
  minimal: buildMinimal,
};

/**
 * Returns the full CSS string for a given template.
 * Falls back to "professional" if the id is invalid.
 */
export function buildTemplateStyles(templateId: LiteTemplateId | string): string {
  const builder = BUILDERS[templateId as LiteTemplateId] || BUILDERS.professional;
  return builder();
}
