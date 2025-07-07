import React from 'react';

interface BatchDelegationData {
  totalDelegations: number;
  pixelData: Array<{
    x: number;
    y: number;
    delegationCount: number;
    delegatedAddresses: string[];
  }>;
}

interface BatchDelegationPopupProps {
  show: boolean;
  onClose: () => void;
  batchDelegationData: BatchDelegationData;
  expandedPixel: number | null;
  setExpandedPixel: (index: number | null) => void;
  isRevokingApproval: boolean;
  revokingAddress: string | null;
  address: string | null | undefined;
  getPixelOwner: (x: number, y: number) => string | null;
  copyToClipboard: (text: string) => void;
  revokeSingleDelegation: (x: number, y: number, delegatedAddress: string) => void;
  revokeAllDelegations: (x: number, y: number, addresses: string[]) => void;
}

export default function BatchDelegationPopup({
  show,
  onClose,
  batchDelegationData,
  expandedPixel,
  setExpandedPixel,
  isRevokingApproval,
  revokingAddress,
  address,
  getPixelOwner,
  copyToClipboard,
  revokeSingleDelegation,
  revokeAllDelegations,
}: BatchDelegationPopupProps) {
  if (!show || batchDelegationData.pixelData.length === 0) return null;

  const handleClose = () => {
    onClose();
    setExpandedPixel(null);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            🔑 Batch Delegation Summary (
            {batchDelegationData.totalDelegations} total delegations)
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="space-y-3">
            {batchDelegationData.pixelData.map((pixel, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedPixel(expandedPixel === index ? null : index)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      Pixel ({pixel.x}, {pixel.y})
                    </span>
                    <span className="text-gray-400 text-sm">
                      {pixel.delegationCount} delegation(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* ❌ All button for each pixel */}
                    {address &&
                      getPixelOwner(pixel.x, pixel.y)?.toLowerCase() === address.toLowerCase() && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            revokeAllDelegations(
                              pixel.x,
                              pixel.y,
                              pixel.delegatedAddresses
                            );
                          }}
                          disabled={isRevokingApproval}
                          className="hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs px-3 py-1 rounded transition-colors"
                          title="Revoke all delegations for this pixel"
                        >
                          {isRevokingApproval ? "..." : "❌ All"}
                        </button>
                      )}
                    <span className="text-gray-400 text-xs">
                      {expandedPixel === index ? "▼" : "▶"}
                    </span>
                  </div>
                </div>
                {expandedPixel === index && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pixel.delegatedAddresses.map((addr, addrIndex) => (
                      <div
                        key={addrIndex}
                        className="bg-gray-600 rounded p-2 flex items-center justify-between"
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
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(addr);
                            }}
                            className="text-gray-400 hover:text-white p-1 transition-colors hover:bg-gray-800"
                            title="Copy address"
                          >
                            📋
                          </button>
                          {/* Show revoke button if user owns this pixel */}
                          {address &&
                            getPixelOwner(pixel.x, pixel.y)?.toLowerCase() === address.toLowerCase() && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  revokeSingleDelegation(
                                    pixel.x,
                                    pixel.y,
                                    addr
                                  );
                                }}
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
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t border-gray-600 pt-4">
          <button
            onClick={handleClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
