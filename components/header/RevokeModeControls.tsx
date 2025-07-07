import React from "react";

interface RevokeModeControlsProps {
  isRevokeMode: boolean;
  isBatchRevoke: boolean;
  setIsBatchRevoke: (batch: boolean) => void;
  setDrawnPixels: (pixels: Map<string, string>) => void;
  setSelectedPixel: (pixel: [number, number] | null) => void;
  setShowRevokeInput: (show: boolean) => void;
  setRevokeSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setRevokeAreaStart: (start: [number, number] | null) => void;
  setIsRevokeAreaDragging: (dragging: boolean) => void;
  
  // Address input
  isRevokeMultiAddressMode: boolean;
  setIsRevokeMultiAddressMode: (mode: boolean) => void;
  revokeAddress: string;
  setRevokeAddress: (address: string) => void;
  revokeAddresses: string[];
  setRevokeAddresses: (addresses: string[]) => void;
  
  // Batch revoke controls
  drawnPixels: Map<string, string>;
  isRevoking: boolean;
  batchRevokePixelsSingleAddress: (pixels: [number, number][], address: string) => void;
  batchRevokePixelsMultiSingleTx: (pixels: [number, number][], addresses: string[]) => void;
  
  // Single revoke controls
  selectedPixel: [number, number] | null;
  showRevokeInput: boolean;
  revokePixelFromAddress: (x: number, y: number, address: string) => void;
  
