'use client';
import { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { usePublicClient } from "wagmi";
import PXNFT_ABI from "@/contractABI/PXNFT.json";

const CONTRACT_ADDRESS = "0x09D2AB8E374dA70754341E9a120022d8DDbCa91a";

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export default function NFTViewer() {
  const [tokenId, setTokenId] = useState<string>("");
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const x = id % 10; // WIDTH = 10
    const y = Math.floor(id / 10);
    return { x, y };
  };

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
              placeholder="Enter token ID (0-99)"
            />
            <p className="text-xs text-gray-900 mt-1">
              Token IDs
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
                  <img
                    src={metadata.image}
                    alt={metadata.name}
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
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">How to use:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Enter a token ID to view the corresponding pixel NFT</li>
          <li>• The image is generated as an SVG and encoded in base64</li>
          <li>• Each pixel corresponds to coordinates on a 100x100 grid</li>
          <li>• Token ID formula: tokenId = y * 100 + x</li>
        </ul>
      </div>
    </div>
  );
}
