import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs/promises";
import path from "path";
import { toDataURL } from "qrcode";
import { resolveAck } from "./lib/campaign-ack-registry";

const AUTH_BASE = path.resolve(process.cwd(), "auth_states");
const MAX_RECONNECT_ATTEMPTS = 5; // 🔒 Límite de reintentos
const INITIAL_BACKOFF_MS = 5000; // 5 segundos

let cachedBaileysVersion: { version: number[] } | null = null;

interface SessionData {
  socket: WASocket;
  qrBase64: string | null;
  status: "qr_pending" | "connected" | "disconnected" | "error";
  phone: string | null;
  displayName: string | null;
  reconnectAttempts: number; // 🔒 Contador de reintentos
}

const sessions = new Map<string, SessionData>();

type EventCallback = (
  userId: string,
  event: string,
  data: Record<string, unknown>
) => Promise<void>;

let onEvent: EventCallback = async () => {};
export const setEventCallback = (cb: EventCallback) => { onEvent = cb; };

// 📡 Subscriptores SSE en vivo, por userId — entrega en tiempo real sin pasar por DB
type SseSubscriber = (event: string, data: Record<string, unknown>) => void;
const sseSubscribers = new Map<string, Set<SseSubscriber>>();

export function subscribeToEvents(userId: string, cb: SseSubscriber): () => void {
  let set = sseSubscribers.get(userId);
  if (!set) {
    set = new Set();
    sseSubscribers.set(userId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) sseSubscribers.delete(userId);
  };
}

function publish(userId: string, event: string, data: Record<string, unknown>) {
  const set = sseSubscribers.get(userId);
  if (!set) return;
  for (const cb of set) cb(event, data);
}

// 📣 Permite a otros módulos (p. ej. campaign-runner) emitir eventos por los
// mismos canales que usa una sesión (SSE en vivo + webhook hacia escritorio).
export async function emitEvent(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
  publish(userId, event, data);
  try {
    await onEvent(userId, event, data);
  } catch (error) {
    console.error(`[session] onEvent ${event} failed for ${userId}:`, error);
  }
}

export const getSession = (userId: string) => sessions.get(userId);

