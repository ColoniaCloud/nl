import { Router } from "express";
import { getSession, subscribeToEvents } from "../session-store";

const router = Router();

router.get("/:userId/events", (req, res) => {
  const { userId } = req.params;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Replay del estado actual al conectar, para que el cliente no espere el próximo evento
  const current = getSession(userId);
  if (current) {
    if (current.status === "connected") {
      send("CONNECTED", { phone: current.phone, displayName: current.displayName });
    } else if (current.qrBase64) {
      send("QR_UPDATE", { qrBase64: current.qrBase64 });
    }
  }

  const unsubscribe = subscribeToEvents(userId, send);

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
