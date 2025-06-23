// components/ConnectButton.tsx
'use client';

import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

export default function ConnectButton() {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();

  // Create a shortened address format
  const shortenedAddress = address 
    ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    : '';

  return (
    <div className="flex flex-col items-end">
      <button 
        onClick={() => open()} 
        className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
          isConnected ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'
        } transition-colors`}
      >
        {isConnected ? shortenedAddress : 'Connect Wallet'}
      </button>

    </div>
  );
}
