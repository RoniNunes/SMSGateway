import { handleHealth } from '@/lib/handlers/health';

export async function GET() {
  return handleHealth();
}