# Panel CMS — Documentacion de cambios globales

> Ultima actualizacion: 2026-03-24

## Resumen

El Panel CMS (`components/manu-dev/CmsPanel.tsx`) es el editor visual post-generacion del sitio en Manu Dev. Permite al usuario gestionar diseño, contenido, redes sociales, mensajes, tienda y blog sin tocar codigo, desde una interfaz unificada con preview en iframe.

---

## Arquitectura del archivo

**Archivo**: `escritorio/components/manu-dev/CmsPanel.tsx`
**Lineas**: ~1408
**Tipo**: `"use client"` — componente React client-side

### Estructura interna

| Linea | Componente | Proposito |
|-------|------------|-----------|
| 1-29 | Imports | FontAwesome icons (solid + brands) |
| 30-60 | Types | `CmsPage`, `CmsData`, `SocialLink`, `Message` |
| 62-80 | Constants | `SOCIAL_NETWORKS`, `GOOGLE_FONTS` (12 fuentes) |
| 84-106 | `Modal` | Wrapper generico de modal (overlay + card) |
| 110-272 | `LayoutModal` | Colores, fuentes, preview con Google Fonts, editor CSS |
| 276-374 | `PagesModal` | Panel lateral: seleccion de pagina + textarea IA |
| 378-473 | `SocialModal` | Listado de redes sociales con toggle y valor |
| 477-570 | `MessagesModal` | Listado de mensajes del formulario de contacto |
| 574-774 | `StoreModal` | Tabs: productos, categorias, info de tienda |
| 778-979 | `BlogModal` | Tabs: posts, categorias, configuracion |
| 983-1041 | `CategoriesTab` | Tab reutilizable para categorias (producto/blog) |
| 1043-1073 | `SupportModal` | Modal de soporte → abre WhatsApp |
| 1077-1163 | `AiFixModal` | Correccion con IA: selecciona pagina + describe fix |
| 1167-1408 | `CmsPanel` (default export) | Componente principal: headers, toolbar, iframe, modals |

---

## Cambios aplicados (Fase 7)

### Bug 0 — Paginas no aparecian en CMS

**Causa**: La tabla `md_pages` fue creada despues de que los sitios activos (project 32, 33) ya estaban desplegados. El INSERT en `create-site/route.ts` solo corre al crear un sitio nuevo.

**Solucion**:
- Backfill manual de 8 filas en `md_pages` para los proyectos existentes
- El INSERT en `create-site` ya existia (lineas ~1023-1036) y funciona para nuevos sitios

---

### Bug 0.1 — Colores revertian tras redespliegue

**Causa**: `rebuild/route.ts` solo llamaba a `queueBuild()` que reconstruye Docker desde archivos existentes en disco. Nunca leia `md_design` ni actualizaba `globals.css`.

**Solucion** (en `app/api/manu-dev/rebuild/route.ts`):
- Nueva funcion `syncDesignToFiles(subdomain, projectId, pool)`:
  1. Lee colores/fuentes de `md_design`
  2. Lee `globals.css` del directorio del sitio
  3. Reemplaza variables CSS: `--color-primary`, `--color-secondary`, `--color-accent`
  4. Reemplaza variables de fuente: `--font-heading`, `--font-body`
  5. Actualiza la URL de `@import` de Google Fonts
  6. Escribe el archivo modificado antes de `queueBuild()`

**Flujo corregido**:
```
Usuario cambia color → PATCH /api/manu-dev/design → md_design actualizado
Usuario da Redesplegar → POST /api/manu-dev/rebuild
  → syncDesignToFiles() actualiza globals.css en disco
  → queueBuild() → Docker build con CSS actualizado
  → Sitio muestra nuevos colores ✓
```

---

### Bug 0.2 — Preview de fuentes no mostraba el estilo real

**Causa**: LayoutModal tenia `style={{ fontFamily: value }}` pero las fuentes de Google no estaban cargadas en el navegador.

