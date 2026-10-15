import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { endSession } from '@/features/auth/use-me';
import { onSessionLost } from '@/lib/api/client';
import { createQueryClient } from './query-client';

type ProvidersProps = { children: ReactNode; queryClient?: QueryClient };

/** Everything above the router: data cache, theme, tooltips, toasts, session loss. */
export function Providers({ children, queryClient: providedClient }: ProvidersProps) {
  // Created once per mount, never on re-render: recreating it would wipe the cache.
  const [queryClient] = useState(() => providedClient ?? createQueryClient());

  useEffect(() => onSessionLost(() => endSession(queryClient)), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="the-mesh:theme"
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
      {import.meta.env.MODE === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
