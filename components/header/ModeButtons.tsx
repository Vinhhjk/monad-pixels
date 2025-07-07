import React from "react";

/* eslint-disable @typescript-eslint/no-unused-vars */
interface ModeButtonsProps {
  // Batch mode
  isDrawMode: boolean;
  toggleDrawMode: () => void;
  
  // Area select mode
  isAreaSelectMode: boolean;
  setIsAreaSelectMode: (mode: boolean) => void;
  setIsDrawMode: (mode: boolean) => void;
  setSelectedPixel: (pixel: [number, number] | null) => void;
  setDrawnPixels: (pixels: Map<string, string>) => void;
  setIsDelegateMode: (mode: boolean) => void;
  setShowDelegateInput: (show: boolean) => void;
  setSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setAreaSelectionStart: (start: [number, number] | null) => void;
  setIsAreaDragging: (dragging: boolean) => void;
  
  // Delegate mode
  isDelegateMode: boolean;
  setDelegateAddress: (address: string) => void;
  setIsBatchDelegate: (batch: boolean) => void;
  setDelegateSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setDelegateAreaStart: (start: [number, number] | null) => void;
  setIsDelegateAreaDragging: (dragging: boolean) => void;
  setDelegateAddresses: (addresses: string[]) => void;
  setIsMultiAddressMode: (mode: boolean) => void;
  
  // Revoke mode
  isRevokeMode: boolean;
  setIsRevokeMode: (mode: boolean) => void;
  setShowRevokeInput: (show: boolean) => void;
  setRevokeAddress: (address: string) => void;
  setRevokeAddresses: (addresses: string[]) => void;
  setIsBatchRevoke: (batch: boolean) => void;
  setRevokeSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setRevokeAreaStart: (start: [number, number] | null) => void;
  setIsRevokeAreaDragging: (dragging: boolean) => void;
  setIsRevokeMultiAddressMode: (mode: boolean) => void;
  
  // Connection state
  isConnected: boolean;
  
  // Notification function
  addNotification: (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => void;
}

export default function ModeButtons({
  isDrawMode,
  toggleDrawMode,
  isAreaSelectMode,
  setIsAreaSelectMode,
  setIsDrawMode,
  setSelectedPixel,
  setDrawnPixels,
  setIsDelegateMode,
  setShowDelegateInput,
  setSelectedArea,
  setAreaSelectionStart,
  setIsAreaDragging,
  isDelegateMode,
  setDelegateAddress,
  setIsBatchDelegate,
  setDelegateSelectedArea,
  setDelegateAreaStart,
  setIsDelegateAreaDragging,
  setDelegateAddresses,
  setIsMultiAddressMode,
  isRevokeMode,
  setIsRevokeMode,
  setShowRevokeInput,
  setRevokeAddress,
  setRevokeAddresses,
  setIsBatchRevoke,
  setRevokeSelectedArea,
  setRevokeAreaStart,
  setIsRevokeAreaDragging,
  setIsRevokeMultiAddressMode,
  isConnected,
  addNotification,
}: ModeButtonsProps) {
  return (
    <>
      {/* Batch Mode Button */}
      <button
        onClick={toggleDrawMode}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
          isDrawMode
            ? "bg-orange-600 hover:bg-orange-500 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
        title={isDrawMode ? "Exit Batch Mode" : "Enter Batch Mode"}
      >
        {isDrawMode ? "🎨" : "✏️"}
      </button>

      {/* Area Select Mode Button */}
      <button
        onClick={() => {
          setIsAreaSelectMode(!isAreaSelectMode);
          if (!isAreaSelectMode) {
            // Entering area select mode - clear other modes and selections
            setIsDrawMode(false);
            setSelectedPixel(null);
            setDrawnPixels(new Map());
            setIsDelegateMode(false);
            setShowDelegateInput(false);
          } else {
            // Exiting area select mode - clear selections
            setSelectedArea(null);
            setAreaSelectionStart(null);
            setIsAreaDragging(false);
          }
        }}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
          isAreaSelectMode
            ? "bg-purple-600 hover:bg-purple-500 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
        title={
          isAreaSelectMode
            ? "Exit Area Select Mode"
            : "Enter Area Select Mode"
        }
      >
        {isAreaSelectMode ? "🔲" : "□"}
      </button>

      {/* Delegate Mode Button */}
      <button
        onClick={() => {
          setIsDelegateMode(!isDelegateMode);
          if (!isDelegateMode) {
            // Entering delegate mode - clear other modes
            setIsDrawMode(false);
            setIsAreaSelectMode(false);
            setSelectedPixel(null);
            setDrawnPixels(new Map());
            setSelectedArea(null);
            setAreaSelectionStart(null);
            setIsAreaDragging(false);
          } else {
            // Exiting delegate mode - clear delegate selections
            setShowDelegateInput(false);
            setDelegateAddress("");
            setIsBatchDelegate(false);
            setDelegateSelectedArea(null);
            setDelegateAreaStart(null);
            setIsDelegateAreaDragging(false);
            setDelegateAddresses([]);
            setIsMultiAddressMode(false);
          }
        }}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
          isDelegateMode
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
        title={
          isDelegateMode ? "Exit Delegate Mode" : "Enter Delegate Mode"
        }
        disabled={!isConnected}
      >
        {isDelegateMode ? "👥" : "🤝"}
      </button>

      {/* Revoke Mode Button */}
      <button
        onClick={() => {
          setIsRevokeMode(!isRevokeMode);
          if (!isRevokeMode) {
            // Entering revoke mode - clear other modes
            setIsDrawMode(false);
            setIsAreaSelectMode(false);
            setIsDelegateMode(false);
            setSelectedPixel(null);
            setDrawnPixels(new Map());
            setSelectedArea(null);
            setAreaSelectionStart(null);
            setIsAreaDragging(false);
            // Clear delegate mode
            setShowDelegateInput(false);
            setDelegateAddress("");
            setIsBatchDelegate(false);
            setDelegateSelectedArea(null);
            setDelegateAreaStart(null);
            setIsDelegateAreaDragging(false);
            setDelegateAddresses([]);
            setIsMultiAddressMode(false);
          } else {
            // Exiting revoke mode - clear revoke selections
            setShowRevokeInput(false);
            setRevokeAddress("");
            setRevokeAddresses([]);
            setIsBatchRevoke(false);
            setRevokeSelectedArea(null);
            setRevokeAreaStart(null);
            setIsRevokeAreaDragging(false);
            setIsRevokeMultiAddressMode(false);
          }
        }}
        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
          isRevokeMode
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-white"
        }`}
        title={isRevokeMode ? "Exit Revoke Mode" : "Enter Revoke Mode"}
        disabled={!isConnected}
      >
        {isRevokeMode ? "🚫" : "❌"}
      </button>
    </>
  );
}
