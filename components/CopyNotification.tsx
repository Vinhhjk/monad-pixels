import React from 'react';

interface CopyNotificationProps {
  show: boolean;
  address: string;
}

export default function CopyNotification({ show, address }: CopyNotificationProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
      <div className="bg-gray-800 bg-opacity-95 rounded-lg shadow-lg border border-gray-600 p-4 flex items-center gap-3 max-w-md">
        <div className="flex-shrink-0">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-green-400 font-semibold text-sm">Copied!</p>
          <p className="text-gray-300 text-xs">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  );
}
