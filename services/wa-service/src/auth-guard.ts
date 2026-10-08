import { Request, Response, NextFunction } from "express";

// 🔒 CRÍTICO: Validar que SERVICE_SECRET esté configurado
const SERVICE_SECRET = process.env.SERVICE_SECRET;
if (!SERVICE_SECRET || SERVICE_SECRET.trim() === "") {
  throw new Error(
    "FATAL: SERVICE_SECRET environment variable not set or empty. " +
    "Configure it in .env before starting the service."
  );
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  // Comparar el header con la variable validada en arranque
  if (req.headers["x-service-secret"] !== SERVICE_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
