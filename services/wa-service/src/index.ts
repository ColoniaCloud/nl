import express from "express";
import { setEventCallback } from "./session-store";
import { authGuard } from "./auth-guard";
import startRouter    from "./routes/start";
import qrRouter       from "./routes/qr";
import statusRouter   from "./routes/status";
import sendRouter     from "./routes/send";
import contactsRouter from "./routes/contacts";
import historyRouter  from "./routes/history";
import logoutRouter   from "./routes/logout";
import resetRouter    from "./routes/reset";
import eventsRouter   from "./routes/events";
import campaignRouter from "./routes/campaign";

// 🔒 Validación de variables de entorno en arranque
function validateEnvironment() {
  const required = ["SERVICE_SECRET", "NL360_URL", "WEBHOOK_SECRET"];
  const missing = required.filter(v => !process.env[v] || process.env[v]!.trim() === "");
  
  if (missing.length > 0) {
    throw new Error(
      `FATAL: Missing or empty environment variables: ${missing.join(", ")}. ` +
      "Check your .env file before starting the service."
    );
  }
  
  console.log("✅ Environment validation passed");
}

validateEnvironment();

const app = express();
app.use(express.json({ limit: "10mb" }));

// 📊 Health check endpoint (sin auth para que docker-compose pueda verificar)
app.get("/health", (req, res) => {
  // Permitir acceso sin auth solo para health
  const isConfigured = process.env.SERVICE_SECRET && process.env.NL360_URL && process.env.WEBHOOK_SECRET;
  
  if (!isConfigured) {
    return res.status(503).json({ 
      status: "unhealthy",
      reason: "Missing environment configuration"
    });
  }
  
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 3002
  });
});

// Aplicar `authGuard` a todas las rutas excepto `/health`
app.use(authGuard);

app.use("/sessions", startRouter);
app.use("/sessions", qrRouter);
app.use("/sessions", statusRouter);
app.use("/sessions", sendRouter);
app.use("/sessions", contactsRouter);
app.use("/sessions", historyRouter);
app.use("/sessions", logoutRouter);
app.use("/sessions", resetRouter);
app.use("/sessions", eventsRouter);
app.use("/sessions", campaignRouter);

setEventCallback(async (userId, event, data) => {
  const maxRetries = 3;
  let lastError: Error | null = null;

  // 🔄 Reintentos exponenciales para webhook
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${process.env.NL360_URL}/api/whatsapp/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.WEBHOOK_SECRET!,
        },
        body: JSON.stringify({ userId, event, data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[webhook] ✅ ${event} for ${userId} (attempt ${attempt + 1})`);
      return; // Success
    } catch (e) {
      lastError = e as Error;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      
      console.warn(
        `[webhook] ⚠️ Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. ` +
        (attempt < maxRetries - 1 ? `Retrying in ${delay}ms...` : "Giving up.")
      );

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Después de todos los reintentos
  console.error(
    `[webhook] ❌ Failed to deliver ${event} for ${userId} after ${maxRetries} attempts: ${lastError?.message}`
  );
});

const PORT = Number(process.env.PORT ?? 3002);
app.listen(PORT, () => {
  console.log(`[wa-service] 🚀 Server running on port ${PORT}`);
  console.log(`[wa-service] 🔗 Webhook endpoint: ${process.env.NL360_URL}/api/whatsapp/webhook`);
});