  // Notification function
  addNotification: (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => void;
}

export default function RevokeModeControls({
  isRevokeMode,
  isBatchRevoke,
  setIsBatchRevoke,
  setDrawnPixels,
  setSelectedPixel,
  setShowRevokeInput,
  setRevokeSelectedArea,
  setRevokeAreaStart,
  setIsRevokeAreaDragging,
  isRevokeMultiAddressMode,
  setIsRevokeMultiAddressMode,
  revokeAddress,
  setRevokeAddress,
  revokeAddresses,
  setRevokeAddresses,
  drawnPixels,
  isRevoking,
  batchRevokePixelsSingleAddress,
  batchRevokePixelsMultiSingleTx,
  selectedPixel,
  showRevokeInput,
  revokePixelFromAddress,
  addNotification,
}: RevokeModeControlsProps) {
  if (!isRevokeMode) {
    return null;
  }

  return (
    <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 bg-red-800 rounded-lg px-2 py-2 shadow-lg z-50 min-w-[280px]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-200">Revoke Mode</span>
        <button
          onClick={() => {
            const newBatchMode = !isBatchRevoke;
            setIsBatchRevoke(newBatchMode);
            setDrawnPixels(new Map());
            setSelectedPixel(null);
            setShowRevokeInput(false);
            setRevokeSelectedArea(null);
            setRevokeAreaStart(null);
            setIsRevokeAreaDragging(false);

            if (newBatchMode) {
              addNotification(
                "info",
                "Batch Revoke Mode",
                "Click and drag to select an area, or click individual pixels"
              );
            } else {
              addNotification(
                "info",
                "Single Revoke Mode",
                "Click an owned pixel to revoke access from someone"
              );
            }
          }}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            isBatchRevoke
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title={
            isBatchRevoke
              ? "Switch to Single Revoke"
              : "Switch to Batch Revoke"
          }
        >
          {isBatchRevoke ? "📦 Batch" : "📦 Single"}
        </button>
      </div>

      {/* Address Input Mode Toggle */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() =>
            setIsRevokeMultiAddressMode(!isRevokeMultiAddressMode)
          }
          className={`px-2 py-1 rounded text-xs transition-colors ${
            isRevokeMultiAddressMode
              ? "bg-purple-600 hover:bg-purple-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          {isRevokeMultiAddressMode
            ? "📋 Multi-Address"
            : "📋 Single Address"}
        </button>
      </div>

      {/* Address Input */}
      <div className="flex flex-col gap-1">
        {isRevokeMultiAddressMode ? (
          <div className="space-y-1">
            <textarea
              placeholder="Enter addresses to revoke from (one per line)&#10;0x123...&#10;0x456..."
              value={revokeAddresses.join("\n")}
              onChange={(e) => {
                const input = e.target.value;
                let addresses = input
                  .split("\n")
                  .filter((addr) => addr.trim());

                if (
                  addresses.length === 1 &&
                  addresses[0].length > 42
                ) {
                  const parts = addresses[0]
                    .split("0x")
                    .filter((part) => part.length > 0);
                  addresses = parts
                    .map((part) => "0x" + part.substring(0, 40))
                    .filter((addr) => addr.length === 42);
                }

                setRevokeAddresses(addresses);
              }}
              className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-red-400 focus:outline-none resize-none h-20"
              rows={4}
            />
            <div className="text-xs text-red-200">
              {revokeAddresses.length} address
              {revokeAddresses.length !== 1 ? "es" : ""} entered
            </div>
          </div>
        ) : (
          <input
            type="text"
            placeholder="Address to revoke from (0x...)"
            value={revokeAddress}
            onChange={(e) => setRevokeAddress(e.target.value)}
            className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-red-400 focus:outline-none"
          />
        )}
      </div>

      {/* Batch revoke controls */}
      {isBatchRevoke && drawnPixels.size > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-200">
              {drawnPixels.size} pixels selected
            </span>
          </div>
          <button
            onClick={() => {
              const pixels = Array.from(drawnPixels.keys()).map(
                (key) => {
                  const [x, y] = key.split("-").map(Number);
                  return [x, y] as [number, number];
                }
              );

              if (isRevokeMultiAddressMode) {
                if (revokeAddresses.length > 0) {
                  batchRevokePixelsMultiSingleTx(
                    pixels,
                    revokeAddresses
                  );
                } else {
                  addNotification(
                    "error",
                    "Missing Addresses",
                    "Please enter at least one address"
                  );
                }
              } else {
                if (revokeAddress) {
                  batchRevokePixelsSingleAddress(pixels, revokeAddress);
                } else {
                  addNotification(
                    "error",
                    "Missing Address",
                    "Please enter address to revoke from"
                  );
                }
              }
            }}
            className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs transition-colors"
            disabled={
              isRevoking ||
              (!revokeAddress && !isRevokeMultiAddressMode) ||
              (isRevokeMultiAddressMode && revokeAddresses.length === 0)
            }
          >
            {isRevoking
              ? "⏳"
              : isRevokeMultiAddressMode
              ? `Revoke from ${revokeAddresses.length}`
              : `Revoke ${drawnPixels.size}`}
          </button>
          <button
            onClick={() => setDrawnPixels(new Map())}
            className="bg-gray-600 hover:bg-gray-500 text-white px-1 py-1 rounded text-xs transition-colors"
            title="Clear Selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Single revoke control */}
      {!isBatchRevoke && selectedPixel && showRevokeInput && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-200">
            Pixel ({selectedPixel[0]}, {selectedPixel[1]})
          </span>
          <button
            onClick={() => {
              if (selectedPixel) {
                if (isRevokeMultiAddressMode) {
                  if (revokeAddresses.length > 0) {
                    batchRevokePixelsMultiSingleTx(
                      [selectedPixel],
                      revokeAddresses
                    );
                  } else {
                    addNotification(
                      "error",
                      "Missing Addresses",
                      "Please enter at least one address"
                    );
                  }
                } else {
                  if (revokeAddress) {
                    revokePixelFromAddress(
                      selectedPixel[0],
                      selectedPixel[1],
                      revokeAddress
                    );
                  } else {
                    addNotification(
                      "error",
                      "Missing Address",
                      "Please enter address to revoke from"
                    );
                  }
                }
                setShowRevokeInput(false);
                setSelectedPixel(null);
              }
            }}
            className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs transition-colors"
            disabled={
              isRevoking ||
              (!revokeAddress && !isRevokeMultiAddressMode) ||
              (isRevokeMultiAddressMode && revokeAddresses.length === 0)
            }
          >
            {isRevoking
              ? "⏳"
              : isRevokeMultiAddressMode
              ? `Revoke from ${revokeAddresses.length}`
              : "Revoke"}
          </button>
          <button
            onClick={() => {
              setShowRevokeInput(false);
              setSelectedPixel(null);
            }}
            className="bg-gray-600 hover:bg-gray-500 text-white px-1 py-1 rounded text-xs transition-colors"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {isBatchRevoke && (
        <div className="text-xs text-red-300 bg-red-900 bg-opacity-30 p-2 rounded">
          <div className="font-medium mb-1">
            🚫 Batch Revoke Mode Active
          </div>
          <div>• Click and drag to select an area of pixels</div>
          <div>
            • Only your owned pixels will be selected (highlighted
            in blue)
          </div>
          <div>
            •{" "}
            {isRevokeMultiAddressMode
              ? "Enter multiple addresses (one per line) to revoke from all"
              : 'Enter address and click "Revoke" to revoke from all'}
          </div>
          <div>
            •{" "}
            {isRevokeMultiAddressMode
              ? "Multi-address mode: all pixels will be revoked from ALL entered addresses in one transaction"
              : "Single-address mode: all pixels will be revoked from ONE address"}
          </div>
        </div>
      )}

      {!isBatchRevoke && !showRevokeInput && (
        <div className="text-xs text-red-300 bg-red-900 bg-opacity-30 p-2 rounded">
          <div className="font-medium mb-1">
            🚫 Single Revoke Mode
          </div>
          <div>
            • Click an owned pixel to revoke access from someone
          </div>
          <div>
            •{" "}
            {isRevokeMultiAddressMode
              ? "Enter multiple addresses to revoke from all"
              : "Enter address to revoke access from"}
          </div>
          <div>
            •{" "}
            {isRevokeMultiAddressMode
              ? "Multi-address mode: pixel will be revoked from ALL entered addresses"
              : "Single-address mode: pixel will be revoked from ONE address"}
          </div>
        </div>
      )}
    </div>
  );
}
