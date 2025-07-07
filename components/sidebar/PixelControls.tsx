import React from 'react';

interface PixelControlsProps {
  selectedPixel: [number, number] | null;
  isDrawMode: boolean;
  drawnPixels: Map<string, string>;
  isConnected: boolean;
  selectedColor: string;
  isPixelMinted: (x: number, y: number) => boolean;
  isPixelPending: (x: number, y: number) => boolean;
  canUpdatePixel: (x: number, y: number) => boolean;
  getTokenId: (x: number, y: number) => number;
  mintPixel: (x: number, y: number) => void;
  updatePixel: (x: number, y: number) => void;
  isMinting: boolean;
  isBatchMinting: boolean;
  isBatchUpdating: boolean;
  batchMintPixels: () => void;
  batchUpdatePixels: () => void;
  batchRevokeApprovals: () => void;
  clearDrawing: () => void;
  toggleDrawMode: () => void;
  isCheckingAuth: boolean;
  authResults: {
    authorized: number;
    unauthorized: number;
  } | null;
  batchFeeInfo: {
    totalFee: bigint;
    unauthorizedCount: number;
    authorized: number;
  } | null;
  pixelAuthStatus: {
    x: number;
    y: number;
    isOwner: boolean;
    isAuthorized: boolean;
    isChecking: boolean;
  } | null;
  isCheckingFee: boolean;
  hasExemption: boolean;
  feeRequired: bigint;
  isRevokingApproval: boolean;
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
  isLoadingPixelDelegations: boolean;
  pixelDelegationCount: number;
  pixelDelegatedAddresses: string[];
  setShowDelegationPopup: (show: boolean) => void;
}

