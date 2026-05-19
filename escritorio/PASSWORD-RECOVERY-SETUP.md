# 🔐 Password Recovery System — Setup Guide

**Status**: ✅ IMPLEMENTADO  
**Date**: 2026-04-15  
**Feature**: Complete password recovery flow with email support

---

## ✨ Qué Se Agregó

### Páginas Nuevas
- ✅ `/recuperar-contrasena` — Formulario para solicitar reset
- ✅ `/resetear-contrasena` — Página para cambiar contraseña con token

### APIs Nuevas
- ✅ `POST /api/auth/forgot-password` — Generar token + enviar email
- ✅ `POST /api/auth/reset-password` — Validar token + cambiar contraseña

### UI Actualizada
- ✅ Login form: Added "¿Olvidaste tu contraseña?" link
- ✅ Login form: Added "Crear cuenta" link

---

## 🚀 Características

### Seguridad
- ✅ Tokens generados con `crypto.randomBytes(32)` (256 bits)
- ✅ Tokens expiración automática (1 hora)
- ✅ Tokens marcados como "usado" después de activarse
- ✅ Validación de token antes de mostrar formulario
- ✅ Limpieza automática de resets antiguos (7+ días)
- ✅ No revela si el usuario existe (previene user enumeration)

### UX
- ✅ Validación de contraseña (mínimo 8 caracteres)
- ✅ Show/hide password toggle
- ✅ Confirmación de contraseña coincide
- ✅ Loading states
- ✅ Error messages claros
- ✅ Success confirmations
- ✅ Email reminders para revisar spam

### Integración
- ✅ Sincronizado con WordPress API
- ✅ Funciona con usuarios existentes
- ✅ Cambia contraseña en WordPress automáticamente
- ✅ Compatible con JWT auth existente

---

## ⚙️ Configuración Requerida

### Email (Opcional pero Recomendado)

Para habilitar envío de emails con enlaces de reset, agrega a `.env.production`:

```bash
# SMTP Configuration (para sendgrid, office365, etc.)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxx
SMTP_FROM=noreply@nl360.site

# O si no tienes SMTP, los enlaces se loguean en console
# Los usuarios pueden copiar manualmente del server logs
```

**Sin SMTP**: Los enlaces aparecerán en logs del server (útil para desarrollo)  
**Con SMTP**: Los usuarios reciben emails automáticos

### Instalación Opcional de NodeMailer

Si planeas usar SMTP, instala nodemailer:

```bash
cd /opt/docker-apps/escritorio
npm install nodemailer
npm install -D @types/nodemailer

# Luego rebuild
docker compose up -d --build escritorio
```

---

## 📊 Base de Datos

Se crea automáticamente una tabla `password_resets`:

```sql
CREATE TABLE password_resets (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES wp_users(ID) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id)
);
```

---

## 🧪 Testing

### Test 1: Solicitar Reset Email

```bash
# 1. Go to login page
https://nl360.site/login

# 2. Click "¿Olvidaste tu contraseña?"

# 3. Enter username or email
# Expected: "Email enviado" message

# 4. Check email inbox (or server logs if no SMTP)
```

### Test 2: Reset Contraseña

```bash
# 1. From email, click reset link
#    Should go to: https://nl360.site/resetear-contrasena?token=xxx&uid=123

# 2. Enter new password (min 8 chars)

# 3. Confirm password

# 4. Click "Cambiar contraseña"
#    Expected: "¡Listo!" success message

# 5. Login with new credentials
#    https://nl360.site/login
```

### Test 3: Toquen Inválido/Expirado

```bash
# 1. Manually enter invalid token URL:
#    https://nl360.site/resetear-contrasena?token=invalid&uid=123

# 2. Expected: "Enlace inválido" error

# 3. Try again after 1 hour
#    Token should be expired automatically
```

### Test 4: Token Reutilizado

```bash
# 1. Generate reset token for user A

# 2. Use it once (password changes)

# 3. Try to use same token again
#    Expected: "Este enlace ya fue usado" error
```

---

## 🔗 URLs Relacionadas

### Public Routes
- [/login](/login) — Login form (updated)
- [/recuperar-contrasena](/recuperar-contrasena) — Request reset
- [/resetear-contrasena](/resetear-contrasena?token=xxx&uid=123) — Reset form

### API Endpoints
- `POST /api/auth/forgot-password` — Request reset token
- `POST /api/auth/reset-password` — Validate token & change password

### Auth Routes (Existing)
- `POST /api/auth/login` — User login
- `POST /api/auth/logout` — User logout
- `GET /api/auth/me` — Current user info

---

##🎯 Flow Diagram

```
User clicks "Olvidaste tu contraseña?"
        ↓
[/recuperar-contrasena]
    ↓ (Ingresa usuario/email)
    ↓
POST /api/auth/forgot-password
    ├─ Find user en WordPress
    ├─ Generate token (valid 1 hour)
    ├─ Save en password_resets table
    └─ Send email con reset link
        ↓
    [Email recibido]
    ↓ (User clickea enlace)
    ↓
[/resetear-contrasena?token=xxx&uid=123]
    ├─ Validate token on page load
    └─ Show form si válido
        ↓ (Ingresa nueva contraseña)
        ↓
    POST /api/auth/reset-password
        ├─ Validate token again (security)
        ├─ Update password en WordPress
        ├─ Mark token as used
        └─ Show success
            ↓
        [/login con nueva contraseña]
```

---

## ⚠️ Troubleshooting

### "No pudimos procesar tu solicitud"

**Posibles causas**:
- WordPress API no es accesible
- Credenciales de WP_APP_USER/WP_APP_PASSWORD incorrectas
- Usuario no existe en WordPress

**Fix**: Verifica en servidor:
```bash
curl https://api.nl360.site/wp-json/wp/v2/users \
  -H "Authorization: Basic $(echo -n 'user:pass' | base64)"
```

### "Error al validar el enlace"

**Posibles causas**:
- Token expirado (> 1 hora)
- Token ya fue usado
- Token/UID inválidos
- Base de datos offline

**Fix**: Solicita nuevo reset

### Email no recibido

**Si tienes SMTP**:
- Verifica SMTP_HOST, SMTP_USER, SMTP_PASS en .env.production
- Revisa spam/junk email
- Mira server logs: `docker compose logs escritorio`

**Si NO tienes SMTP**:
- Reset link está en server logs
- Copia manualmente desde: `docker compose logs escritorio | grep "Reset link"`

---

## 🔐 Security Checklist

- [x] Tokens con expiración automática (1 hora)
- [x] Tokens marcados como "usado"
- [x] No revela si usuario existe
- [x] HTTPS en todos los endpoints
- [x] Validación de contraseña (min 8 chars)
- [x] Password no loguea en console
- [x] Database compartimentado (password_resets table)
- [x] Limpieza automática de resets antiguos
- [x] Integración con WordPress auth

---

## 📝 Próximas Mejoras (Futuro)

- [ ] Rate limiting en forgot-password (previene spam)
- [ ] SMS alternative to email
- [ ] 2FA/TOTP support
- [ ] Audit log de resets
- [ ] Admin panel para ver reset history
- [ ] Password strength meter

---

**Status**: 🟢 READY FOR PRODUCTION  
**Tested**: ✅ Manual testing completed  
**Database**: ✅ Auto-created on first request  
**Email**: ⚠️ Optional (logs to console if no SMTP)

---
