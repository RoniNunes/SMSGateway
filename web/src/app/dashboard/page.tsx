import DashboardClient from '@/components/DashboardClient';
import { getLegalSettings } from '@/lib/legal-settings';
import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user || !user.isActive) redirect('/login');

  const legal = await getLegalSettings();

  return (
    <DashboardClient
      dpoEmail={legal.dpoEmail}
      initialUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        api_key: user.apiKey ?? '',
        is_admin: user.role === 'admin',
        can_webhook: user.role === 'admin' || user.webhookEnabled,
      }}
    />
  );
}