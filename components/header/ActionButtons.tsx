import React from "react";
import ConnectButton from "@/components/ConnectButton";

interface ActionButtonsProps {
  setIsLoadingChunks: (loading: boolean) => void;
  loadVisiblePixels: () => void;
  isLoadingChunks: boolean;
  isLoading: boolean;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

export default function ActionButtons({
  setIsLoadingChunks,
  loadVisiblePixels,
  isLoadingChunks,
  isLoading,
  showSidebar,
  setShowSidebar,
}: ActionButtonsProps) {
  return (
    <>
      {/* Refresh Button */}
      <button
        onClick={() => {
          setIsLoadingChunks(true);
          loadVisiblePixels();
        }}
        className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
        disabled={isLoadingChunks}
        title="Refresh"
      >
        <span className={isLoading ? "animate-spin" : ""}>🔄</span>
      </button>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="bg-blue-600 hover:bg-blue-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
        title={showSidebar ? "Hide Tools" : "Show Tools"}
      >
        🎨
      </button>

      {/* Connect Button */}
      <ConnectButton />
    </>
  );
}
