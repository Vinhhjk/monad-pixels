import React from "react";
import Link from "next/link";
import HeaderControls from "./HeaderControls";
import ModeButtons from "./ModeButtons";
import BatchModeControls from "./BatchModeControls";
import DelegateModeControls from "./DelegateModeControls";
import RevokeModeControls from "./RevokeModeControls";
import ZoomControls from "./ZoomControls";
import ActionButtons from "./ActionButtons";

interface HeaderProps {
  // Constants
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  MIN_VIEWPORT_SIZE: number;
  MAX_VIEWPORT_SIZE: number;

  // Position controls
  showPositionInput: boolean;
  setShowPositionInput: (show: boolean) => void;
  positionX: string;
  positionY: string;
  setPositionX: (x: string) => void;
  setPositionY: (y: string) => void;
  handleGoToPosition: () => void;

  // Mode states
  isDrawMode: boolean;
  toggleDrawMode: () => void;
  isAreaSelectMode: boolean;
  setIsAreaSelectMode: (mode: boolean) => void;
  isDelegateMode: boolean;
  setIsDelegateMode: (mode: boolean) => void;
  isRevokeMode: boolean;
  setIsRevokeMode: (mode: boolean) => void;

  // General setters
  setIsDrawMode: (mode: boolean) => void;
  setSelectedPixel: (pixel: [number, number] | null) => void;
  setDrawnPixels: (pixels: Map<string, string>) => void;
  setShowDelegateInput: (show: boolean) => void;
  setShowRevokeInput: (show: boolean) => void;

  // Area selection
  setSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setAreaSelectionStart: (start: [number, number] | null) => void;
  setIsAreaDragging: (dragging: boolean) => void;

  // Delegate mode states
  delegateAddress: string;
  setDelegateAddress: (address: string) => void;
  delegateAddresses: string[];
  setDelegateAddresses: (addresses: string[]) => void;
  isMultiAddressMode: boolean;
  setIsMultiAddressMode: (mode: boolean) => void;
  isBatchDelegate: boolean;
  setIsBatchDelegate: (batch: boolean) => void;
  setDelegateSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setDelegateAreaStart: (start: [number, number] | null) => void;
  setIsDelegateAreaDragging: (dragging: boolean) => void;
  showDelegateInput: boolean;
  isDelegating: boolean;

  // Revoke mode states
  revokeAddress: string;
  setRevokeAddress: (address: string) => void;
  revokeAddresses: string[];
  setRevokeAddresses: (addresses: string[]) => void;
  isRevokeMultiAddressMode: boolean;
  setIsRevokeMultiAddressMode: (mode: boolean) => void;
  isBatchRevoke: boolean;
  setIsBatchRevoke: (batch: boolean) => void;
  setRevokeSelectedArea: (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null) => void;
  setRevokeAreaStart: (start: [number, number] | null) => void;
  setIsRevokeAreaDragging: (dragging: boolean) => void;
  showRevokeInput: boolean;
  isRevoking: boolean;

  // Batch drawing
  drawnPixels: Map<string, string>;
  isBatchMinting: boolean;
  isBatchUpdating: boolean;
  batchMintPixels: () => void;
  batchUpdatePixels: () => void;
  clearDrawing: () => void;

  // Pixel utility functions
  isPixelMinted: (x: number, y: number) => boolean;
  isPixelPending: (x: number, y: number) => boolean;
  canUpdatePixel: (x: number, y: number) => boolean;

  // Delegation functions
  selectedPixel: [number, number] | null;
  batchDelegatePixels: (pixels: [number, number][], address: string) => void;
  batchDelegatePixelsMultiSingleTx: (pixels: [number, number][], addresses: string[]) => void;
  delegatePixel: (x: number, y: number, address: string) => void;

  // Revoke functions
  batchRevokePixelsSingleAddress: (pixels: [number, number][], address: string) => void;
  batchRevokePixelsMultiSingleTx: (pixels: [number, number][], addresses: string[]) => void;
  revokePixelFromAddress: (x: number, y: number, address: string) => void;

  // Zoom controls
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  viewportSize: number;
  zoomPercentage: number;

  // Action buttons
  setIsLoadingChunks: (loading: boolean) => void;
  loadVisiblePixels: () => void;
  isLoadingChunks: boolean;
  isLoading: boolean;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;

  // Connection state
  isConnected: boolean;

  // Notification function
  addNotification: (
    type: "success" | "error" | "info",
    title: string,
    message: string
  ) => void;
}