**Solucion** (en `LayoutModal`, linea ~130):
- `useEffect` que inyecta `<link rel="stylesheet">` en el `<head>` para las 12 fuentes de `GOOGLE_FONTS`
- Patron identico al `FontPreview` de `page.tsx`
- `fontFamily` corregido a `"${value}", sans-serif` (con comillas para nombres compuestos)

---

### UI 1 — Botones de toolbar centrados

**Antes**: `flex items-center gap-0.5`
**Despues**: `flex items-center justify-center gap-0.5`

Linea del toolbar: ~1330 en el componente `CmsPanel`.

---

### Feature 2 — Boton Auto-Fix

**Ubicacion**: Header 1 (fila de acciones), entre "Ver sitio" y "Redesplegar"
**Icono**: `faWandMagicSparkles`
**Comportamiento**: Dispara un rebuild (mismo que Redesplegar). Preparado para logica de auto-fix avanzada en futuras iteraciones.

---

### Feature 3 — Corregir con IA (AiFixModal)

**Ubicacion**: Boton en toolbar + modal wide
**Componente**: `AiFixModal` (linea 1077)
**Props**: `projectId`, `pages`, `onClose`, `onSaved`

**Flujo**:
1. Usuario selecciona pagina (botones tipo chip)
2. Describe la correccion en textarea
3. Submit → `PATCH /api/manu-dev/content` con `change_description`
4. Backend usa Claude para aplicar el cambio al JSX de la pagina
5. Resultado mostrado inline (exito/error)
6. `onSaved()` → marca `pendingChanges = true`

---

### Feature 4 — Soporte (WhatsApp)

**Ubicacion**: Header 1 (fila de acciones), boton verde con icono `faHeadset`
**Componente**: `SupportModal` (linea 1043)

**Flujo**:
1. Usuario escribe mensaje en textarea
2. Click "Enviar por WhatsApp"
3. Abre `https://wa.me/59896082266?text={mensaje}` en nueva pestaña

---

### Feature 5 — Editor CSS en LayoutModal

**Ubicacion**: Seccion colapsable dentro de `LayoutModal`, debajo de futentes
**API**: `GET/PUT /api/manu-dev/css?project_id=X`

**Flujo**:
1. Click "Abrir editor" → `GET /api/manu-dev/css` → carga `globals.css`
2. Textarea monospace muestra el CSS completo
3. Banner de advertencia: "Los cambios al CSS son irreversibles"
4. Click "Guardar CSS" → `confirm()` nativo → `PUT /api/manu-dev/css`
5. `onSaved()` → marca `pendingChanges = true`

**API** (`app/api/manu-dev/css/route.ts`):
- `GET`: Lee `/opt/docker-apps/sites/{subdomain}/app/globals.css`
- `PUT`: Escribe CSS al mismo archivo
- Seguridad: auth JWT, verificacion de ownership, sanitizacion de subdomain, proteccion path traversal

---

### Fix — Chat content no influia en generacion

**Causa**: `project.extra_content` nunca se populaba. En `buildBusinessBlock()` (create-site) ya se usaba, pero siempre era NULL.

**Solucion** (en `app/api/manu-dev/chat/route.ts`):
- En la transicion `site_type → building` (tanto normal como fallback programatico):
  1. Query: `SELECT content FROM md_chat_history WHERE project_id = ? AND role = 'user'`
  2. Concatena todos los mensajes del usuario (max 3000 chars)
  3. `UPDATE md_projects SET extra_content = ? WHERE id = ?`
- `buildBusinessBlock()` ya lee `extra_content` y lo inyecta en el prompt de generacion

---

## APIs involucradas

