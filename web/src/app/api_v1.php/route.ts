import { optionsResponse } from '@/lib/api-response';
import { handleApiV1 } from '@/lib/handlers/api-v1';
import type { NextRequest } from 'next/server';

/** @deprecated Use /api/v1 — mantido para integrações legadas */
export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(req: NextRequest) {
  return handleApiV1(req);
}

export async function POST(req: NextRequest) {
  return handleApiV1(req);
}