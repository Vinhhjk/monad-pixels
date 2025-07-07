import React from "react";

interface DelegateModeControlsProps {
  isDelegateMode: boolean;
  isBatchDelegate: boolean;
  setIsBatchDelegate: (batch: boolean) => void;
  setDrawnPixels: (pixels: Map<string, string>) => void;
  setSelectedPixel: (pixel: [number, number] | null) => void;
  setShowDelegateInput: (show: boolean) => void;
  setDelegateSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setDelegateAreaStart: (start: [number, number] | null) => void;
  setIsDelegateAreaDragging: (dragging: boolean) => void;
  
  // Address input
  isMultiAddressMode: boolean;
  setIsMultiAddressMode: (mode: boolean) => void;
  delegateAddress: string;
  setDelegateAddress: (address: string) => void;
  delegateAddresses: string[];
  setDelegateAddresses: (addresses: string[]) => void;
  
  // Batch delegate controls
  drawnPixels: Map<string, string>;
  isDelegating: boolean;
  batchDelegatePixels: (pixels: [number, number][], address: string) => void;
  batchDelegatePixelsMultiSingleTx: (pixels: [number, number][], addresses: string[]) => void;
  
  // Single delegate controls
  selectedPixel: [number, number] | null;
  showDelegateInput: boolean;
  delegatePixel: (x: number, y: number, address: string) => void;
  
