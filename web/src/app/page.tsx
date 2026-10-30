import LandingPage from '@/components/LandingPage';
import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const user = await currentUser();
  if (user?.isActive) redirect('/dashboard');
  return <LandingPage />;
}