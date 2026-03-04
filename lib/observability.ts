import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

export function getRequestContext(req: NextRequest, route: string) {
  const requestId = req.headers.get('x-request-id') || randomUUID();
  const startedAt = Date.now();

  function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
    const payload = {
      level,
      route,
      requestId,
      message,
      durationMs: Date.now() - startedAt,
      ...meta
    };
    if (level === 'error') console.error(JSON.stringify(payload));
    else if (level === 'warn') console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  }

  return { requestId, log };
}

export function extractOriginHost(req: NextRequest): string {
  const origin = req.headers.get('origin');
  if (!origin) return '';
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}
