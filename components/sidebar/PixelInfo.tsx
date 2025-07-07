import React from 'react';

interface PixelInfoProps {
  selectedPixel: [number, number] | null;
  isDrawMode: boolean;
  drawnPixels: Map<string, string>;
  isAreaSelectMode: boolean;
  selectedColor: string;
  pixelData: { [key: string]: { color: string; owner: string | null; isMinted: boolean } };
  getPixelOwner: (x: number, y: number) => string | null;
  isLoadingPixelDelegations: boolean;
  pixelDelegationCount: number;
  setShowDelegationPopup: (show: boolean) => void;
  isDelegateMode: boolean;
  isRevokeMode: boolean;
  isLoadingBatchDelegations: boolean;
  batchDelegationData: {
    totalDelegations: number;
    pixelData: Array<{
      x: number;
      y: number;
      delegationCount: number;
      delegatedAddresses: string[];
    }>;
  };
  setShowBatchDelegationPopup: (show: boolean) => void;
  isPixelMinted: (x: number, y: number) => boolean;
  isPixelPending: (x: number, y: number) => boolean;
}

export default function PixelInfo({
  selectedPixel,
  isDrawMode,
  drawnPixels,
  isAreaSelectMode,
  selectedColor,
  pixelData,
  getPixelOwner,
  isLoadingPixelDelegations,
  pixelDelegationCount,
  setShowDelegationPopup,
  isDelegateMode,
  isRevokeMode,
  isLoadingBatchDelegations,
  batchDelegationData,
  setShowBatchDelegationPopup,
  isPixelMinted,
  isPixelPending,
}: PixelInfoProps) {
  // Show only when there's relevant pixel info and not in area selection mode
  if ((!selectedPixel && (!isDrawMode || drawnPixels.size === 0)) || isAreaSelectMode) {
    return null;
  }

  return (
    <div className="p-6 border-b border-gray-700">
      {selectedPixel ? (
        <h3 className="text-lg font-semibold mb-4">
          📍 Pixel ({selectedPixel[0]}, {selectedPixel[1]})
        </h3>
      ) : (
        <h3 className="text-lg font-semibold mb-4">
          🎨 Batch Mint
        </h3>
      )}

      <div className="space-y-3">
        {/* Show batch mint info when in Batch Mode without selected pixel */}
        {!selectedPixel && isDrawMode && drawnPixels.size > 0 && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
              <span className="text-orange-400 font-medium">
                Batch Mode - {drawnPixels.size} pixels selected
              </span>
            </div>

            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
              <span className="text-sm text-gray-400">
                Will mint with:
              </span>
              <div
                className="w-6 h-6 border border-gray-600 rounded"
                style={{ backgroundColor: selectedColor }}
              ></div>
              <span className="text-xs text-gray-300 font-mono">
                {selectedColor}
              </span>
            </div>

            {/* Batch delegation info */}
            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
              <span className="text-sm text-gray-400">
                🔑 Total Delegations:
              </span>
              <span className="text-xs text-blue-300">
                {isLoadingBatchDelegations ? (
                  <span className="animate-pulse">Checking...</span>
                ) : batchDelegationData.totalDelegations === 0 ? (
                  <span className="text-gray-400">None found</span>
                ) : (
                  <button
                    onClick={() => setShowBatchDelegationPopup(true)}
                    className="font-medium hover:text-blue-200 underline transition-colors"
                  >
                    {batchDelegationData.totalDelegations}{" "}
                    delegation
                    {batchDelegationData.totalDelegations !== 1 ? "s" : ""}
                  </button>
                )}
              </span>
            </div>

            <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
              Click more pixels on canvas to add them, or use the
              mint button below to mint all selected pixels.
            </div>
          </>
        )}

        {/* Existing selected pixel logic */}
        {selectedPixel && (
          <>
            {isPixelMinted(selectedPixel[0], selectedPixel[1]) ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span className="text-blue-400 font-medium">
                    Minted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Color:
                  </span>
                  <div
                    className="w-6 h-6 border border-gray-600 rounded"
                    style={{
                      backgroundColor:
                        pixelData[`${selectedPixel[0]}-${selectedPixel[1]}`]?.color,
                    }}
                  ></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    Owner:
                  </span>
                  <span className="text-xs text-gray-300 font-mono break-all">
                    {getPixelOwner(selectedPixel[0], selectedPixel[1])?.slice(0, 6)}
                    ...
                    {getPixelOwner(selectedPixel[0], selectedPixel[1])?.slice(-4)}
                  </span>
                </div>

                {/* Delegation info for individual pixel - show when not in batch selection */}
                {(!isDrawMode && !isDelegateMode && !isRevokeMode) ||
                  ((isDelegateMode || isRevokeMode) && drawnPixels.size === 0) && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      🔑 Delegated:
                    </span>
                    <span className="text-xs text-blue-300">
                      {isLoadingPixelDelegations ? (
                        <span className="animate-pulse">
                          Checking...
                        </span>
                      ) : pixelDelegationCount === 0 ? (
                        <span className="text-gray-400">
                          None found
                        </span>
                      ) : (
                        <button
                          onClick={() => setShowDelegationPopup(true)}
                          className="font-medium hover:text-blue-200 underline transition-colors"
                        >
                          {pixelDelegationCount} address
                          {pixelDelegationCount !== 1 ? "es" : ""}
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ) : isPixelPending(selectedPixel[0], selectedPixel[1]) ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                <span className="text-orange-400">
                  Transaction Pending...
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                  <span className="text-gray-400">Available</span>
                </div>

                {/* Show selected color for single pixel minting */}
                <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                  <span className="text-sm text-gray-400">
                    Will mint with:
                  </span>
                  <div
                    className="w-6 h-6 border border-gray-600 rounded"
                    style={{ backgroundColor: selectedColor }}
                  ></div>
                  <span className="text-xs text-gray-300 font-mono">
                    {selectedColor}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {/* Show batch delegation info when in delegate/revoke modes with multiple pixels */}
        {selectedPixel &&
          (isDelegateMode || isRevokeMode) &&
          drawnPixels.size > 0 && (
            <div className="pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-sm text-gray-400">
                  🔑 Total Delegations:
                </span>
                <span className="text-xs text-blue-300">
                  {isLoadingBatchDelegations ? (
                    <span className="animate-pulse">
                      Checking...
                    </span>
                  ) : batchDelegationData.totalDelegations === 0 ? (
                    <span className="text-gray-400">
                      None found
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowBatchDelegationPopup(true)}
                      className="font-medium hover:text-blue-200 underline transition-colors"
                    >
                      {batchDelegationData.totalDelegations}{" "}
                      delegation
                      {batchDelegationData.totalDelegations !== 1 ? "s" : ""}
                    </button>
                  )}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Across {drawnPixels.size} selected pixels
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
