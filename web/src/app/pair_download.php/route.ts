import { apkPath, streamApkDownload } from '@/lib/apk';
import { validatePublicPairing } from '@/lib/pairing';
import { queryParam } from '@/lib/params';
import { existsSync } from 'fs';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const code = queryParam(req, 'code').trim().toUpperCase();
  const sig = queryParam(req, 'sig').trim();

  if (!code || !sig) {
    return new Response('Link de pareamento inválido ou expirado.', { status: 403 });
  }

  const pending = await validatePublicPairing(code, sig);
  if (!pending) {
    return new Response('Link de pareamento inválido ou expirado.', { status: 403 });
  }

  if (!existsSync(apkPath())) {
    return new Response('APK não disponível no servidor.', { status: 404 });
  }

  return streamApkDownload();
}