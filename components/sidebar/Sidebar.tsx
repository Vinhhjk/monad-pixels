import React from 'react';
import SidebarHeader from './SidebarHeader';
import ColorPalette from './ColorPalette';
import AreaSelectionInfo from './AreaSelectionInfo';
import PixelInfo from './PixelInfo';
import PixelControls from './PixelControls';

interface SidebarProps {
  showSidebar: boolean;
  sidebarPosition: { x: number; y: number };
  isDraggingSidebar: boolean;
  totalMinted: number;
  canvasWidth: number;
  canvasHeight: number;
  colorPalette: string[];
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  customHexColor: string;
  setCustomHexColor: (color: string) => void;
  showHexInput: boolean;
  setShowHexInput: (show: boolean) => void;
  applyHexColor: () => void;
  handleHexKeyPress: (e: React.KeyboardEvent) => void;
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
  setSelectedArea: (area: { startX: number; startY: number; endX: number; endY: number } | null) => void;
  setAreaSelectionStart: (start: [number, number] | null) => void;
  setIsAreaDragging: (dragging: boolean) => void;
  selectedPixel: [number, number] | null;
  isDrawMode: boolean;
  drawnPixels: Map<string, string>;
  pixelData: { [key: string]: { color: string; owner: string | null; isMinted: boolean } };
  getPixelOwner: (x: number, y: number) => string | null;
  isLoadingPixelDelegations: boolean;
  pixelDelegationCount: number;
  pixelDelegatedAddresses: string[];
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
  setShowSidebar: (show: boolean) => void;
  handleSidebarDragStart: (e: React.MouseEvent) => void;
  handleSidebarTouchStart: (e: React.TouchEvent) => void;
}

export default function Sidebar(props: SidebarProps) {
  if (!props.showSidebar) return null;

  return (
    <div
      className={`fixed w-80 h-full bg-gray-900 bg-opacity-95 backdrop-blur-sm border border-gray-700 flex flex-col z-30 shadow-2xl rounded-lg ${
        props.isDraggingSidebar ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: `${props.sidebarPosition.x}px`,
        top: `${props.sidebarPosition.y}px`,
        right: "auto",
      }}
    >
      <SidebarHeader
        totalMinted={props.totalMinted}
        canvasWidth={props.canvasWidth}
        canvasHeight={props.canvasHeight}
        onClose={() => props.setShowSidebar(false)}
        onDragStart={props.handleSidebarDragStart}
        onTouchStart={props.handleSidebarTouchStart}
      />
      
      {/* Scrollable content container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <ColorPalette
          colorPalette={props.colorPalette}
          selectedColor={props.selectedColor}
          setSelectedColor={props.setSelectedColor}
          customHexColor={props.customHexColor}
          setCustomHexColor={props.setCustomHexColor}
          showHexInput={props.showHexInput}
          setShowHexInput={props.setShowHexInput}
          applyHexColor={props.applyHexColor}
          handleHexKeyPress={props.handleHexKeyPress}
        />

        <AreaSelectionInfo
          isAreaSelectMode={props.isAreaSelectMode}
          selectedArea={props.selectedArea}
          compositionInfo={props.compositionInfo}
          isConnected={props.isConnected}
          isComposing={props.isComposing}
          composePixels={props.composePixels}
          onClearSelection={() => {
            props.setSelectedArea(null);
            props.setAreaSelectionStart(null);
            props.setIsAreaDragging(false);
          }}
        />

        <PixelInfo
          selectedPixel={props.selectedPixel}
          isDrawMode={props.isDrawMode}
          drawnPixels={props.drawnPixels}
          isAreaSelectMode={props.isAreaSelectMode}
          selectedColor={props.selectedColor}
          pixelData={props.pixelData}
          getPixelOwner={props.getPixelOwner}
          isLoadingPixelDelegations={props.isLoadingPixelDelegations}
          pixelDelegationCount={props.pixelDelegationCount}
          setShowDelegationPopup={props.setShowDelegationPopup}
          isDelegateMode={props.isDelegateMode}
          isRevokeMode={props.isRevokeMode}
          isLoadingBatchDelegations={props.isLoadingBatchDelegations}
          batchDelegationData={props.batchDelegationData}
          setShowBatchDelegationPopup={props.setShowBatchDelegationPopup}
          isPixelMinted={props.isPixelMinted}
          isPixelPending={props.isPixelPending}
        />

        <PixelControls
          selectedPixel={props.selectedPixel}
          isDrawMode={props.isDrawMode}
          drawnPixels={props.drawnPixels}
          isConnected={props.isConnected}
          selectedColor={props.selectedColor}
          isPixelMinted={props.isPixelMinted}
          isPixelPending={props.isPixelPending}
          canUpdatePixel={props.canUpdatePixel}
          getTokenId={props.getTokenId}
          mintPixel={props.mintPixel}
          updatePixel={props.updatePixel}
          isMinting={props.isMinting}
          isBatchMinting={props.isBatchMinting}
          isBatchUpdating={props.isBatchUpdating}
          batchMintPixels={props.batchMintPixels}
          batchUpdatePixels={props.batchUpdatePixels}
          batchRevokeApprovals={props.batchRevokeApprovals}
          clearDrawing={props.clearDrawing}
          toggleDrawMode={props.toggleDrawMode}
          isCheckingAuth={props.isCheckingAuth}
          authResults={props.authResults}
          batchFeeInfo={props.batchFeeInfo}
          pixelAuthStatus={props.pixelAuthStatus}
          isCheckingFee={props.isCheckingFee}
          hasExemption={props.hasExemption}
          feeRequired={props.feeRequired}
          isRevokingApproval={props.isRevokingApproval}
          isLoadingBatchDelegations={props.isLoadingBatchDelegations}
          batchDelegationData={props.batchDelegationData}
          setShowBatchDelegationPopup={props.setShowBatchDelegationPopup}
          isLoadingPixelDelegations={props.isLoadingPixelDelegations}
          pixelDelegationCount={props.pixelDelegationCount}
          pixelDelegatedAddresses={props.pixelDelegatedAddresses}
          setShowDelegationPopup={props.setShowDelegationPopup}
        />

        {/* Instructions */}
        <div className="p-6 text-sm text-gray-400 space-y-2">
          <h3 className="text-white font-semibold mb-3">📖 How to Play</h3>
          <div className="space-y-1">
            <p>• Click any pixel to select it</p>
            <p>• Choose a color from the palette</p>
            <p>• Mint unminted pixels to claim them</p>
            <p>• Update colors of pixels you own</p>
            <p>• Drag to pan around the canvas</p>
            <p>• Scroll or use buttons to zoom</p>
          </div>
        </div>
      </div>
    </div>
  );
}