export default function Header(props: HeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-2 sm:px-4 py-2 sm:py-3">
      <div className="flex justify-between items-center gap-1 sm:gap-2">
        {/* Left side */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/nft"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-1"
          >
            🎨 NFT
          </Link>
        </div>

        {/* Right side controls */}
        <div className="relative flex items-center gap-1 sm:gap-2 flex-wrap">
          <HeaderControls
            showPositionInput={props.showPositionInput}
            setShowPositionInput={props.setShowPositionInput}
            positionX={props.positionX}
            positionY={props.positionY}
            setPositionX={props.setPositionX}
            setPositionY={props.setPositionY}
            handleGoToPosition={props.handleGoToPosition}
            CANVAS_WIDTH={props.CANVAS_WIDTH}
            CANVAS_HEIGHT={props.CANVAS_HEIGHT}
          />

          <ModeButtons
            isDrawMode={props.isDrawMode}
            toggleDrawMode={props.toggleDrawMode}
            isAreaSelectMode={props.isAreaSelectMode}
            setIsAreaSelectMode={props.setIsAreaSelectMode}
            setIsDrawMode={props.setIsDrawMode}
            setSelectedPixel={props.setSelectedPixel}
            setDrawnPixels={props.setDrawnPixels}
            setIsDelegateMode={props.setIsDelegateMode}
            setShowDelegateInput={props.setShowDelegateInput}
            setSelectedArea={props.setSelectedArea}
            setAreaSelectionStart={props.setAreaSelectionStart}
            setIsAreaDragging={props.setIsAreaDragging}
            isDelegateMode={props.isDelegateMode}
            setDelegateAddress={props.setDelegateAddress}
            setIsBatchDelegate={props.setIsBatchDelegate}
            setDelegateSelectedArea={props.setDelegateSelectedArea}
            setDelegateAreaStart={props.setDelegateAreaStart}
            setIsDelegateAreaDragging={props.setIsDelegateAreaDragging}
            setDelegateAddresses={props.setDelegateAddresses}
            setIsMultiAddressMode={props.setIsMultiAddressMode}
            isRevokeMode={props.isRevokeMode}
            setIsRevokeMode={props.setIsRevokeMode}
            setShowRevokeInput={props.setShowRevokeInput}
            setRevokeAddress={props.setRevokeAddress}
            setRevokeAddresses={props.setRevokeAddresses}
            setIsBatchRevoke={props.setIsBatchRevoke}
            setRevokeSelectedArea={props.setRevokeSelectedArea}
            setRevokeAreaStart={props.setRevokeAreaStart}
            setIsRevokeAreaDragging={props.setIsRevokeAreaDragging}
            setIsRevokeMultiAddressMode={props.setIsRevokeMultiAddressMode}
            isConnected={props.isConnected}
            addNotification={props.addNotification}
          />

          <BatchModeControls
            isDrawMode={props.isDrawMode}
            drawnPixels={props.drawnPixels}
            isPixelMinted={props.isPixelMinted}
            isPixelPending={props.isPixelPending}
            canUpdatePixel={props.canUpdatePixel}
            isBatchMinting={props.isBatchMinting}
            isBatchUpdating={props.isBatchUpdating}
            batchMintPixels={props.batchMintPixels}
            batchUpdatePixels={props.batchUpdatePixels}
            clearDrawing={props.clearDrawing}
          />

          <DelegateModeControls
            isDelegateMode={props.isDelegateMode}
            isBatchDelegate={props.isBatchDelegate}
            setIsBatchDelegate={props.setIsBatchDelegate}
            setDrawnPixels={props.setDrawnPixels}
            setSelectedPixel={props.setSelectedPixel}
            setShowDelegateInput={props.setShowDelegateInput}
            setDelegateSelectedArea={props.setDelegateSelectedArea}
            setDelegateAreaStart={props.setDelegateAreaStart}
            setIsDelegateAreaDragging={props.setIsDelegateAreaDragging}
            isMultiAddressMode={props.isMultiAddressMode}
            setIsMultiAddressMode={props.setIsMultiAddressMode}
            delegateAddress={props.delegateAddress}
            setDelegateAddress={props.setDelegateAddress}
            delegateAddresses={props.delegateAddresses}
            setDelegateAddresses={props.setDelegateAddresses}
            drawnPixels={props.drawnPixels}
            isDelegating={props.isDelegating}
            batchDelegatePixels={props.batchDelegatePixels}
            batchDelegatePixelsMultiSingleTx={props.batchDelegatePixelsMultiSingleTx}
            selectedPixel={props.selectedPixel}
            showDelegateInput={props.showDelegateInput}
            delegatePixel={props.delegatePixel}
            addNotification={props.addNotification}
          />

          <RevokeModeControls
            isRevokeMode={props.isRevokeMode}
            isBatchRevoke={props.isBatchRevoke}
            setIsBatchRevoke={props.setIsBatchRevoke}
            setDrawnPixels={props.setDrawnPixels}
            setSelectedPixel={props.setSelectedPixel}
            setShowRevokeInput={props.setShowRevokeInput}
            setRevokeSelectedArea={props.setRevokeSelectedArea}
            setRevokeAreaStart={props.setRevokeAreaStart}
            setIsRevokeAreaDragging={props.setIsRevokeAreaDragging}
            isRevokeMultiAddressMode={props.isRevokeMultiAddressMode}
            setIsRevokeMultiAddressMode={props.setIsRevokeMultiAddressMode}
            revokeAddress={props.revokeAddress}
            setRevokeAddress={props.setRevokeAddress}
            revokeAddresses={props.revokeAddresses}
            setRevokeAddresses={props.setRevokeAddresses}
            drawnPixels={props.drawnPixels}
            isRevoking={props.isRevoking}
            batchRevokePixelsSingleAddress={props.batchRevokePixelsSingleAddress}
            batchRevokePixelsMultiSingleTx={props.batchRevokePixelsMultiSingleTx}
            selectedPixel={props.selectedPixel}
            showRevokeInput={props.showRevokeInput}
            revokePixelFromAddress={props.revokePixelFromAddress}
            addNotification={props.addNotification}
          />

          <ZoomControls
            handleZoomIn={props.handleZoomIn}
            handleZoomOut={props.handleZoomOut}
            viewportSize={props.viewportSize}
            zoomPercentage={props.zoomPercentage}
            MIN_VIEWPORT_SIZE={props.MIN_VIEWPORT_SIZE}
            MAX_VIEWPORT_SIZE={props.MAX_VIEWPORT_SIZE}
          />

          <ActionButtons
            setIsLoadingChunks={props.setIsLoadingChunks}
            loadVisiblePixels={props.loadVisiblePixels}
            isLoadingChunks={props.isLoadingChunks}
            isLoading={props.isLoading}
            showSidebar={props.showSidebar}
            setShowSidebar={props.setShowSidebar}
          />
        </div>
      </div>
    </div>
  );
}
