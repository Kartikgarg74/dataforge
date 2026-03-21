'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { LoginForm } from './login-form';

interface Session {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SessionContextValue {
  session: Session | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  refresh: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function AuthGate({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'me' }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setSession({ user: data.user });
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-md p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ session, isLoading, refresh: fetchSession }}>
      <div className={className}>{children}</div>
    </SessionContext.Provider>
  );
}
