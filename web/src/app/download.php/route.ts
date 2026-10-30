import { streamApkDownload } from '@/lib/apk';
import { requireUser } from '@/lib/session';

export async function GET() {
  try {
    const user = await requireUser();
    if (!user.isActive) {
      return new Response('Conta desactivada.', { status: 403 });
    }
  } catch {
    return new Response('Não autenticado.', { status: 401 });
  }

  return streamApkDownload();
}