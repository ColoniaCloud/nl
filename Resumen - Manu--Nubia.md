# Resumen — Manu Dev, Nubia & Forge

> Fecha: 2026-06-08

---

## Manu - Dev

### Qué es
Agente conversacional que construye sitios web completos a través de un chat de 11 pasos. El usuario responde preguntas (nombre, industria, colores, logo, redes sociales, tipo de sitio) y al final el sistema genera y despliega el sitio en un subdominio `*.nl360.site`.

### Flujo de construcción

```
Chat (11 pasos)
  → welcome → subdomain → identity → address → logo → colors
  → fonts → social → site_type → building → complete
```

Cada paso es manejado por `app/api/manu-dev/chat/route.ts`. El modelo es `claude-sonnet-4-6` para el chat y para la generación del sitio.

### Modos de generación

| Modo | Tecnología | Acceso |
|------|-----------|--------|
| `lite_plus` | HTML + CSS + Nginx (generado por IA) | Todos los planes |
| `next` | Next.js 14 + React (generado por IA) | Basic, Pro, Elite |

> El modo `lite` (templates estáticos) fue eliminado en 2026-06-08. Free ahora accede a `lite_plus`.

### Cómo genera el sitio (modo `next`)

1. **Prompt 1** → `globals.css` + `app/layout.jsx` (estilos, nav con logo, footer con redes sociales)
2. **Prompt 2** → `app/page.jsx` (homepage con hero, servicios, testimonios, CTA)
3. **Prompt 3** → páginas internas (nosotros, contacto, servicios, etc.)
4. **Preflight auto-fix** → corrige imports de iconos incorrectos antes del build
5. **Docker build** → imagen construida con `manu-dev-build.sh`, desplegada en su propio contenedor Nginx con Traefik

El modelo usa `thinking: { type: "adaptive" }` con `effort: "high"` en modo `next`. En `lite_plus`, sin thinking.

### Boilerplate fijo (no generado por IA)

- `package.json` — Next 14 + React 18 + lucide-react
- `app/icons.jsx` — re-exporta ~45 iconos curados de lucide-react
- `app/social-links.js` — links sociales del negocio (se inyecta dinámicamente)
- `app/[slug]/page.jsx` — placeholder genérico para páginas dinámicas
- `Dockerfile` — multi-stage build

### Logo en el sitio generado

1. Recraft API genera un SVG vectorial del logo durante el chat (paso `logo`)
2. El SVG se descarga localmente en `public/logos/logo-{id}.svg`
3. Se guarda en DB como `https://nl360.site/logos/logo-{id}.svg` (URL absoluta)
4. `buildStructurePrompt()` incluye la URL en el layout para que el modelo ponga `<img src="...">` en el nav con link a home

### Fallback chain

```
next (falla AI) → lite_plus (2 intentos)
                      ↓ ambos fallan
                  mensaje de error HTML al usuario
                  + email a manuel@wpuruguay.com
```

### Archivos clave

| Archivo | Rol |
|---------|-----|
| `app/api/manu-dev/chat/route.ts` | Conversación, logo, persistencia por paso |
| `app/api/manu-dev/create-site/route.ts` | Generación de archivos + Docker build |
| `lib/manu-dev-build.ts` | Cola de builds Docker secuencial |
| `lib/manu-dev-lite-plus.ts` | Generación HTML+Nginx (lite_plus) |
| `lib/logo-generator.ts` | Integración Recraft API (SVG vectorial) |
| `lib/billing-plans.ts` | Modos permitidos por plan |
| `lib/agents.ts` | Modelos de IA por agente |

---

## Manu - Nubia

### Qué es
Sub-agente de Manu Dev especializado en e-commerce completo. Genera tiendas con carrito, catálogo de productos y múltiples métodos de pago. Se activa cuando el usuario elige "E-commerce completo" en el chat de Manu Dev.

### Arquitectura

