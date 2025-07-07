import React from "react";

interface HeaderControlsProps {
  showPositionInput: boolean;
  setShowPositionInput: (show: boolean) => void;
  positionX: string;
  positionY: string;
  setPositionX: (x: string) => void;
  setPositionY: (y: string) => void;
  handleGoToPosition: () => void;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
}

export default function HeaderControls({
  showPositionInput,
  setShowPositionInput,
  positionX,
  positionY,
  setPositionX,
  setPositionY,
  handleGoToPosition,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
}: HeaderControlsProps) {
  return (
    <>
      {/* Position Input - Hide on very small screens */}
      {showPositionInput ? (
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 sm:px-2 py-1">
          <input
            type="number"
            placeholder="X"
            value={positionX}
            onChange={(e) => setPositionX(e.target.value)}
            className="w-12 sm:w-16 px-1 py-1 text-xs bg-gray-700 text-white rounded border-none outline-none"
            min="0"
            max={CANVAS_WIDTH - 1}
          />
          <input
            type="number"
            placeholder="Y"
            value={positionY}
            onChange={(e) => setPositionY(e.target.value)}
            className="w-12 sm:w-16 px-1 py-1 text-xs bg-gray-700 text-white rounded border-none outline-none"
            min="0"
            max={CANVAS_HEIGHT - 1}
          />
          <button
            onClick={handleGoToPosition}
            className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
            title="Go to Position"
          >
            Go
          </button>
          <button
            onClick={() => {
              setShowPositionInput(false);
              setPositionX("");
              setPositionY("");
            }}
            className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowPositionInput(true)}
          className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
          title="Go to Position"
        >
          📍
        </button>
      )}
    </>
  );
}