  // Notification function
  addNotification: (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => void;
}

export default function DelegateModeControls({
  isDelegateMode,
  isBatchDelegate,
  setIsBatchDelegate,
  setDrawnPixels,
  setSelectedPixel,
  setShowDelegateInput,
  setDelegateSelectedArea,
  setDelegateAreaStart,
  setIsDelegateAreaDragging,
  isMultiAddressMode,
  setIsMultiAddressMode,
  delegateAddress,
  setDelegateAddress,
  delegateAddresses,
  setDelegateAddresses,
  drawnPixels,
  isDelegating,
  batchDelegatePixels,
  batchDelegatePixelsMultiSingleTx,
  selectedPixel,
  showDelegateInput,
  delegatePixel,
  addNotification,
}: DelegateModeControlsProps) {
  if (!isDelegateMode) {
    return null;
  }

  return (
    <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 bg-blue-800 rounded-lg px-2 py-2 shadow-lg z-50 min-w-[280px]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-blue-200">Delegate Mode</span>
        <button
          onClick={() => {
            const newBatchMode = !isBatchDelegate;
            setIsBatchDelegate(newBatchMode);
            setDrawnPixels(new Map());
            setSelectedPixel(null);
            setShowDelegateInput(false);
            setDelegateSelectedArea(null);
            setDelegateAreaStart(null);
            setIsDelegateAreaDragging(false);

            if (newBatchMode) {
              addNotification(
                "info",
                "Batch Delegation Mode",
                "Click and drag to select an area, or click individual pixels"
              );
            } else {
              addNotification(
                "info",
                "Single Delegation Mode",
                "Click an owned pixel to delegate it to a friend"
              );
            }
          }}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            isBatchDelegate
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
          title={
            isBatchDelegate
              ? "Switch to Single Delegate"
              : "Switch to Batch Delegate"
          }
        >
          {isBatchDelegate ? "📦 Batch" : "📦 Single"}
        </button>
      </div>

      {/* Address Input Mode Toggle */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() => setIsMultiAddressMode(!isMultiAddressMode)}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            isMultiAddressMode
              ? "bg-purple-600 hover:bg-purple-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          {isMultiAddressMode
            ? "📋 Multi-Address"
            : "📋 Single Address"}
        </button>
      </div>

      {/* Address Input */}
      <div className="flex flex-col gap-1">
        {isMultiAddressMode ? (
          <div className="space-y-1">
            <textarea
              placeholder="Enter addresses (one per line or paste multiple)&#10;0x123...&#10;0x456..."
              value={delegateAddresses.join("\n")}
              onChange={(e) => {
                const input = e.target.value;
                // First try splitting by line breaks
                let addresses = input
                  .split("\n")
                  .filter((addr) => addr.trim());

                // If only one line but looks like multiple addresses concatenated
                if (
                  addresses.length === 1 &&
                  addresses[0].length > 42
                ) {
                  // Split by "0x" and rebuild addresses
                  const parts = addresses[0]
                    .split("0x")
                    .filter((part) => part.length > 0);
                  addresses = parts
                    .map((part) => "0x" + part.substring(0, 40))
                    .filter((addr) => addr.length === 42);
                }

                setDelegateAddresses(addresses);
              }}
              className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-blue-400 focus:outline-none resize-none h-20"
              rows={4}
            />
            <div className="text-xs text-blue-200">
              {delegateAddresses.length} address
              {delegateAddresses.length !== 1 ? "es" : ""} entered
            </div>
          </div>
        ) : (
          <input
            type="text"
            placeholder="Friend's address (0x...)"
            value={delegateAddress}
            onChange={(e) => setDelegateAddress(e.target.value)}
            className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-blue-400 focus:outline-none"
          />
        )}
      </div>

      {/* Batch delegate controls */}
      {isBatchDelegate && drawnPixels.size > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-200">
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

              if (isMultiAddressMode) {
                if (delegateAddresses.length > 0) {
                  batchDelegatePixelsMultiSingleTx(
                    pixels,
                    delegateAddresses
                  );
                } else {
                  addNotification(
                    "error",
                    "Missing Addresses",
                    "Please enter at least one address"
                  );
                }
              } else {
                if (delegateAddress) {
                  batchDelegatePixels(pixels, delegateAddress);
                } else {
                  addNotification(
                    "error",
                    "Missing Address",
                    "Please enter friend's address"
                  );
                }
              }
            }}
            className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
            disabled={
              isDelegating ||
              (!delegateAddress && !isMultiAddressMode) ||
              (isMultiAddressMode && delegateAddresses.length === 0)
            }
          >
            {isDelegating
              ? "⏳"
              : isMultiAddressMode
              ? `Delegate to ${delegateAddresses.length}`
              : `Delegate ${drawnPixels.size}`}
          </button>
          <button
            onClick={() => setDrawnPixels(new Map())}
            className="bg-red-600 hover:bg-red-500 text-white px-1 py-1 rounded text-xs transition-colors"
            title="Clear Selection"
          >
            ✕
          </button>
        </div>
      )}

      {/* Single delegate control */}
      {!isBatchDelegate && selectedPixel && showDelegateInput && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-200">
            Pixel ({selectedPixel[0]}, {selectedPixel[1]})
          </span>
          <button
            onClick={() => {
              if (selectedPixel) {
                if (isMultiAddressMode) {
                  if (delegateAddresses.length > 0) {
                    batchDelegatePixelsMultiSingleTx(
                      [selectedPixel],
                      delegateAddresses
                    );
                  } else {
                    addNotification(
                      "error",
                      "Missing Addresses",
                      "Please enter at least one address"
                    );
                  }
                } else {
                  if (delegateAddress) {
                    delegatePixel(
                      selectedPixel[0],
                      selectedPixel[1],
                      delegateAddress
                    );
                  } else {
                    addNotification(
                      "error",
                      "Missing Address",
                      "Please enter friend's address"
                    );
                  }
                }
                setShowDelegateInput(false);
                setSelectedPixel(null);
              }
            }}
            className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
            disabled={
              isDelegating ||
              (!delegateAddress && !isMultiAddressMode) ||
              (isMultiAddressMode && delegateAddresses.length === 0)
            }
          >
            {isDelegating
              ? "⏳"
              : isMultiAddressMode
              ? `Delegate to ${delegateAddresses.length}`
              : "Delegate"}
          </button>
          <button
            onClick={() => {
              setShowDelegateInput(false);
              setSelectedPixel(null);
            }}
            className="bg-red-600 hover:bg-red-500 text-white px-1 py-1 rounded text-xs transition-colors"
            title="Cancel"
          >
            ✕
          </button>
        </div>
      )}

      {isBatchDelegate && (
        <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-30 p-2 rounded">
          <div className="font-medium mb-1">
            📦 Batch Delegation Mode Active
          </div>
          <div>• Click and drag to select an area of pixels</div>
          <div>
            • Only your owned pixels will be selected (highlighted
            in blue)
          </div>
          <div>
            •{" "}
            {isMultiAddressMode
              ? "Enter multiple addresses (one per line) to delegate to all"
              : 'Enter friend\'s address and click "Delegate" to approve all'}
          </div>
          <div>
            •{" "}
            {isMultiAddressMode
              ? "Multi-address mode: all pixels will be delegated to ALL entered addresses in one transaction"
              : "Single-address mode: all pixels will be delegated to ONE address"}
          </div>
        </div>
      )}

      {!isBatchDelegate && !showDelegateInput && (
        <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-30 p-2 rounded">
          <div className="font-medium mb-1">
            🤝 Single Delegation Mode
          </div>
          <div>
            • Click an owned pixel to delegate it to a friend
          </div>
          <div>
            •{" "}
            {isMultiAddressMode
              ? "Enter multiple addresses to delegate to all"
              : "Enter friend's address to approve access"}
          </div>
          <div>
            •{" "}
            {isMultiAddressMode
              ? "Multi-address mode: pixel will be delegated to ALL entered addresses"
              : "Single-address mode: pixel will be delegated to ONE address"}
          </div>
        </div>
      )}
    </div>
  );
}
