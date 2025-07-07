import type { PublicClient } from "viem";
import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Abi } from "viem";

const CONTRACT_ADDRESS = "0xE2948e08947430068C99d99d457a243d7Dc978cb";

// Magic Eden API configuration
const MAGIC_EDEN_API_KEY = process.env.NEXT_PUBLIC_MAGIC_EDEN_API_KEY;

// Magic Eden API types
interface MagicEdenToken {
  token: {
    chainId: number;
    contract: string;
    tokenId: string;
    name: string | null; // This can be null!
    description: string | null; // This can be null!
    image: string;
    imageSmall: string;
    imageLarge: string;
    rarity?: number;
    rarityRank?: number;
    owner?: string;
    mintedAt: string;
  };
  ownership?: {
    acquiredAt: string;
  };
  updatedAt?: string; // This property exists in your response
}

interface MagicEdenCollectionResponse {
  tokens: MagicEdenToken[];
  continuation?: string | null;
}

interface MagicEdenUserResponse {
  tokens: MagicEdenToken[];
  continuation?: string | null;
}

// Simple cache to avoid refetching data
const nftCache = new Map<string, { data: NFTItem[]; timestamp: number }>();
const CACHE_DURATION = 60000; // 30 seconds cache

function getCacheKey(
  type: string,
  userAddress?: string,
  filter?: string
): string {
  return `${type}-${userAddress || "all"}-${filter || "pixels"}`;
}

function getCachedData(key: string): NFTItem[] | null {
  const cached = nftCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Using cached Magic Eden data for ${key}`);
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: NFTItem[]): void {
  nftCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear cache for specific data type or all cache
 */
export function clearNFTCache(
  type?: "minted" | "user",
  userAddress?: string,
  filter?: string
): void {
  if (type) {
    const cacheKey = getCacheKey(type, userAddress, filter);
    nftCache.delete(cacheKey);
    console.log(`Cleared cache for ${cacheKey}`);
  } else {
    nftCache.clear();
    console.log("Cleared all NFT cache");
  }
}

export interface NFTItem {
  tokenId: number;
  owner: string;
  metadata?: NFTMetadata;
  x?: number;
  y?: number;
  color?: string;
  rarity?: number;
  rarityRank?: number;
  description?: string;
  mintedAt?: string;
  acquiredAt?: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Decode base64 JSON metadata from contract response
 */
export function decodeBase64JSON(base64String: string): NFTMetadata {
  const base64Data = base64String.replace("data:application/json;base64,", "");
  const jsonString = atob(base64Data);
  return JSON.parse(jsonString);
}

/**
 * Fetch collection NFTs from Magic Eden API
 */
async function fetchMagicEdenCollectionNFTs(
  filter: "pixels" | "composed" = "pixels",
  limit: number = 50
): Promise<NFTItem[]> {
  try {
    const url = `/.netlify/functions/magic-eden-collection?collection=${CONTRACT_ADDRESS}&sortBy=floorAskPrice&limit=${limit}`;
    
    console.log('Calling Netlify function:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Netlify function error: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
    }

    const data: MagicEdenCollectionResponse = await response.json();
    
    // Filter by NFT type based on name pattern - with null checks
    const filteredTokens = data.tokens.filter(item => {
      const name = item.token.name;
      if (!name) {
        console.warn('Token has null name:', item.token.tokenId);
        return false;
      }
      
      if (filter === "pixels") {
        return name.includes("Pixel (") && !name.includes("Composite");
      } else {
        return name.includes("Composite");
      }
    });

    console.log(`Filtered ${filteredTokens.length} tokens from ${data.tokens.length} total tokens`);

    // Convert to NFTItem format
    const nfts: NFTItem[] = filteredTokens.map(item => {
      const tokenId = parseInt(item.token.tokenId);
      const coords = tokenId < 100000 ? getCoordinatesFromTokenId(tokenId) : undefined;
      
      return {
        tokenId,
        owner: item.token.owner || "",
        rarity: item.token.rarity,
        rarityRank: item.token.rarityRank,
        description: item.token.description || "",
        mintedAt: item.token.mintedAt,
        x: coords?.x,
        y: coords?.y,
        metadata: {
          name: item.token.name || `Token #${tokenId}`,
          description: item.token.description || "",
          image: item.token.image,
          attributes: []
        }
      };
    });

    console.log(`Fetched ${nfts.length} ${filter} NFTs from Magic Eden API via Netlify function`);
    return nfts;
  } catch (error) {
    console.error("Error fetching from Magic Eden API via Netlify function:", error);
    throw error;
  }
}