| Endpoint | Metodo | Proposito |
|----------|--------|-----------|
| `/api/manu-dev/content` | GET | Devuelve proyecto + design + pages |
| `/api/manu-dev/content` | PATCH | Aplica cambio IA a una pagina |
| `/api/manu-dev/design` | PATCH | Actualiza colores/fuentes en md_design |
| `/api/manu-dev/css` | GET | Lee globals.css del sitio |
| `/api/manu-dev/css` | PUT | Escribe globals.css del sitio |
| `/api/manu-dev/rebuild` | POST | Sync design + rebuild Docker (SSE) |
| `/api/manu-dev/social-links` | GET/PUT | Redes sociales |
| `/api/manu-dev/messages` | GET | Mensajes del formulario |
| `/api/manu-dev/store` | GET/PATCH | Estado de tienda |
| `/api/manu-dev/products` | GET/POST/DELETE | Productos |
| `/api/manu-dev/categories` | GET/POST/DELETE | Categorias (producto/blog) |
| `/api/manu-dev/blog` | GET/PATCH | Estado de blog |
| `/api/manu-dev/blog-posts` | GET/POST/DELETE | Posts del blog |

---

## Estado del activeModal

```typescript
type ActiveModal = null
  | "layout"    // LayoutModal (colores, fuentes, CSS editor)
  | "pages"     // PagesModal (editar contenido por pagina)
  | "social"    // SocialModal (redes sociales)
  | "messages"  // MessagesModal (mensajes de contacto)
  | "store"     // StoreModal (productos, categorias, config)
  | "blog"      // BlogModal (posts, categorias, config)
  | "aifix"     // AiFixModal (correccion con IA)
  | "support"   // SupportModal (WhatsApp)
```

---

## Layout del componente principal

```
┌─────────────────────────────────────────────────────────┐
│ Header 1: [← Volver] [Ver sitio] [Auto-Fix] [Redesplegar] [Soporte] │
├─────────────────────────────────────────────────────────┤
│ (rebuild status bar — solo si hay build completado)     │
├─────────────────────────────────────────────────────────┤
│ Header 2: [Layout] [Paginas] [Redes] [Mensajes] [Tienda] [Blog] [Corregir IA] │
│           ↑ centrado con justify-center                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                   IFRAME PREVIEW                        │
│                   (flex-1 fill)                          │
│                                                         │
│   ┌──────────────┐                                      │
│   │  Modal activo │ ← renderizado sobre el iframe       │
│   │  (z-50)       │                                     │
│   └──────────────┘                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Dependencias

| Paquete | Uso |
|---------|-----|
| `@fortawesome/react-fontawesome` | Iconos en toolbar y modals |
| `@fortawesome/free-solid-svg-icons` | Iconos principales (24 importados) |
| Google Fonts (CDN) | Cargadas dinamicamente en LayoutModal para preview |

---

## Base de datos

| Tabla | Uso en CMS Panel |
|-------|------------------|
| `md_projects` | Proyecto base (subdomain, site_url, status, extra_content) |
| `md_design` | Colores y fuentes (primary/secondary/accent_color, font_heading/body) |
| `md_pages` | Paginas del sitio (slug, title, content_json) |
| `md_chat_history` | Chat history → se extrae a extra_content antes de generar |
| `md_messages` | Mensajes recibidos del formulario de contacto |
| `md_products` | Productos de tienda |
| `md_product_categories` | Categorias de productos |
| `md_blog_posts` | Posts del blog |
| `md_blog_categories` | Categorias del blog |

---

## Archivos modificados en esta actualizacion

| Archivo | Cambio |
|---------|--------|
| `components/manu-dev/CmsPanel.tsx` | Font loading, CSS editor, toolbar centrado, 3 botones nuevos, 2 modals nuevos |
| `app/api/manu-dev/rebuild/route.ts` | `syncDesignToFiles()` — sync colores/fuentes a globals.css antes de rebuild |
| `app/api/manu-dev/chat/route.ts` | Populacion de `extra_content` desde chat history al transicionar a building |
| `app/api/manu-dev/css/route.ts` | **NUEVO** — GET/PUT globals.css del sitio |
