import Providers from '@/components/Providers';
import { getMessages } from '@/i18n/config';
import { detectLocale } from '@/i18n/detect';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SMS Gateway — Android SMS Gateway, API & n8n',
  description:
    'Turn an Android phone into a professional SMS gateway. Dashboard, REST API, webhooks, and automations.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const locale = detectLocale(
    headersList.get('accept-language'),
    cookieStore.get('locale')?.value,
  );
  const messages = await getMessages(locale);

  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}