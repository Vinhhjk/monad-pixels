import React from 'react';

interface IndividualDelegationPopupProps {
  show: boolean;
  onClose: () => void;
  selectedPixel: [number, number] | null;
  pixelDelegatedAddresses: string[];
  isRevokingApproval: boolean;
  revokingAddress: string | null;
  address: string | null | undefined;
  getPixelOwner: (x: number, y: number) => string | null;
  copyToClipboard: (text: string) => void;
  revokeSingleDelegation: (x: number, y: number, delegatedAddress: string) => void;
  revokeAllDelegations: (x: number, y: number, addresses: string[]) => void;
}

export default function IndividualDelegationPopup({
  show,
  onClose,
  selectedPixel,
  pixelDelegatedAddresses,
  isRevokingApproval,
  revokingAddress,
  address,
  getPixelOwner,
  copyToClipboard,
  revokeSingleDelegation,
  revokeAllDelegations,
}: IndividualDelegationPopupProps) {
  if (!show || !selectedPixel) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            🔑 Pixel ({selectedPixel[0]}, {selectedPixel[1]}) Delegations
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {pixelDelegatedAddresses.length === 0 ? (
            <p className="text-gray-400 text-sm">No delegations found</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-gray-300 text-sm">
                  {pixelDelegatedAddresses.length} delegation(s) found
                </p>
                {/* ❌ All button for individual pixel */}
                {selectedPixel &&
                  getPixelOwner(selectedPixel[0], selectedPixel[1])?.toLowerCase() === address?.toLowerCase() && (
                    <button
                      onClick={() =>
                        revokeAllDelegations(
                          selectedPixel[0],
                          selectedPixel[1],
                          pixelDelegatedAddresses
                        )
                      }
                      disabled={isRevokingApproval}
                      className="hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs px-3 py-1 rounded transition-colors"
                      title="Revoke all delegations for this pixel"
                    >
                      {isRevokingApproval ? "..." : "❌ All"}
                    </button>
                  )}
              </div>
              <div className="space-y-2">
                {pixelDelegatedAddresses.map((addr, index) => (
                  <div
                    key={index}
                    className="bg-gray-700 rounded p-3 flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-blue-300 font-mono text-xs break-all">
                        {addr}
                      </span>
                      <span className="text-gray-400 text-xs mt-1">
                        {addr.slice(0, 6)}...{addr.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(addr)}
                        className="text-gray-400 hover:text-white p-1 transition-colors hover:bg-gray-600"
                        title="Copy address"
                      >
                        📋
                      </button>
                      {/* Only show revoke button if user owns the pixel */}
                      {selectedPixel &&
                        getPixelOwner(selectedPixel[0], selectedPixel[1])?.toLowerCase() === address?.toLowerCase() && (
                          <button
                            onClick={() =>
                              revokeSingleDelegation(
                                selectedPixel[0],
                                selectedPixel[1],
                                addr
                              )
                            }
                            disabled={revokingAddress === addr}
                            className="bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs px-2 py-1 rounded transition-colors"
                            title="Revoke this delegation"
                          >
                            {revokingAddress === addr ? "..." : "❌"}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-gray-600 pt-4">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
