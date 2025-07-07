import React from "react";

interface BatchModeControlsProps {
  isDrawMode: boolean;
  drawnPixels: Map<string, string>;
  isPixelMinted: (x: number, y: number) => boolean;
  isPixelPending: (x: number, y: number) => boolean;
  canUpdatePixel: (x: number, y: number) => boolean;
  isBatchMinting: boolean;
  isBatchUpdating: boolean;
  batchMintPixels: () => void;
  batchUpdatePixels: () => void;
  clearDrawing: () => void;
}

export default function BatchModeControls({
  isDrawMode,
  drawnPixels,
  isPixelMinted,
  isPixelPending,
  canUpdatePixel,
  isBatchMinting,
  isBatchUpdating,
  batchMintPixels,
  batchUpdatePixels,
  clearDrawing,
}: BatchModeControlsProps) {
  if (!isDrawMode || drawnPixels.size === 0) {
    return null;
  }

  const drawnPixelArray = Array.from(drawnPixels.keys());

  const unmintedCount = drawnPixelArray.filter((key) => {
    const [x, y] = key.split("-").map(Number);
    return !isPixelMinted(x, y) && !isPixelPending(x, y);
  }).length;

  const ownedCount = drawnPixelArray.filter((key) => {
    const [x, y] = key.split("-").map(Number);
    return (
      isPixelMinted(x, y) &&
      canUpdatePixel(x, y) &&
      !isPixelPending(x, y)
    );
  }).length;

  // Count all updateable pixels (both owned and potentially delegated)
  const updateableCount = drawnPixelArray.filter((key) => {
    const [x, y] = key.split("-").map(Number);
    return isPixelMinted(x, y) && !isPixelPending(x, y);
  }).length;

  const pendingCount = drawnPixelArray.filter((key) => {
    const [x, y] = key.split("-").map(Number);
    return isPixelPending(x, y);
  }).length;

  const otherCount =
    drawnPixels.size - unmintedCount - ownedCount - pendingCount;

  return (
    <div className="flex items-center gap-1 bg-orange-800 rounded-lg px-1 sm:px-2 py-1">
      <span className="text-xs text-orange-200 hidden sm:inline">
        {drawnPixels.size} pixels
      </span>
      <span className="text-xs text-orange-200 sm:hidden">
        {drawnPixels.size}
      </span>

      {/* Show breakdown on hover/larger screens */}
      <div className="hidden sm:block text-xs text-orange-300">
        {unmintedCount > 0 && `${unmintedCount} new`}
        {unmintedCount > 0 && ownedCount > 0 && ", "}
        {ownedCount > 0 && `${ownedCount} owned`}
        {pendingCount > 0 && `, ${pendingCount} pending`}
        {otherCount > 0 && `, ${otherCount} other`}
      </div>

      {/* Batch Mint Button - only show if there are unminted pixels */}
      {unmintedCount > 0 && (
        <button
          onClick={batchMintPixels}
          className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
          disabled={isBatchMinting || isBatchUpdating}
          title={`Mint ${unmintedCount} unminted pixels`}
        >
          {isBatchMinting ? "⏳" : `⚡${unmintedCount}`}
        </button>
      )}

      {/* Batch Update Button - only show if there are updateable pixels */}
      {updateableCount > 0 && (
        <button
          onClick={batchUpdatePixels}
          className="bg-blue-600 hover:bg-blue-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
          disabled={isBatchMinting || isBatchUpdating}
          title={`Update ${updateableCount} pixels (${ownedCount} owned)`}
        >
          {isBatchUpdating ? "⏳" : `🎨${updateableCount}`}
        </button>
      )}

      <button
        onClick={clearDrawing}
        className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
        title="Clear Selection"
        disabled={isBatchMinting || isBatchUpdating}
      >
        ✕
      </button>
    </div>
  );
}