export default function PixelControls({
  selectedPixel,
  isDrawMode,
  drawnPixels,
  isConnected,
  selectedColor,
  isPixelMinted,
  isPixelPending,
  canUpdatePixel,
  getTokenId,
  mintPixel,
  updatePixel,
  isMinting,
  isBatchMinting,
  isBatchUpdating,
  batchMintPixels,
  batchUpdatePixels,
  batchRevokeApprovals,
  clearDrawing,
  toggleDrawMode,
  isCheckingAuth,
  authResults,
  batchFeeInfo,
  pixelAuthStatus,
  isCheckingFee,
  hasExemption,
  feeRequired,
  isRevokingApproval,
  isLoadingBatchDelegations,
  batchDelegationData,
  setShowBatchDelegationPopup,
  isLoadingPixelDelegations,
  pixelDelegationCount,

  setShowDelegationPopup,
}: PixelControlsProps) {
  if (!isConnected) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-400 py-4">
          Connect wallet to interact with pixels
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2">
      {/* Batch mode controls when no specific pixel is selected but pixels are drawn */}
      {!selectedPixel && isDrawMode && drawnPixels.size > 0 && (() => {
        const drawnPixelArray = Array.from(drawnPixels.keys());
        
        const unmintedPixels = drawnPixelArray.filter((key) => {
          const [x, y] = key.split("-").map(Number);
          return !isPixelMinted(x, y) && !isPixelPending(x, y);
        });

        const ownedPixels = drawnPixelArray.filter((key) => {
          const [x, y] = key.split("-").map(Number);
          return isPixelMinted(x, y) && canUpdatePixel(x, y) && !isPixelPending(x, y);
        });

        const pendingPixels = drawnPixelArray.filter((key) => {
          const [x, y] = key.split("-").map(Number);
          return isPixelPending(x, y);
        });

        const mintedNotOwnedPixels = drawnPixelArray.filter((key) => {
          const [x, y] = key.split("-").map(Number);
          return isPixelMinted(x, y) && !canUpdatePixel(x, y) && !isPixelPending(x, y);
        });

        const totalUpdateablePixels = ownedPixels.length + mintedNotOwnedPixels.length;

        return (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
              <span className="text-orange-400 font-medium">
                Batch Mode - {drawnPixels.size} pixels selected
              </span>
            </div>

            {/* Breakdown of selected pixels */}
            <div className="space-y-2 mb-4">
              {unmintedPixels.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-green-400">
                    {unmintedPixels.length} unminted (ready to mint)
                  </span>
                </div>
              )}

              {ownedPixels.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-blue-400">
                    {ownedPixels.length} owned (ready to update)
                  </span>
                </div>
              )}
              
              {mintedNotOwnedPixels.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-purple-400">
                    {mintedNotOwnedPixels.length} minted (check delegation)
                  </span>
                </div>
              )}
              
              {pendingPixels.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-orange-500 rounded animate-pulse"></div>
                  <span className="text-orange-400">
                    {pendingPixels.length} pending transactions
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded mb-4">
              <span className="text-sm text-gray-400">Selected color:</span>
              <div
                className="w-6 h-6 border border-gray-600 rounded"
                style={{ backgroundColor: selectedColor }}
              ></div>
              <span className="text-xs text-gray-300 font-mono">{selectedColor}</span>
            </div>

            <div className="space-y-2">
              {/* Batch Mint Button */}
              {unmintedPixels.length > 0 && (
                <button
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  onClick={batchMintPixels}
                  disabled={isBatchMinting || isBatchUpdating}
                >
                  {isBatchMinting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Minting {unmintedPixels.length} pixels...
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      Mint {unmintedPixels.length} Pixels
                    </>
                  )}
                </button>
              )}

              {/* Batch Fee Display */}
              {batchFeeInfo && batchFeeInfo.totalFee > BigInt(0) && (
                <div className="text-center p-3 bg-orange-900 bg-opacity-50 border border-orange-600 rounded-lg">
                  <p className="text-orange-400 text-sm">💰 Total Fee Required</p>
                  <p className="text-orange-300 text-xs mt-1">
                    {(Number(batchFeeInfo.totalFee) / 1e18).toFixed(3)} MON
                  </p>
                  <p className="text-orange-300 text-xs">
                    For {batchFeeInfo.unauthorizedCount} unauthorized pixels
                  </p>
                </div>
              )}

              {/* Batch Update Button */}
              {totalUpdateablePixels > 0 && (
                <button
                  className={`w-full px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                    isCheckingAuth
                      ? "bg-yellow-600 cursor-wait"
                      : authResults && authResults.authorized > 0
                      ? "bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
                      : authResults && authResults.unauthorized > 0
                      ? "bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
                      : "bg-gray-600 cursor-not-allowed text-white"
                  }`}
                  onClick={batchUpdatePixels}
                  disabled={
                    isBatchMinting ||
                    isBatchUpdating ||
                    isCheckingAuth ||
                    totalUpdateablePixels === 0
                  }
                >
                  {isBatchUpdating ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Updating {totalUpdateablePixels} pixels...
                    </>
                  ) : isCheckingAuth ? (
                    <>
                      <span className="animate-spin">🔍</span>
                      Checking Authorization...
                    </>
                  ) : authResults && authResults.authorized > 0 ? (
                    <>
                      <span>🎨</span>
                      Update {authResults.authorized + authResults.unauthorized} Pixel{(authResults.authorized + authResults.unauthorized) > 1 ? "s" : ""}
                      {authResults.unauthorized > 0 && ` (${authResults.unauthorized} require fee${authResults.unauthorized > 1 ? "s" : ""})`}
                    </>
                  ) : authResults && authResults.unauthorized > 0 ? (
                    <>
                      <span>💳</span>
                      Pay & Update {authResults.unauthorized} Pixel{authResults.unauthorized > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      <span>❌</span>
                      No Valid Pixels
                    </>
                  )}
                </button>
              )}

              {/* Batch Revoke Approvals Button */}
              {(() => {
                const ownedPixelsCount = Array.from(drawnPixels.keys()).filter((key) => {
                  const [x, y] = key.split("-").map(Number);
                  return isPixelMinted(x, y) && canUpdatePixel(x, y);
                }).length;

                return ownedPixelsCount > 0 ? (
                  <button
                    className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    onClick={batchRevokeApprovals}
                    disabled={isBatchMinting || isBatchUpdating || isRevokingApproval}
                  >
                    {isRevokingApproval ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Revoking...
                      </>
                    ) : (
                      <>
                        <span>🚫</span>
                        Revoke Approvals ({ownedPixelsCount})
                      </>
                    )}
                  </button>
                ) : null;
              })()}

              <button
                className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                onClick={clearDrawing}
                disabled={isBatchMinting || isBatchUpdating}
              >
                <span>🗑️</span>
                Clear Selection
              </button>

              <button
                className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                onClick={toggleDrawMode}
                disabled={isBatchMinting || isBatchUpdating}
              >
                <span>✏️</span>
                Exit Batch Mode
              </button>
            </div>

            <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-4">
              💡 <strong>Tip:</strong> Click pixels on canvas to add/remove them. 
              Green pixels will be minted, blue pixels will be updated with your selected color.
            </div>
          </>
        );
      })()}

      {/* Batch update options when in draw mode and pixel is selected */}
      {selectedPixel && isDrawMode && drawnPixels.size > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-300">
            <p className="font-medium text-orange-400">
              Batch Mode Active
            </p>
            <p>Selected pixels will be updated together</p>
          </div>

          {/* Batch delegation info */}
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
                  delegation{batchDelegationData.totalDelegations !== 1 ? "s" : ""}
                </button>
              )}
            </span>
          </div>

          {/* Show batch fee if applicable */}
          {batchFeeInfo && batchFeeInfo.totalFee > BigInt(0) && (
            <div className="text-center p-3 bg-orange-900 bg-opacity-50 border border-orange-600 rounded-lg">
              <p className="text-orange-400 text-sm">
                🔒 Total Fee Required
              </p>
              <p className="text-orange-300 text-xs mt-1">
                {(Number(batchFeeInfo.totalFee) / 1e18).toFixed(3)} MON
              </p>
              <p className="text-orange-300 text-xs">
                For {batchFeeInfo.unauthorizedCount} unauthorized pixels
              </p>
            </div>
          )}

          {/* Batch Mint Button */}
          {(() => {
            const unmintedPixels = Array.from(drawnPixels.keys()).filter((key) => {
              const [x, y] = key.split("-").map(Number);
              return !isPixelMinted(x, y) && !isPixelPending(x, y);
            });

            return unmintedPixels.length > 0 ? (
              <button
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                onClick={batchMintPixels}
                disabled={isBatchMinting || isBatchUpdating}
              >
                {isBatchMinting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Minting {unmintedPixels.length} pixels...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Mint {unmintedPixels.length} Pixels
                  </>
                )}
              </button>
            ) : null;
          })()}

          {/* Batch Update Button */}
          {(() => {
            const totalUpdateablePixels = Array.from(drawnPixels.keys()).filter((key) => {
              const [x, y] = key.split("-").map(Number);
              return isPixelMinted(x, y) && !isPixelPending(x, y);
            }).length;

            return totalUpdateablePixels > 0 ? (
              <button
                className={`w-full px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                  isCheckingAuth
                    ? "bg-yellow-600 cursor-wait"
                    : authResults && authResults.authorized > 0
                    ? "bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
                    : authResults && authResults.unauthorized > 0
                    ? "bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white"
                    : "bg-gray-600 cursor-not-allowed text-white"
                }`}
                onClick={batchUpdatePixels}
                disabled={
                  isBatchMinting ||
                  isBatchUpdating ||
                  isCheckingAuth ||
                  totalUpdateablePixels === 0
                }
              >
                {isBatchUpdating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Updating {totalUpdateablePixels} pixels...
                  </>
                ) : isCheckingAuth ? (
                  <>
                    <span className="animate-spin">🔍</span>
                    Checking Authorization...
                  </>
                ) : authResults && authResults.authorized > 0 ? (
                  <>
                    <span>🎨</span>
                    Update {authResults.authorized + authResults.unauthorized} Pixel{(authResults.authorized + authResults.unauthorized) > 1 ? "s" : ""}
                    {authResults.unauthorized > 0 && ` (${authResults.unauthorized} require fee${authResults.unauthorized > 1 ? "s" : ""})`}
                  </>
                ) : authResults && authResults.unauthorized > 0 ? (
                  <>
                    <span>💳</span>
                    Pay & Update {authResults.unauthorized} Pixel{authResults.unauthorized > 1 ? "s" : ""}
                  </>
                ) : (
                  <>
                    <span>❌</span>
                    No Valid Pixels
                  </>
                )}
              </button>
            ) : null;
          })()}

          <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
            💡 <strong>Tip:</strong> Click pixels on canvas to add/remove them. 
            Selected pixels will be updated with your chosen color.
          </div>
        </div>
      )}

      {/* Single pixel controls when a pixel is selected and NOT in draw mode */}
      {selectedPixel && !isDrawMode && (
        <>
          {/* Show delegation info for minted pixels */}
          {isPixelMinted(selectedPixel[0], selectedPixel[1]) && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                <span className="text-sm text-gray-400">
                  🔑 Delegations:
                </span>
                <span className="text-xs text-blue-300">
                  {isLoadingPixelDelegations ? (
                    <span className="animate-pulse">
                      Checking...
                    </span>
                  ) : pixelDelegationCount > 0 ? (
                    <button
                      onClick={() => setShowDelegationPopup(true)}
                      className="font-medium hover:text-blue-200 underline transition-colors"
                    >
                      {pixelDelegationCount} address{pixelDelegationCount !== 1 ? "es" : ""}
                    </button>
                  ) : (
                    <span className="text-gray-400">
                      None
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Only show View NFT button for minted pixels */}
          {isPixelMinted(selectedPixel[0], selectedPixel[1]) && (
            <button
              className="w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              onClick={() => {
                const tokenId = getTokenId(selectedPixel[0], selectedPixel[1]);
                window.open(`/nft?tokenId=${tokenId}`, "_blank");
              }}
            >
              <span>🖼️</span>
              View Details
            </button>
          )}

          {!isPixelMinted(selectedPixel[0], selectedPixel[1]) ? (
            <button
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              onClick={() => {
                console.log(`Attempting to mint pixel (${selectedPixel[0]}, ${selectedPixel[1]})`);
                mintPixel(...selectedPixel);
              }}
              disabled={
                isPixelPending(selectedPixel[0], selectedPixel[1]) ||
                isMinting ||
                isBatchMinting
              }
            >
              {isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Minting...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Mint Pixel
                </>
              )}
            </button>
          ) : canUpdatePixel(selectedPixel[0], selectedPixel[1]) ? (
            <button
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              onClick={() => {
                console.log(`Attempting to update pixel (${selectedPixel[0]}, ${selectedPixel[1]})`);
                updatePixel(...selectedPixel);
              }}
              disabled={
                isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting
              }
            >
              {isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Updating...
                </>
              ) : (
                <>
                  <span>🎨</span>
                  Update Color
                </>
              )}
            </button>
          ) : (
            // Check if user is authorized (including delegation)
            pixelAuthStatus?.x === selectedPixel[0] &&
            pixelAuthStatus?.y === selectedPixel[1] && (
              <>
                {pixelAuthStatus.isChecking ? (
                  <div className="text-center p-3 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-blue-400 text-sm">Checking delegation...</p>
                    </div>
                  </div>
                ) : pixelAuthStatus.isAuthorized ? (
                  <button
                    onClick={() => updatePixel(selectedPixel[0], selectedPixel[1])}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    disabled={isMinting}
                  >
                    {isMinting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <span>🎨</span>
                        Update Color {pixelAuthStatus.isOwner ? "" : "(Delegated)"}
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    {isCheckingFee ? (
                      <div className="text-center p-3 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-blue-400 text-sm">Checking fee requirements...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {hasExemption ? (
                          <div className="space-y-2">
                            <div className="text-center p-3 bg-green-900 bg-opacity-50 border border-green-600 rounded-lg">
                              <p className="text-green-400 text-sm">✨ Special Frens - Free Updates!</p>
                            </div>
                            <button
                              onClick={() => updatePixel(selectedPixel[0], selectedPixel[1])}
                              className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                              disabled={isMinting}
                            >
                              {isMinting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <span>🎨</span>
                                  Update Color (Free)
                                </>
                              )}
                            </button>
                          </div>
                        ) : feeRequired > BigInt(0) ? (
                          <div className="space-y-2">
                            <div className="text-center p-3 bg-orange-900 bg-opacity-50 border border-orange-600 rounded-lg">
                              <p className="text-orange-400 text-sm">💰 Fee Required</p>
                              <p className="text-orange-300 text-xs mt-1">
                                {(Number(feeRequired) / 1e18).toFixed(6)} MON
                              </p>
                            </div>
                            <button
                              onClick={() => updatePixel(selectedPixel[0], selectedPixel[1])}
                              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                              disabled={isMinting}
                            >
                              {isMinting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Paying & Updating...
                                </>
                              ) : (
                                <>
                                  <span>💳</span>
                                  Pay & Update
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                            <p className="text-red-400 text-sm">❌ Not Authorized</p>
                            <p className="text-red-300 text-xs mt-1">
                              You don&apos;t own this pixel and have no delegation
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