- **Template base**: `/opt/docker-apps/nubia-templates/base/` — aplicación pre-construida (no se genera con IA, se copia y configura)
- **Configuración por tienda**: `store-config.json` inyectado en tiempo de build con los datos del negocio
- **DB**: tablas `nb_*` (nb_projects, nb_design, nb_products, nb_categories, nb_payment_config, nb_orders, nb_order_items)

### Temas disponibles

`boutique`, `fresh`, `spark`, `classic`, `neon`, `terra` — todos usan el mismo template base; la selección de tema se aplica vía `store-config.json`.

### Flujo de construcción

```
1. Nubia chat → recopila datos del negocio
2. Usuario configura productos desde dashboard
3. Usuario configura métodos de pago
4. create-store → copyTemplate() + buildStoreConfig() + writeStoreConfig()
5. Docker build con manu-dev-build.sh (mismo script que Manu Dev)
6. Sitio live en {subdomain}.nl360.site
```

### APIs del storefront (públicas)

```
GET  /api/nubia/storefront/{subdomain}/products       → catálogo
GET  /api/nubia/storefront/{subdomain}/product/{slug} → producto individual
POST /api/nubia/storefront/{subdomain}/order          → crear pedido
POST /api/nubia/storefront/{subdomain}/payment/mercadopago  → crear preferencia MP
POST /api/nubia/storefront/{subdomain}/payment/coinbase     → crear charge CB
POST /api/nubia/storefront/{subdomain}/payment/webhook/mp   → IPN webhook MP
POST /api/nubia/storefront/{subdomain}/payment/webhook/coinbase → webhook CB
```

---

## MercadoPago en Nubia — Estado actual

### ¿Cómo funciona?

Cada tienda tiene sus **propias credenciales de MercadoPago** guardadas en `nb_payment_config`. El sistema no usa credenciales globales del sistema NL360.

**Flujo de un pago:**

```
Comprador en storefront
  → POST /storefront/{sub}/payment/mercadopago
      → lee access_token del dueño desde nb_payment_config
      → llama a MercadoPago API con el token del dueño
      → retorna init_point (URL de checkout de MP)
  → Comprador paga en MercadoPago
  → MP llama al webhook /storefront/{sub}/payment/webhook/mp
      → verifica el pago con el access_token del dueño
      → actualiza el pedido en DB (payment_status = "paid")
```

### Cómo el dueño configura sus credenciales

**Flujo actual (manual):**
1. El dueño va al panel de su tienda en NL360
2. Abre la sección "Métodos de pago"
3. Copia su `access_token` y `public_key` desde su cuenta en MercadoPago Developers
4. Los pega en el formulario (`NubiaPaymentConfig.tsx`)
5. Guarda → se persiste en `nb_payment_config`

**Datos guardados:**
```
nb_payment_config
  ├── mercadopago_enabled       (0/1)
  ├── mercadopago_access_token  (token de producción del dueño)
  ├── mercadopago_public_key    (clave pública del dueño)
  ├── mercadopago_country       (AR/MX/CO/CL/BR/UY/PE)
  └── mercadopago_currency      (ARS/MXN/COP/etc.)
```

### Qué se expone al storefront (frontend)

El `store-config.json` inyectado en el build solo incluye el `public_key` (necesario para el Brick de MP en el frontend). El `access_token` nunca sale del backend.

```json
"mercadopago": {
  "enabled": true,
  "publicKey": "APP_USR-xxxxx",
  "country": "AR",
  "currency": "ARS"
}
```

### Estado de la integración

| Funcionalidad | Estado |
|---------------|--------|
| Pago con MP Checkout Pro | ✅ Implementado |
| Credenciales por tienda (no globales) | ✅ Implementado |
| Webhook IPN (confirmar pagos) | ✅ Implementado |
| Soporte multi-país LATAM (AR/MX/CO/CL/BR/UY/PE) | ✅ Implementado |
| Ingreso de credenciales vía formulario manual | ✅ Implementado |
| OAuth flow (conectar con un click) | ❌ No implementado |
| Refresh automático de access_token | ❌ No implementado |

