'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Encode current path for redirect after login
      const redirectPath = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirectPath}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  // Don't render children until authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