/**
 * Fetch user's NFTs from Magic Eden API
 */
async function fetchMagicEdenUserNFTs(
  userAddress: string,
  filter: "pixels" | "composed" = "pixels",
  limit: number = 50
): Promise<NFTItem[]> {
  try {
    const url = `/.netlify/functions/magic-eden-user?userAddress=${userAddress}&limit=${limit}`;
    
    console.log('Calling Netlify function:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Netlify function error: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
    }

    const data: MagicEdenUserResponse = await response.json();
    
    // Filter by contract address and NFT type - with null checks
    const filteredTokens = data.tokens.filter(item => {
      const isOurContract = item.token.contract.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
      if (!isOurContract) return false;
      
      const name = item.token.name;
      if (!name) {
        console.warn('User token has null name:', item.token.tokenId);
        return false;
      }
      
      if (filter === "pixels") {
        return name.includes("Pixel (") && !name.includes("Composite");
      } else {
        return name.includes("Composite");
      }
    });

    // Convert to NFTItem format
    const nfts: NFTItem[] = filteredTokens.map(item => {
      const tokenId = parseInt(item.token.tokenId);
      const coords = tokenId < 100000 ? getCoordinatesFromTokenId(tokenId) : undefined;
      
      return {
        tokenId,
        owner: userAddress,
        rarity: item.token.rarity,
        rarityRank: item.token.rarityRank,
        description: item.token.description || "",
        mintedAt: item.token.mintedAt,
        acquiredAt: item.ownership?.acquiredAt,
        x: coords?.x,
        y: coords?.y,
        metadata: {
          name: item.token.name || `Token #${tokenId}`,
          description: item.token.description || "",
          image: item.token.image,
          attributes: []
        }
      };
    });

    console.log(`Fetched ${nfts.length} ${filter} NFTs for user ${userAddress} from Magic Eden API via Netlify function`);
    return nfts;
  } catch (error) {
    console.error("Error fetching user NFTs from Magic Eden API via Netlify function:", error);
    throw error;
  }
}

/**
 * Get coordinates from token ID
 */
export function getCoordinatesFromTokenId(tokenId: number) {
  const x = tokenId % 100;
  const y = Math.floor(tokenId / 100);
  return { x, y };
}

/**
 * Fetch minted NFTs using Magic Eden API
 */
export async function fetchMintedNFTs(
  publicClient: PublicClient,
  filter: "pixels" | "composed" = "pixels",
  maxNFTs: number = 50
): Promise<NFTItem[]> {
  if (!publicClient) throw new Error("Public client not available");

  // Check cache first
  const cacheKey = getCacheKey("minted", undefined, filter);
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    // Fetch fresh images for cached data
    const nftsWithImages = await fetchBatchNFTImages(publicClient, cachedData.slice(0, maxNFTs));
    return nftsWithImages;
  }

  try {
    console.log(`Fetching ${filter} NFTs using Magic Eden API...`);
    const nfts = await fetchMagicEdenCollectionNFTs(filter, maxNFTs);
    
    // Fetch fresh images from contract
    const nftsWithImages = await fetchBatchNFTImages(publicClient, nfts);
    
    setCachedData(cacheKey, nftsWithImages);
    return nftsWithImages.slice(0, maxNFTs);
  } catch (magicEdenError) {
    console.error("Magic Eden API failed:", magicEdenError);
    
    if (!MAGIC_EDEN_API_KEY) {
      console.error("Magic Eden API key not configured. Please add MAGIC_EDEN_API_KEY to your environment variables.");
    }
    
    return [];
  }
}

/**
 * Fetch NFTs owned by a specific address using Magic Eden API
 */
