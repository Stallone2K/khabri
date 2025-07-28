
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
// Update the path below to the correct location of LoginPage, for example:
import { LoginPage } from '../components/auth/auth';
// If the filename is different, adjust accordingly, e.g.:
// import { LoginPage } from '@/components/auth/login-page';
// Make sure the file exists at the specified path.
import { Loader2 } from 'lucide-react';

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
    return <LoginPage />;
  }

  // Fallback for any other state, though typically not reached.
  return null;
}