export async function startSession(userId: string, initialReconnectAttempts = 0): Promise<void> {
  const existing = sessions.get(userId);
  if (existing?.status === "connected") {
    console.log(`[session] ℹ️  Session ${userId} already connected`);
    return;
  }

  // 🔁 Idempotente: si ya hay un QR pendiente en curso, no reiniciar el socket
  // (evita que un remount de React en el frontend mate una sesión en progreso)
  if (existing?.status === "qr_pending") {
    console.log(`[session] ℹ️  Session ${userId} already qr_pending, reusing`);
    if (existing.qrBase64) {
      publish(userId, "QR_UPDATE", { qrBase64: existing.qrBase64 });
    }
    return;
  }

  if (existing) {
    try {
      await existing.socket.logout();
    } catch (error) {
      console.warn(`[session] ⚠️  Failed to clean up previous socket for ${userId}:`, error);
    }
    sessions.delete(userId);
  }

  console.log(`[session] 🔄 Starting session for ${userId}...`);

  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(AUTH_BASE, `session_${userId}`)
  );

  if (!cachedBaileysVersion) {
    cachedBaileysVersion = await fetchLatestBaileysVersion();
  }

  const { version } = cachedBaileysVersion;

  // Asegurar que `version` sea una tupla [major, minor, patch] exigida por Baileys
  const versionTuple: [number, number, number] = [
    (version && version[0]) ?? 0,
    (version && version[1]) ?? 0,
    (version && version[2]) ?? 0,
  ];

  const sock = makeWASocket({ version: versionTuple, auth: state, printQRInTerminal: false });

  sessions.set(userId, {
    socket: sock,
    qrBase64: null,
    status: "qr_pending",
    phone: null,
    displayName: null,
    reconnectAttempts: initialReconnectAttempts, // 🔒 Preserva el contador entre reinicios automáticos
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    const session = sessions.get(userId);
    if (!session) return;

    const lastDisconnectError = lastDisconnect?.error;
    const lastDisconnectMessage = lastDisconnectError
      ? String((lastDisconnectError as Error).message ?? lastDisconnectError)
      : "none";

    console.log(
      `[session] connection.update ${userId} -> connection=${connection}, qr=${Boolean(qr)}, lastDisconnect=${lastDisconnectMessage}`
    );

    if (qr) {
      const qrBase64 = await toDataURL(qr);
      sessions.set(userId, { ...session, qrBase64, status: "qr_pending" });
      console.log(`[session] 📱 QR code generated for ${userId}`);
      publish(userId, "QR_UPDATE", { qrBase64 });
      try {
        await onEvent(userId, "QR_UPDATE", { qrBase64 });
      } catch (error) {
        console.error(`[session] onEvent QR_UPDATE failed for ${userId}:`, error);
      }
    }

    if (connection === "open") {
      const phone = sock.user?.id?.split(":")[0] ?? null;
      const displayName = sock.user?.name ?? null;
      sessions.set(userId, {
        ...session,
        status: "connected",
        qrBase64: null,
        phone,
        displayName,
        reconnectAttempts: 0, // ✅ Reset counter on success
      });
      console.log(`[session] ✅ Connected ${userId} as ${displayName} (${phone})`);
      publish(userId, "CONNECTED", { phone, displayName });
      try {
        await onEvent(userId, "CONNECTED", { phone, displayName });
      } catch (error) {
        console.error(`[session] onEvent CONNECTED failed for ${userId}:`, error);
      }
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLogout = code === DisconnectReason.loggedOut;

      // 🩹 Auto-sanación: si WhatsApp rechaza las credenciales guardadas (p. ej. el
      // teléfono desvinculó el dispositivo), Baileys reporta esto como "logged out"
      // al intentar RESUMIR la sesión — no como respuesta a un logout explícito del
      // usuario. Si nos quedamos solo borrando la sesión en memoria, las credenciales
      // inválidas siguen en disco y cada intento futuro vuelve a fallar en silencio,
      // sin generar nunca un QR nuevo. Por eso acá se borran las credenciales y se
      // reinicia enseguida: al no quedar creds, Baileys entra en modo "registro" y
      // emite un QR fresco, igual que WhatsApp Web hace cuando tu sesión expira.
      if (isLogout) {
        sessions.delete(userId);
        console.log(`[session] 🔓 Session ${userId} logged out (credenciales inválidas) — limpiando`);
        await deleteAuthState(userId);
      } else {
        sessions.set(userId, { ...session, status: "disconnected" });
      }

      console.log(
        `[session] ❌ Disconnected ${userId} (code: ${code ?? 0}${isLogout ? " - logged out" : ""})`
      );
      publish(userId, "DISCONNECTED", { code: code ?? 0 });
      try {
        await onEvent(userId, "DISCONNECTED", { code: code ?? 0 });
      } catch (error) {
        console.error(`[session] onEvent DISCONNECTED failed for ${userId}:`, error);
      }

      if (session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(1.5, session.reconnectAttempts);

        console.log(
          `[session] 🔄 Reconnect attempt ${session.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS} ` +
          `in ${Math.round(backoff)}ms for ${userId}${isLogout ? " (con QR nuevo)" : ""}`
        );
        publish(userId, "RECONNECTING", { attempt: session.reconnectAttempts + 1 });

        const nextAttempts = session.reconnectAttempts + 1;
        setTimeout(() => startSession(userId, nextAttempts), backoff);
      } else {
        console.error(
          `[session] 💀 Max reconnection attempts reached for ${userId}. ` +
          `Manual intervention required. Run POST /sessions/${userId}/reset to clear state.`
        );
        publish(userId, "ERROR", { message: "max_reconnect_attempts_reached" });
        sessions.delete(userId);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (!key.fromMe || !key.id || update.status == null) continue;
      const ackInfo = resolveAck(key.id);
      if (!ackInfo) continue;

      // Baileys WAMessageStatus: 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
      let status: "delivered" | "read" | null = null;
      if (update.status === 3) status = "delivered";
      else if (update.status === 4 || update.status === 5) status = "read";
      if (!status) continue;

      try {
        await onEvent(userId, "CAMPAIGN_MESSAGE_ACK", {
          campaignId: ackInfo.campaignId,
          recipientId: ackInfo.recipientId,
          status,
        });
      } catch (error) {
        console.error(`[session] onEvent CAMPAIGN_MESSAGE_ACK failed for ${userId}:`, error);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;
    for (const msg of msgs) {
      if (!msg.message || msg.key.fromMe) continue;
      console.log(`[session] 📨 Inbound message from ${msg.key.remoteJid} for ${userId}`);
      try {
        await onEvent(userId, "MESSAGE_INBOUND", {
          message: msg as unknown as Record<string, unknown>,
        });
      } catch (error) {
        console.error(`[session] onEvent MESSAGE_INBOUND failed for ${userId}:`, error);
      }
    }
  });
}

async function deleteAuthState(userId: string): Promise<void> {
  const authPath = path.join(AUTH_BASE, `session_${userId}`);
  try {
    await fs.rm(authPath, { recursive: true, force: true });
    console.log(`[session] 🧹 Removed auth state for ${userId}`);
  } catch (error) {
    console.warn(`[session] ⚠️ Failed to remove auth state for ${userId}:`, error);
  }
}

export async function logoutSession(userId: string): Promise<void> {
  const session = sessions.get(userId);
  if (session) {
    try {
      await session.socket.logout();
      console.log(`[session] 🚪 Logged out ${userId}`);
    } catch (e) {
      console.warn(`[session] ⚠️  Error during logout for ${userId}:`, e);
    }
    sessions.delete(userId);
  }
}

export async function resetSession(userId: string): Promise<void> {
  await logoutSession(userId);
  await deleteAuthState(userId);
}