### Qué falta (OAuth)

El sistema actual requiere que el dueño vaya manualmente a MercadoPago Developers y copie sus keys. Para un flow OAuth completo (botón "Conectar con MercadoPago") se necesitaría:

1. **Env vars**: `MERCADOPAGO_APP_ID` + `MERCADOPAGO_APP_SECRET` + `MERCADOPAGO_OAUTH_REDIRECT_URI`
2. **Endpoint start**: `GET /api/nubia/auth/mercadopago/start` — redirige al usuario a la pantalla de autorización de MP
3. **Endpoint callback**: `GET /api/nubia/auth/mercadopago/callback` — recibe el `authorization_code`, lo intercambia por `access_token` + `refresh_token`, guarda en DB
4. **Refresh automático**: antes de crear cada preferencia, verificar si el token expiró y renovarlo
5. **Campos extra en DB**: `mercadopago_refresh_token`, `mercadopago_token_expires_at`

**Conclusión**: La integración es funcional para producción con el flujo manual. El OAuth es una mejora UX pendiente, no un bloqueante.

---

## Otros métodos de pago en Nubia

### Transferencia bancaria

Ingreso manual de datos bancarios (CBU, alias, banco, titular). El comprador ve los datos y transfiere por su cuenta. El dueño confirma el pago manualmente desde el panel.

### Coinbase Commerce (cripto)

- Credenciales manuales: `coinbase_api_key` + `coinbase_webhook_secret`
- Crea un "charge" en Coinbase Commerce
- Webhook verifica la firma HMAC-SHA256 y actualiza el pedido automáticamente

---

## Manu - Forge

### Qué es
Agente conversacional especializado en **tokenización de activos reales en blockchain**. Permite crear smart contracts ERC-20, ERC-721 y ERC-1155 para representar activos tangibles (terrenos, vehículos, obras de arte, empresas, membresías) sin requerir conocimiento técnico de Solidity.

### Flujo completo

```
Chat (Claude sonnet-4-6)
  → Recolecta: tipo de activo, nombre/símbolo del token, estándar ERC, red, features
  → Emite <FORGE_READY>{JSON}</FORGE_READY> cuando tiene todo

POST /api/forge/compile
  → generateSolidity() — Claude genera el código .sol con OpenZeppelin v5
  → compileSolidity() — solc-js compila a ABI + bytecode
  → Guarda en fg_contracts

POST /api/forge/deploy
  → Deploy automático a testnet con wallet del servidor (FORGE_DEPLOYER_PRIVATE_KEY)
  → Redes: Polygon Amoy, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia

POST /api/forge/verify (opcional)
  → Verifica source code en Etherscan (Standard JSON Input con dependencias OZ)
  → Polling GET /api/forge/verify?guid=X para saber si pasó

Deploy a Mainnet (opcional, vía MetaMask)
  → El usuario firma desde su propio wallet en el browser (ethers.js)
  → Frontend envía resultado a POST /api/forge/deploy-save
  → Redes mainnet: Polygon, Ethereum, Base, Arbitrum
```

### Tecnologías

| Componente | Tecnología |
|------------|-----------|
| Chat + generación de Solidity | Claude sonnet-4-6 |
| Compilación | solc-js |
| Librerías de contratos | OpenZeppelin v5 |
| Deploy testnet (servidor) | ethers.js v6 |
| Deploy mainnet (usuario) | ethers.js en browser + MetaMask |
| Verificación | Etherscan API (compartida para todas las redes) |
| DB | MySQL — tablas `fg_projects`, `fg_contracts`, `fg_chat_history` |

### Endpoints

