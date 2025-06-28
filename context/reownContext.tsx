// context/index.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import {wallet_wagmiAdapter} from '@/config/reownConfig';

const queryClient = new QueryClient();


export function ReownProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wallet_wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
