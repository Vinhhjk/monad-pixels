import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { NFTItem, isCompositeNFT } from "@/lib/nft-services";
import { usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import PXNFT_ABI from "@/contractABI/PXNFT.json";

const CONTRACT_ADDRESS = "0xE2948e08947430068C99d99d457a243d7Dc978cb";

interface NFTGridProps {
  nfts: NFTItem[];
  isLoading: boolean;
  filter: "pixels" | "composed";
  onNFTClick?: (nft: NFTItem) => void;
  showDecomposeButton?: boolean;
  onDecomposeSuccess?: () => void;
}

export default function NFTGrid({
  nfts,
  isLoading,
  filter,
  onNFTClick,
  showDecomposeButton = false,
  onDecomposeSuccess,
}: NFTGridProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin text-2xl">🔮</div>
        <p className="mt-2 text-gray-600">Loading {filter}...</p>
        <p className="text-xs text-gray-500 mt-1">Hang tight...</p>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="col-span-full text-center py-8 text-gray-500">
        <p>No {filter} found</p>
        <p className="text-xs mt-1">
          {filter === "pixels" ? "No pixel NFTs found on Magic Eden" : "No composite NFTs found on Magic Eden"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 200 Notice */}
      <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-blue-600 text-sm">ℹ️</span>
          <p className="text-sm text-blue-800">
            <span className="font-medium">Note:</span> Displaying top 200 (For details please search for specific NFTs)
          </p>
        </div>
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {nfts.map((nft) => (
          <NFTCard
            key={nft.tokenId}
            nft={nft}
            filter={filter}
            onClick={() => onNFTClick?.(nft)}
            showDecomposeButton={showDecomposeButton}
            onDecomposeSuccess={onDecomposeSuccess}
          />
        ))}
      </div>
    </div>
  );
}

interface NFTCardProps {
  nft: NFTItem;
  filter: "pixels" | "composed";
  onClick?: () => void;
  showDecomposeButton?: boolean;
  onDecomposeSuccess?: () => void;
}

function NFTCard({ nft, filter, onClick, showDecomposeButton = false, onDecomposeSuccess }: NFTCardProps) {
  const [decomposeResult, setDecomposeResult] = useState<{ success: boolean; error?: string } | null>(null);
  const publicClient = usePublicClient();
  const { address } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  
  // State for tracking decompose transaction
  const [decomposeHash, setDecomposeHash] = useState<`0x${string}` | null>(null);
  
  // Watch for transaction receipt
  const { isLoading: isDecomposeLoading, isSuccess: isDecomposeSuccess } = useWaitForTransactionReceipt({
    hash: decomposeHash || undefined,
  });

  // Handle successful decomposition
  React.useEffect(() => {
    if (isDecomposeSuccess && decomposeHash) {
      setDecomposeResult({ success: true });
      setDecomposeHash(null);
      
      // Show success message briefly, then refresh
      setTimeout(() => {
        onDecomposeSuccess?.();
        setDecomposeResult(null);
      }, 2000);
    }
  }, [isDecomposeSuccess, decomposeHash, onDecomposeSuccess]);

  const handleDecompose = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent card click

    if (!publicClient || !address || !isCompositeNFT(nft.tokenId)) return;

    setDecomposeResult(null);

    try {
      // First, verify the user owns this composite NFT
      const owner = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "ownerOf",
        args: [BigInt(nft.tokenId)],
      }) as string;

      if (owner.toLowerCase() !== address.toLowerCase()) {
        setDecomposeResult({ success: false, error: "You don't own this composite NFT" });
        return;
      }

      console.log(`Decomposing composite NFT ${nft.tokenId}...`);

      // Call the decompose function
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "decomposePixels",
        args: [BigInt(nft.tokenId)],
      });

      setDecomposeHash(hash);
      console.log(`Decompose transaction submitted: ${hash}`);

    } catch (error: unknown) {
      console.error("Error decomposing composite NFT:", error);
      
      let errorMessage = "Failed to decompose composite NFT";
      
      if (error instanceof Error) {
        if (error.message?.includes("Not owner of composite")) {
          errorMessage = "You don't own this composite NFT";
        } else if (error.message?.includes("Not a composite NFT")) {
          errorMessage = "This is not a composite NFT";
        } else if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
          errorMessage = "Transaction was rejected";
        }
      }

      setDecomposeResult({ success: false, error: errorMessage });
    }
  };

  const content = (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer relative">
      <div className="aspect-square rounded mb-2 flex items-center justify-center border border-gray-200 overflow-hidden">
        {nft.metadata?.image ? (
          <Image
            src={nft.metadata.image}
            alt={nft.metadata.name || `Token #${nft.tokenId}`}
            width={120}
            height={120}
            className="w-full h-full object-cover"
            style={{ imageRendering: "pixelated" }}
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback placeholder - shown when no image or image fails */}
        <div className={`flex flex-col items-center justify-center h-full w-full ${nft.metadata?.image ? 'hidden' : ''}`}>
          {filter === "pixels" && nft.color ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1" style={{ backgroundColor: nft.color }} />
              <div className="bg-white bg-opacity-90 text-xs p-1 text-center">
                ({nft.x}, {nft.y})
              </div>
            </div>
          ) : (
            <>
              <span className="text-gray-500 text-xs mb-1">
                {filter === "pixels" ? "🎨" : "🧩"}
              </span>
              <span className="text-gray-500 text-xs">#{nft.tokenId}</span>
              {filter === "pixels" &&
                nft.x !== undefined &&
                nft.y !== undefined && (
                  <span className="text-gray-400 text-xs">
                    ({nft.x}, {nft.y})
                  </span>
                )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-gray-600 truncate font-medium">
          {nft.metadata?.name || `Token #${nft.tokenId}`}
        </p>
        {filter === "pixels" && nft.x !== undefined && nft.y !== undefined && (
          <p className="text-xs text-gray-500">
            Pixel ({nft.x}, {nft.y})
          </p>
        )}
        {nft.color && (
          <p className="text-xs text-gray-500 font-mono">{nft.color}</p>
        )}
        {nft.rarityRank && (
          <p className="text-xs text-purple-600 font-medium">
            ✨ Rank #{nft.rarityRank}
          </p>
        )}

        {/* Decompose Button for Composite NFTs */}
        {showDecomposeButton && isCompositeNFT(nft.tokenId) && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleDecompose}
              disabled={isDecomposeLoading}
              className={`w-full text-xs px-2 py-1 rounded transition-colors ${
                isDecomposeLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
            >
              {isDecomposeLoading ? "🔄 Decomposing..." : "🔓 Decompose"}
            </button>
            
            {/* Result Message */}
            {decomposeResult && (
              <div className={`mt-1 text-xs p-1 rounded ${
                decomposeResult.success 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              }`}>
                {decomposeResult.success ? "✅ Decomposed!" : `❌ ${decomposeResult.error}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Make the whole card clickable and link to the NFT page
  return (
    <Link 
      href={`/nft?tokenId=${nft.tokenId}`} 
      className="block"
      onClick={onClick}
    >
      {content}
    </Link>
  );
}