| Endpoint | Método | Qué hace |
|----------|--------|----------|
| `/api/forge/chat` | POST | Conversación, crea/actualiza proyecto |
| `/api/forge/compile` | POST | Genera Solidity + compila con solc-js |
| `/api/forge/deploy` | POST | Deploy a testnet con wallet del servidor |
| `/api/forge/deploy-save` | POST | Guarda deploy de mainnet (MetaMask) |
| `/api/forge/verify` | POST/GET | Verificación en Etherscan + polling |
| `/api/forge/token-info` | GET | Lee estado del token en vivo desde blockchain |
| `/api/forge/analytics` | GET | Historial de transferencias desde Etherscan |
| `/api/forge/marketplace` | GET | Lista todos los tokens deployados (público) |
| `/api/forge/projects` | GET | Proyectos del usuario autenticado |
| `/api/forge/download` | GET | Descarga paquete: contrato + ABI + deploy script + README |

### Marketplace

Página pública que lista todos los proyectos con status `deployed_testnet` o `deployed_mainnet`. Permite filtrar por red (Polygon/Ethereum/Base/Arbitrum) y estándar (ERC-20/721/1155), buscar por nombre/símbolo/dirección, y ver si el contrato está verificado en el explorador.

### Base de datos

```
fg_projects        → datos del token, estado, direcciones de contrato
fg_contracts       → source code, ABI, bytecode
fg_chat_history    → historial de mensajes del chat
```

### Estado actual

| Funcionalidad | Estado |
|---------------|--------|
| Chat conversacional + marcadores visuales | ✅ Completo |
| Generación de Solidity con Claude | ✅ Completo |
| Compilación con solc-js + OpenZeppelin v5 | ✅ Completo |
| Deploy automático a testnet (4 redes) | ✅ Completo |
| Deploy a mainnet vía MetaMask | ✅ Completo |
| Dashboard del token (info en vivo) | ✅ Completo |
| Analytics de transferencias | ✅ Completo |
| Marketplace público | ✅ Completo |
| Descarga de paquete (contrato + ABI) | ✅ Completo |
| Verificación en Etherscan | ⚠️ Incompleto |
| Límites de uso / rate limiting | ❌ No existe |
| UI para verificar balance del deployer | ❌ No existe |

### Pendientes y bugs

**1. Verificación de contratos — polling frontend roto**
El endpoint POST `/api/forge/verify` envía a Etherscan y retorna un `guid`. En `TokenDashboard.tsx` hay una llamada a `pollVerifyStatus(guid, network, url)` pero **esa función no está definida**. El usuario envía la verificación, pero nunca recibe confirmación automática de que pasó — tiene que recargar la página.

**2. Network hardcodeada en `ContractViewer` y `WalletDeploy`**
Ambos componentes pasan `network="polygon"` de forma fija, independientemente de la red que el usuario eligió para el proyecto. Si el usuario creó un proyecto en Ethereum, el deploy mainnet sigue apuntando a Polygon.

**3. `constructorArgs` nunca se pasa a la verificación**
`forge-verifier.ts` acepta `constructorArgs?: string` en su firma, pero `/api/forge/verify/route.ts` nunca lo envía. Para contratos con argumentos en el constructor, la verificación en Etherscan podría fallar.

**4. Sin límites de uso**
No hay throttling, ni contador de tokens/requests por usuario, ni límite de proyectos. Solo hay un check de acceso por rol de plan WordPress. Cualquier usuario del plan que incluye Forge puede crear proyectos ilimitados.

**5. Sin verificación en mainnet**
Después de un deploy a mainnet vía MetaMask, no hay opción para verificar el contrato en el explorador de la red mainnet correspondiente.

### Variables de entorno requeridas

```
FORGE_DEPLOYER_PRIVATE_KEY   # Wallet del servidor para deploy a testnet
FORGE_DEPLOYER_ADDRESS       # Address pública de esa wallet
ETHERSCAN_API_KEY            # Para verificación de contratos
ANTHROPIC_API_KEY            # Para Claude (compartido con otros agentes)
```
