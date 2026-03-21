type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEvent {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(event: LogEvent): void {
  const payload = JSON.stringify(event);
  if (event.level === "error") {
    console.error(payload);
    return;
  }
  if (event.level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
}

export function logEvent(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  write({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

export function logInfo(message: string, meta: Record<string, unknown> = {}): void {
  logEvent("info", message, meta);
}

export function logWarn(message: string, meta: Record<string, unknown> = {}): void {
  logEvent("warn", message, meta);
}

export function logError(message: string, meta: Record<string, unknown> = {}): void {
  logEvent("error", message, meta);
}
