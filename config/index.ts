//config/index.ts
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { monadTestnet } from '@reown/appkit/networks';


// Directly create the wagmiAdapter here
export const wallet_wagmiAdapter = new WagmiAdapter({
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
    networks: [monadTestnet],
  
  });
  
  // createAppKit initialization
  createAppKit({
    adapters: [wallet_wagmiAdapter],
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
    networks: [monadTestnet],
    features:{
      email: false,
      socials: []
    }
  });


