const IS_DEV = process.env.NODE_ENV !== "production";

type Level = "info" | "warn" | "error";

const ICONS: Record<Level, string> = {
  info:  "ℹ",
  warn:  "⚠",
  error: "✕",
};

function format(service: string, level: Level, message: string): string {
  const ts = new Date().toISOString();
  const icon = ICONS[level];
  const pad = " ".repeat(Math.max(0, 12 - service.length));
  return `[NL360 · ${service}]${pad}${icon}  ${message}  (${ts})`;
}

export function createLogger(service: string) {
  return {
    info(message: string): void {
      console.info(format(service, "info", message));
    },

    warn(message: string): void {
      console.warn(format(service, "warn", message));
    },

    error(message: string, error?: unknown): void {
      const line = format(service, "error", message);
      if (error instanceof Error) {
        if (IS_DEV) {
          console.error(line, "\n", error.stack ?? error.message);
        } else {
          console.error(line, `— ${error.message}`);
        }
      } else if (error !== undefined) {
        console.error(line, "—", error);
      } else {
        console.error(line);
      }
    },
  };
}
