import React from 'react';

interface AreaSelectionInfoProps {
  isAreaSelectMode: boolean;
  selectedArea: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
  compositionInfo: {
    canCompose: boolean;
    reason: string;
    ownedCount: number;
  } | null;
  isConnected: boolean;
  isComposing: boolean;
  composePixels: () => void;
  onClearSelection: () => void;
}

export default function AreaSelectionInfo({
  isAreaSelectMode,
  selectedArea,
  compositionInfo,
  isConnected,
  isComposing,
  composePixels,
  onClearSelection,
}: AreaSelectionInfoProps) {
  if (!isAreaSelectMode) return null;

  return (
    <div className="p-6 border-b border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-purple-400">
        🔲 Area Composition Mode
      </h3>

      {selectedArea ? (
        <>
          <div className="space-y-2 mb-4">
            <div className="text-sm">
              <span className="text-gray-400">Selected Area:</span>{" "}
              <span className="text-purple-300">
                ({selectedArea.startX}, {selectedArea.startY}) to (
                {selectedArea.endX}, {selectedArea.endY})
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">Total Area:</span>{" "}
              <span className="text-purple-300">
                {selectedArea.endX - selectedArea.startX + 1} ×{" "}
                {selectedArea.endY - selectedArea.startY + 1} ={" "}
                {(selectedArea.endX - selectedArea.startX + 1) *
                  (selectedArea.endY - selectedArea.startY + 1)}{" "}
                pixels
              </span>
            </div>
            {compositionInfo && (
              <div className="text-sm">
                <span className="text-gray-400">Your Pixels:</span>{" "}
                <span
                  className={`font-medium ${
                    compositionInfo.canCompose
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {compositionInfo.ownedCount} pixels
                </span>
                {compositionInfo.ownedCount > 0 && (
                  <span className="text-gray-500 text-xs ml-2">
                    (will compose these only)
                  </span>
                )}
              </div>
            )}
            {compositionInfo &&
              !compositionInfo.canCompose &&
              compositionInfo.ownedCount < 2 && (
                <div className="text-sm p-2 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded">
                  <span className="text-yellow-400">
                    ℹ️ {compositionInfo.reason}
                  </span>
                </div>
              )}
          </div>

          {isConnected ? (
            <div className="space-y-2">
              <button
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                onClick={composePixels}
                disabled={isComposing || !compositionInfo?.canCompose}
              >
                {isComposing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Composing {compositionInfo?.ownedCount || 0}{" "}
                    pixels...
                  </>
                ) : (
                  <>
                    <span>🔧</span>
                    Compose {compositionInfo?.ownedCount || 0} Pixels
                  </>
                )}
              </button>

              <button
                className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                onClick={onClearSelection}
              >
                <span>❌</span>
                Clear Selection
              </button>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4">
              Connect wallet to compose pixels
            </div>
          )}
        </>
      ) : (
        <div className="text-gray-400 text-sm space-y-2">
          <p>
            Select any area - small or large! The system automatically
            finds your pixels and composes them into one NFT.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 border-2 border-purple-400 rounded-sm"></div>
            <span>Selected area</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 border-2 border-green-400 rounded-sm"></div>
            <span>Your pixels (will be composed)</span>
          </div>
          <p className="text-xs text-green-300">
            💡 No limits!
          </p>
        </div>
      )}
    </div>
  );
}
