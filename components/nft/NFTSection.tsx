import React from "react";
import NFTGrid from "./NFTGrid";
import { NFTItem } from "@/lib/nft-services";

interface NFTSectionProps {
  title: string;
  nfts: NFTItem[];
  isLoading: boolean;
  filter: "pixels" | "composed";
  onFilterChange: (filter: "pixels" | "composed") => void;
  onRefresh?: () => void;
  showConnectMessage?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showDecomposeButton?: boolean;
  onDecomposeSuccess?: () => void;
}

export default function NFTSection({
  title,
  nfts,
  isLoading,
  filter,
  onFilterChange,
  onRefresh,
  showConnectMessage,
  currentPage,
  totalPages,
  onPageChange,
  showDecomposeButton = false,
  onDecomposeSuccess,
}: NFTSectionProps) {
  if (showConnectMessage) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>Please connect your wallet to view your NFTs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center justify-between">
        <div className="flex gap-4 items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => onFilterChange("pixels")}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filter === "pixels"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              🎨 Pixels
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onFilterChange("composed")}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  filter === "composed"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                🧩 Composed
              </button>
              {/* Decompose All Button - only show when on composed filter and decompose is enabled */}
              {showDecomposeButton && filter === "composed" && (
                <button
                  onClick={() => {
                    // This will trigger decomposition for all visible composed NFTs
                    // We'll handle this in the parent component
                    onDecomposeSuccess?.();
                  }}
                  className="ml-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
                  title="Decompose all visible composite NFTs"
                >
                  🔓 Decompose All
                </button>
              )}
            </div>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            {isLoading ? "⚡" : "🔄"} Refresh
          </button>
        )}
      </div>

      <NFTGrid
        nfts={nfts}
        isLoading={isLoading}
        filter={filter}
        showDecomposeButton={showDecomposeButton}
        onDecomposeSuccess={onDecomposeSuccess}
      />      
      {/* Pagination */}
      {!isLoading && totalPages > 1 && onPageChange && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
          >
            Previous
          </button>
          
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 text-sm rounded ${
                    currentPage === pageNum
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
          >
            Next
          </button>
          
          <span className="text-sm text-gray-500 ml-4">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
