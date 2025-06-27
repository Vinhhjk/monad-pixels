'use client';
import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import { usePublicClient } from "wagmi";
import Link from 'next/link';
import Image from 'next/image';
import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Abi } from "viem";
const CONTRACT_ADDRESS = "0x1737AD0258085a8AC4259E5d42F3866fec873a0A";

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}
interface ReadContractWithGas {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  gas?: bigint;
}

// Separate component that uses useSearchParams
function NFTViewerContent() {
  const [tokenId, setTokenId] = useState<string>("");
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionAvatar, setCollectionAvatar] = useState<string>('');
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [showLargeCanvas, setShowLargeCanvas] = useState(false);
  const publicClient = usePublicClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenIdFromUrl = searchParams.get('tokenId');
    if (tokenIdFromUrl && publicClient) {
      setTokenId(tokenIdFromUrl);
      
      // Auto-fetch the NFT metadata immediately
      const autoFetch = async () => {
        setLoading(true);
        setError(null);
        setMetadata(null);
  
        try {
          const tokenURI = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: 'tokenURI',
            args: [BigInt(tokenIdFromUrl)],
          }) as string;
  
          console.log('Raw tokenURI:', tokenURI);
  
          // Decode the base64 JSON metadata
          const decodedMetadata = decodeBase64JSON(tokenURI);
          console.log('Decoded metadata:', decodedMetadata);
  
          setMetadata(decodedMetadata);
        } catch (err) {
          console.error('Error fetching NFT metadata:', err);
          setError('Failed to fetch NFT metadata. Token may not exist.');
        } finally {
          setLoading(false);
        }
      };
  
      autoFetch();
    }
  }, [searchParams, publicClient]);

  const decodeBase64JSON = (base64String: string): NFTMetadata => {
    // Remove the data:application/json;base64, prefix
    const base64Data = base64String.replace('data:application/json;base64,', '');
    // Decode base64
    const jsonString = atob(base64Data);
    // Parse JSON
    return JSON.parse(jsonString);
  };

  const fetchNFTMetadata = async () => {
    if (!publicClient || !tokenId) return;
    
    setLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const tokenURI = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      }) as string;

      console.log('Raw tokenURI:', tokenURI);

      // Decode the base64 JSON metadata
      const decodedMetadata = decodeBase64JSON(tokenURI);
      console.log('Decoded metadata:', decodedMetadata);

      setMetadata(decodedMetadata);
    } catch (err) {
      console.error('Error fetching NFT metadata:', err);
      setError('Failed to fetch NFT metadata. Token may not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNFTMetadata();
  };

  const getCoordinatesFromTokenId = (id: number) => {
    const x = id % 100; // Changed from 10 to 100 to match your canvas
    const y = Math.floor(id / 100);
    return { x, y };
  };

  const fetchCollectionAvatar = useCallback(async () => {
    if (!publicClient) return;
    
    setIsLoadingCollection(true);
    try {
      // TEST: Try direct RPC call first
      console.log('🧪 Testing direct RPC call...');
      
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://your-rpc-endpoint'; // Add your RPC URL
      console.log('RPC URL:', rpcUrl);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: CONTRACT_ADDRESS,
              data: '0xe8a3d485', // contractURI() function selector
              gas: '174876E800'
            },
            'latest'
          ],
          id: 1
        })
      });
  
      const rpcResult = await response.json();
      console.log('RPC Response:', rpcResult);
  
      if (rpcResult.result && rpcResult.result !== '0x') {
        // Decode the hex result
        const hexData = rpcResult.result.slice(2); // Remove 0x prefix
        const decodedHex = Buffer.from(hexData, 'hex').toString('utf8');
        console.log('Decoded hex:', decodedHex);
        
        // Extract the base64 JSON part
        const base64Match = decodedHex.match(/data:application\/json;base64,([A-Za-z0-9+/=]+)/);
        if (base64Match) {
          const base64Data = base64Match[1];
          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);
          console.log('Parsed metadata:', metadata);
          
          if (metadata.image) {
            setCollectionAvatar(metadata.image);
            console.log('✅ RPC method worked!');
            return;
          }
        }
      }
  
      throw new Error('RPC call succeeded but no valid data returned');
  
    } catch (rpcError) {
      console.error('❌ RPC method failed:', rpcError);
      
      // Fallback to your original publicClient method
      console.log('Falling back to original publicClient method...');
      try {
        const contractCall: ReadContractWithGas = {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI as Abi,
          functionName: 'contractURI',
          gas: BigInt(1000000000000000),
        };
  
        const contractURIResult = await publicClient.readContract(contractCall as Parameters<typeof publicClient.readContract>[0]) as string;        
        console.log('Contract URI result:', contractURIResult);
  
        // Decode the base64 JSON metadata
        const contractMetadata = decodeBase64JSON(contractURIResult);
        console.log('Contract metadata:', contractMetadata);
  
        if (contractMetadata.image) {
          setCollectionAvatar(contractMetadata.image);
          console.log('✅ PublicClient fallback worked');
          return;
        }
      } catch (contractURIError) {
        console.log('❌ contractURI failed', contractURIError);
      }
  
      // Final fallback - your original placeholder
      console.log('Using placeholder...');
      setCollectionAvatar('data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f0f0f0"/>
          <text x="50" y="45" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">Canvas</text>
          <text x="50" y="55" text-anchor="middle" font-family="Arial" font-size="6" fill="#666">Loading...</text>
        </svg>
      `));
  
    } finally {
      setIsLoadingCollection(false);
    }
  }, [publicClient]);
  

  // Add this useEffect after your existing useEffect
  useEffect(() => {
    if (publicClient) {
      fetchCollectionAvatar();
    }
  }, [publicClient, fetchCollectionAvatar]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">NFT Viewer</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="tokenId" className="block text-sm font-medium mb-2">
              Token ID
            </label>
            <input
              id="tokenId"
              type="number"
              min="0"
              max="10000"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter token ID (0-9999)"
            />
            <p className="text-xs text-gray-900 mt-1">
              Token IDs range from 0 to 9999
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !tokenId}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors"
          >
            {loading ? 'Loading...' : 'View NFT'}
          </button>
        </div>
      </form>

      {tokenId && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            Token ID {tokenId} corresponds to coordinates: 
            <span className="font-medium ml-1">
              ({getCoordinatesFromTokenId(parseInt(tokenId)).x}, {getCoordinatesFromTokenId(parseInt(tokenId)).y})
            </span>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {metadata && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">NFT Image</h2>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-center">
                  <Image
                    src={metadata.image}
                    alt={metadata.name}
                    width={192}
                    height={192}
                    className="w-48 h-48 border border-gray-300 rounded-lg shadow-sm"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>
              
              {/* Raw Image Data */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                  View raw image data
                </summary>
                <div className="mt-2 p-2 bg-gray-100 rounded border overflow-auto">
                  <code className="break-all text-gray-900">{metadata.image}</code>
                </div>
              </details>
            </div>

            {/* Metadata Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-700">NFT Details</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900">Name</label>
                  <p className="text-lg text-gray-900">{metadata.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <p className="text-gray-900">{metadata.description}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Attributes</label>
                  <div className="space-y-2">
                    {metadata.attributes.map((attr, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium text-sm text-gray-900">{attr.trait_type}:</span>
                        <span className="text-sm text-gray-900">
                          {attr.trait_type === 'Color' ? (
                            <div className="flex items-center gap-2">
                              <span>{attr.value}</span>
                              <div 
                                className="w-4 h-4 border border-gray-300 rounded"
                                style={{ backgroundColor: attr.value as string }}
                              ></div>
                            </div>
                          ) : (
                            attr.value
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Metadata */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <details>
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                View raw metadata JSON
              </summary>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg overflow-auto">
                <pre className="text-xs text-gray-900">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 space-y-6">
        {/* Collection Avatar Section */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
            🎨 Complete Collection&apos;s Image
          </h3>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {isLoadingCollection ? (
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="animate-spin text-lg">⚡</div>
                </div>
              ) : collectionAvatar ? (
                <Image
                  src={collectionAvatar}
                  alt="Complete Canvas"
                  width={96}
                  height={96}
                  className="w-24 h-24 border border-gray-300 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ imageRendering: 'pixelated' }}
                  onClick={() => setShowLargeCanvas(true)}
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 text-xs">No canvas</span>
                </div>
              )}
            </div>
            <div className="flex-1 text-sm text-purple-800">
              <p className="mb-2">A collaborative 100×100 canvas where each pixel is an individual NFT.</p>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href="/"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs transition-colors"
                >
                  🎨 View Full Canvas
                </Link>
                <button
                  onClick={fetchCollectionAvatar}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-xs transition-colors"
                  disabled={isLoadingCollection}
                >
                  🔄 Refresh
                </button>
                {collectionAvatar && (
                  <button
                    onClick={() => setShowLargeCanvas(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    🔍 View Collection Image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">How to use:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Enter a token ID to view the corresponding pixel NFT</li>
            <li>• The image is generated as an SVG and encoded in base64</li>
            <li>• Each pixel corresponds to coordinates on a 100x100 grid</li>
            <li>• Token ID formula: tokenId = y * 100 + x</li>
          </ul>
        </div>
      </div>

      {/* Large Canvas Modal */}
      {showLargeCanvas && collectionAvatar && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Complete Canvas Collection</h3>
              <button
                onClick={() => setShowLargeCanvas(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex justify-center">
              <Image
                src={collectionAvatar}
                alt="Complete Canvas - Large View"
                width={600}
                height={600}
                className="max-w-full h-auto border border-gray-300 rounded-lg"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 mb-3">
                Complete collaborative canvas showing all minted pixels
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setShowLargeCanvas(false)}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Close
                </button>
                <Link
                  href="/"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  🎨 Go to Canvas
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loading fallback component
function NFTViewerLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="h-20 bg-gray-200 rounded mb-6"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}

// Main component with Suspense wrapper
export default function NFTViewer() {
  return (
    <Suspense fallback={<NFTViewerLoading />}>
      <NFTViewerContent />
    </Suspense>
  );
}

