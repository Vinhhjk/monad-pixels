import React from "react";

interface ZoomControlsProps {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  viewportSize: number;
  zoomPercentage: number;
  MIN_VIEWPORT_SIZE: number;
  MAX_VIEWPORT_SIZE: number;
}

export default function ZoomControls({
  handleZoomIn,
  handleZoomOut,
  viewportSize,
  zoomPercentage,
  MIN_VIEWPORT_SIZE,
  MAX_VIEWPORT_SIZE,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 sm:px-2 py-1">
      <button
        onClick={() => handleZoomIn()}
        className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs sm:text-sm transition-colors"
        disabled={viewportSize <= MIN_VIEWPORT_SIZE}
        title="Zoom In"
      >
        🔍+
      </button>
      <span className="text-xs text-gray-300 px-1 sm:px-2 min-w-[2rem] sm:min-w-[3rem] text-center">
        {zoomPercentage}%
      </span>
      <button
        onClick={() => handleZoomOut()}
        className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs sm:text-sm transition-colors"
        disabled={viewportSize >= MAX_VIEWPORT_SIZE}
        title="Zoom Out"
      >
        🔍-
      </button>
    </div>
  );
}
