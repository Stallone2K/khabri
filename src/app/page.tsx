
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Marketing } from '@/components/marketing/marketing';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // When the session status is confirmed and the user is authenticated,
    // redirect them to the main dashboard.
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  // If the session status is still loading, show a spinner.
  if (status === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If the user is unauthenticated, show the login page.
  // The useEffect hook will handle redirecting them if they log in.
  if (status === 'unauthenticated') {
    return <Marketing />;
  }

  // Fallback for any other state, though typically not reached.
  return null;
}