export async function fetchUserNFTs(
  publicClient: PublicClient,
  userAddress: string,
  filter: "pixels" | "composed" = "pixels",
  maxNFTs: number = 50
): Promise<NFTItem[]> {
  if (!publicClient || !userAddress) {
    throw new Error("Missing required parameters");
  }

  // Check cache first
  const cacheKey = getCacheKey("user", userAddress, filter);
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    // Fetch fresh images for cached data
    const nftsWithImages = await fetchBatchNFTImages(publicClient, cachedData.slice(0, maxNFTs));
    return nftsWithImages;
  }

  try {
    console.log(`Fetching ${filter} NFTs for user ${userAddress} using Magic Eden API...`);
    const nfts = await fetchMagicEdenUserNFTs(userAddress, filter, maxNFTs);
    
    // Fetch fresh images from contract
    const nftsWithImages = await fetchBatchNFTImages(publicClient, nfts);
    
    setCachedData(cacheKey, nftsWithImages);
    return nftsWithImages.slice(0, maxNFTs);
  } catch (magicEdenError) {
    console.error("Magic Eden API failed:", magicEdenError);
    
    if (!MAGIC_EDEN_API_KEY) {
      console.error("Magic Eden API key not configured. Please add MAGIC_EDEN_API_KEY to your environment variables.");
    }
    
    return [];
  }
}
/**
 * Fetch fresh metadata from contract (for updated images)
 */
export async function fetchFreshNFTMetadata(
  publicClient: PublicClient,
  tokenId: number
): Promise<NFTMetadata | null> {
  if (!publicClient) throw new Error("Public client not available");

  try {
    const tokenURI = (await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: PXNFT_ABI as Abi,
      functionName: "tokenURI",
      args: [BigInt(tokenId)],
    })) as string;

    return decodeBase64JSON(tokenURI);
  } catch (error) {
    console.error(`Error fetching fresh metadata for token ${tokenId}:`, error);
    return null;
  }
}

/**
 * Update NFT with fresh image from contract if needed
 */
export async function refreshNFTImage(
  publicClient: PublicClient,
  nft: NFTItem
): Promise<NFTItem> {
  try {
    const freshMetadata = await fetchFreshNFTMetadata(publicClient, nft.tokenId);
    if (freshMetadata) {
      return {
        ...nft,
        metadata: freshMetadata
      };
    }
  } catch (error) {
    console.warn(`Failed to refresh image for token ${nft.tokenId}:`, error);
  }
  return nft;
}

/**
 * Legacy function for backward compatibility
 */
export async function fetchNFTMetadata(
  publicClient: PublicClient,
  tokenId: number
): Promise<NFTMetadata | null> {
  return fetchFreshNFTMetadata(publicClient, tokenId);
}
export async function fetchBatchNFTImages(
  publicClient: PublicClient,
  nfts: NFTItem[]
): Promise<NFTItem[]> {
  if (!publicClient || nfts.length === 0) return nfts;

  try {
    const tokenIds = nfts.map(nft => BigInt(nft.tokenId));
    
    console.log(`Fetching batch images for ${tokenIds.length} NFTs...`);
    
    const [images, exists] = (await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: PXNFT_ABI as Abi,
      functionName: "getBatchTokenImages",
      args: [tokenIds],
    })) as [string[], boolean[]];

    // Update NFTs with fresh images from contract
    const updatedNFTs = nfts.map((nft, index) => {
      if (exists[index] && images[index]) {
        return {
          ...nft,
          metadata: {
            ...nft.metadata,
            name: nft.metadata?.name || `Token #${nft.tokenId}`,
            description: nft.metadata?.description || "",
            image: images[index], // Use fresh image from contract
            attributes: nft.metadata?.attributes || []
          }
        };
      }
      return nft;
    });

    console.log(`Successfully fetched ${images.filter(img => img).length} images from contract`);
    return updatedNFTs;
  } catch (error) {
    console.error("Error fetching batch images:", error);
    // Return original NFTs if batch fetch fails
    return nfts;
  }
}
export function isCompositeNFT(tokenId: number): boolean {
  return tokenId >= 100000;
}

/**
 * Get composition info for a composite NFT
 */
export async function getCompositionInfo(
  publicClient: PublicClient,
  compositeId: number
): Promise<{
  tokenIds: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null> {
  if (!publicClient) return null;

  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: PXNFT_ABI as Abi,
      functionName: "getCompositionInfo",
      args: [BigInt(compositeId)],
    }) as [bigint[], bigint, bigint, bigint, bigint];

    const [tokenIds, minX, minY, maxX, maxY] = result;

    return {
      tokenIds: tokenIds.map(id => Number(id)),
      minX: Number(minX),
      minY: Number(minY),
      maxX: Number(maxX),
      maxY: Number(maxY),
    };
  } catch (error) {
    console.error("Error getting composition info:", error);
    return null;
  }
}
