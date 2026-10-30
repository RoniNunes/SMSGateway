import { handleHealth } from '@/lib/handlers/health';

/** @deprecated Use /health — mantido para compatibilidade */
export async function GET() {
  return handleHealth();
}