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

export const getSession = (userId: string) => sessions.get(userId);

export async function startSession(userId: string): Promise<void> {
  const existing = sessions.get(userId);
  if (existing?.status === "connected") {
    console.log(`[session] ℹ️  Session ${userId} already connected`);
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
    reconnectAttempts: 0, // 🔒 Inicializar contador
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
      try {
        await onEvent(userId, "CONNECTED", { phone, displayName });
      } catch (error) {
        console.error(`[session] onEvent CONNECTED failed for ${userId}:`, error);
      }
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const isLogout = code === DisconnectReason.loggedOut;

      if (isLogout) {
        sessions.delete(userId);
        console.log(`[session] 🔓 Session ${userId} logged out and removed`);
      } else {
        sessions.set(userId, { ...session, status: "disconnected" });
      }

      console.log(
        `[session] ❌ Disconnected ${userId} (code: ${code ?? 0}${isLogout ? " - logged out" : ""})`
      );
      try {
        await onEvent(userId, "DISCONNECTED", { code: code ?? 0 });
      } catch (error) {
        console.error(`[session] onEvent DISCONNECTED failed for ${userId}:`, error);
      }

      if (!isLogout && session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(1.5, session.reconnectAttempts);
        sessions.set(userId, { ...session, reconnectAttempts: session.reconnectAttempts + 1 });

        console.log(
          `[session] 🔄 Reconnect attempt ${session.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} ` +
          `in ${Math.round(backoff)}ms for ${userId}`
        );

        setTimeout(() => startSession(userId), backoff);
      } else if (!isLogout && session.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(
          `[session] 💀 Max reconnection attempts reached for ${userId}. ` +
          `Manual intervention required. Run POST /sessions/${userId}/reset to clear state.`
        );
        sessions.delete(userId);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

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
