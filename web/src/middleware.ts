import { detectLocale } from '@/i18n/detect';
import { isValidLocale } from '@/i18n/locales';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = [
  '/login',
  '/health',
  '/health.php',
  '/api/v1',
  '/api_v1.php',
  '/register.php',
  '/save_sms.php',
  '/send_sms.php',
  '/pair.php',
  '/pair_download.php',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  let res: NextResponse;

  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    res = NextResponse.next();
  } else if (
    pathname === '/download' ||
    pathname === '/download.php' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api/dashboard') ||
    pathname.startsWith('/api/realtime')
  ) {
    const session = req.cookies.get('smsgw_session');
    if (!session?.value) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ status: 'error', message: 'Não autenticado.' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', req.url));
    }
    res = NextResponse.next();
  } else {
    res = NextResponse.next();
  }

  const localeCookie = req.cookies.get('locale')?.value;
  if (!localeCookie || !isValidLocale(localeCookie)) {
    const detected = detectLocale(req.headers.get('accept-language'), null);
    res.cookies.set('locale', detected, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return res;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/download',
    '/download.php',
    '/api/dashboard',
    '/api/realtime/:path*',
    '/pair.php',
  ],
};