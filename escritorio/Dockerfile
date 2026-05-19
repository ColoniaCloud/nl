# 1) Dependencias
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2) Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_VOICE_FALLBACK=0
ENV NEXT_PUBLIC_VOICE_FALLBACK=$NEXT_PUBLIC_VOICE_FALLBACK
RUN npm run build

# 3) Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Docker CLI para ejecutar builds desde la API + rsync para copiar templates
RUN apk add --no-cache docker-cli rsync


# Copiar archivos de currículum de mentoria
COPY --from=builder /app/data/mentoria /app/data/mentoria

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
