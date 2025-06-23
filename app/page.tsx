'use client';
import { useState, useEffect, useCallback } from "react";
import { useWriteContract, usePublicClient, useWatchContractEvent } from "wagmi";
import { useAppKitAccount } from '@reown/appkit/react';
import ConnectButton from "@/components/ConnectButton";
import PXNFT_ABI from "@/contractABI/PXNFT.json";

const WIDTH = 10;
const HEIGHT = 10;
const CONTRACT_ADDRESS = "0xEE42825Ab7E79cf2a10A69319C45850131478CD8";

interface PixelData {
  color: string;
  owner: string | null;
  isMinted: boolean;
}

interface TransferEventArgs {
  from: string;
  to: string;
  tokenId: bigint;
}

interface ColorUpdatedEventArgs {
  tokenId: bigint;
  x: bigint;
  y: bigint;
  color: string;
  owner: string;
}

interface ContractEventLog {
  args?: unknown;
}

export default function Home() {
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [selectedPixel, setSelectedPixel] = useState<[number, number] | null>(null);
  const [pixelData, setPixelData] = useState<{ [key: string]: PixelData }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const { address, isConnected } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Predefined color palette like r/place
  const colorPalette = [
    '#ffffff', '#e4e4e4', '#888888', '#222222',
    '#ffa7d1', '#e50000', '#e59500', '#a06a42',
    '#e5d900', '#94e044', '#02be01', '#00d3dd',
    '#0083c7', '#0000ea', '#cf6ee4', '#820080'
  ];

  const getTokenId = (x: number, y: number) => y * WIDTH + x;

  const getCoordinatesFromTokenId = (tokenId: number) => {
    const x = tokenId % WIDTH;
    const y = Math.floor(tokenId / WIDTH);
    return { x, y };
  };

  // Listen for Transfer events (minting)
  useWatchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: PXNFT_ABI,
    eventName: 'Transfer',
    onLogs(logs) {
      console.log('Transfer event detected:', logs);
      logs.forEach(async (log) => {
        const logArgs = (log as ContractEventLog).args as TransferEventArgs | undefined;
        if (!logArgs) return;
        
        const { from, to, tokenId } = logArgs;
        
        if (from === '0x0000000000000000000000000000000000000000') {
          const tokenIdNumber = Number(tokenId);
          const { x, y } = getCoordinatesFromTokenId(tokenIdNumber);
          
          if (publicClient) {
            try {
              const color = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: 'getColor',
                args: [BigInt(x), BigInt(y)],
              }) as string;

              const key = `${x}-${y}`;
              setPixelData(prev => ({
                ...prev,
                [key]: {
                  color: color || '#ffffff',
                  owner: to,
                  isMinted: true,
                }
              }));
            } catch (error) {
              console.error('Error fetching color for newly minted pixel:', error);
            }
          }
        }
      });
    },
  });

  // Listen for ColorUpdated events
  useWatchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: PXNFT_ABI,
    eventName: 'ColorUpdated',
    onLogs(logs) {
      console.log('ColorUpdated event detected:', logs);
      logs.forEach((log) => {
        const logArgs = (log as ContractEventLog).args as ColorUpdatedEventArgs | undefined;
        
        if (!logArgs) return;
        
        const { x, y, color, owner } = logArgs;
        
        const xNum = Number(x);
        const yNum = Number(y);
        const key = `${xNum}-${yNum}`;
        
        setPixelData(prev => ({
          ...prev,
          [key]: {
            color: color,
            owner: owner,
            isMinted: true,
          }
        }));
      });
    },
  });

  const fetchPixelData = useCallback(async () => {
    if (!publicClient) return;
    
    setIsLoading(true);
    const newPixelData: { [key: string]: PixelData } = {};

    try {
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const tokenId = getTokenId(x, y);
          const key = `${x}-${y}`;

          try {
            const owner = await publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            }) as string;

            const color = await publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: 'getColor',
              args: [BigInt(x), BigInt(y)],
            }) as string;

            newPixelData[key] = {
              color: color || '#ffffff',
              owner,
              isMinted: true,
            };
          } catch {
            newPixelData[key] = {
              color: '#ffffff',
              owner: null,
              isMinted: false,
            };
          }
        }
      }

      setPixelData(newPixelData);
    } catch (error) {
      console.error('Error fetching pixel data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchPixelData();
  }, [fetchPixelData]);

  const mintPixel = async (x: number, y: number) => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "mint",
        args: [BigInt(x), BigInt(y), selectedColor],
      });
    } catch (error) {
      console.error("Error minting pixel:", error);
    }
  };

  const updatePixel = async (x: number, y: number) => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "updateColor",
        args: [BigInt(x), BigInt(y), selectedColor],
      });
    } catch (error) {
      console.error("Error updating pixel:", error);
    }
  };

  const handleClick = (x: number, y: number) => {
    setSelectedPixel([x, y]);
  };

  const getPixelColor = (x: number, y: number) => {
    const key = `${x}-${y}`;
    const pixel = pixelData[key];
    
    if (selectedPixel?.[0] === x && selectedPixel?.[1] === y && showSidebar) {
      return selectedColor;
    }
    
    return pixel?.isMinted ? pixel.color : '#ffffff';
  };

  const isPixelMinted = (x: number, y: number) => {
    const key = `${x}-${y}`;
    return pixelData[key]?.isMinted || false;
  };

  const getPixelOwner = (x: number, y: number) => {
    const key = `${x}-${y}`;
    return pixelData[key]?.owner;
  };

  const canUpdatePixel = (x: number, y: number) => {
    if (!isConnected || !address) return false;
    const owner = getPixelOwner(x, y);
    return owner && owner.toLowerCase() === address.toLowerCase();
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-800 relative">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gray-900 bg-opacity-90 backdrop-blur-sm z-10 px-3 sm:px-6 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-700 gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <h1 className="text-lg sm:text-2xl font-bold text-white">🎨 Pixel NFT Canvas</h1>
            <div className="text-xs sm:text-sm text-gray-300 hidden sm:block">
              100 pixels • {Object.values(pixelData).filter(p => p.isMinted).length} minted
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <button 
              onClick={fetchPixelData}
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2"
              disabled={isLoading}
            >
              <span className={isLoading ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
            >
              <span className="sm:hidden">{showSidebar ? '🎨' : '🎨'}</span>
              <span className="hidden sm:inline">{showSidebar ? '🎨 Hide Tools' : '🎨 Show Tools'}</span>
            </button>
            <ConnectButton />
          </div>
          {/* Mobile stats */}
          <div className="text-xs text-gray-300 sm:hidden w-full">
            100 pixels • {Object.values(pixelData).filter(p => p.isMinted).length} minted
          </div>
        </div>


        {/* Canvas */}
        <div className="mt-20 sm:mt-16 mb-8">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-20">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⚡</div>
                <p className="text-xl">Loading pixel data...</p>
              </div>
            </div>
          )}

          <div 
            className="grid gap-1 p-4 bg-gray-700 rounded-xl shadow-2xl"
            style={{ 
              gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))`,
              maxWidth: '80vh',
              maxHeight: '80vh'
            }}
          >
            {[...Array(WIDTH * HEIGHT)].map((_, i) => {
              const x = i % WIDTH;
              const y = Math.floor(i / WIDTH);
              const isSelected = selectedPixel?.[0] === x && selectedPixel?.[1] === y;
              const isMinted = isPixelMinted(x, y);
              const pixelColor = getPixelColor(x, y);
              
              return (
                <div
                  key={i}
                  onClick={() => handleClick(x, y)}
                  className={`aspect-square border cursor-crosshair relative transition-all duration-150 hover:scale-110 hover:z-10 ${
                    isSelected ? "border-yellow-400 border-2 ring-2 ring-yellow-400 ring-opacity-50" : "border-gray-600"
                  } ${isMinted ? "ring-1 ring-blue-400" : ""}`}
                  style={{ 
                    backgroundColor: pixelColor,
                    minWidth: '8vh',
                    minHeight: '8vh'
                  }}
                  title={`Pixel (${x}, ${y}) ${isMinted ? '- Minted' : '- Available'}`}
                >
                  {isMinted && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full border border-gray-700"></div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-yellow-400 bg-opacity-20 animate-pulse"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
      <div className="fixed sm:relative top-0 right-0 w-full sm:w-80 h-full bg-gray-900 border-l border-gray-700 flex flex-col z-30 sm:z-auto">          
          <div className="sm:hidden p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Tools</h2>
            <button 
              onClick={() => setShowSidebar(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          {/* Color Palette */}
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold mb-4">🎨 Color Palette</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    selectedColor === color 
                      ? "border-yellow-400 scale-110 shadow-lg" 
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Custom:</label>
              <input 
                type="color" 
                value={selectedColor} 
                onChange={e => setSelectedColor(e.target.value)}
                className="w-12 h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Selected Pixel Info */}
          {selectedPixel && (
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold mb-4">
                📍 Pixel ({selectedPixel[0]}, {selectedPixel[1]})
              </h3>
              
              <div className="space-y-3">
                {isPixelMinted(selectedPixel[0], selectedPixel[1]) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      <span className="text-blue-400 font-medium">Minted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Color:</span>
                      <div 
                        className="w-6 h-6 border border-gray-600 rounded"
                        style={{ backgroundColor: pixelData[`${selectedPixel[0]}-${selectedPixel[1]}`]?.color }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                    <span className="text-gray-400">Available</span>
                  </div>
                )}

                {isConnected ? (
                  <div className="pt-2">
                    {!isPixelMinted(selectedPixel[0], selectedPixel[1]) ? (
                      <button 
                        className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                        onClick={() => mintPixel(...selectedPixel)}
                      >
                        <span>⚡</span>
                        Mint Pixel
                      </button>
                    ) : canUpdatePixel(selectedPixel[0], selectedPixel[1]) ? (
                      <button 
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                        onClick={() => updatePixel(...selectedPixel)}
                      >
                        <span>🎨</span>
                        Update Color
                      </button>
                    ) : (
                      <div className="text-center p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                        <p className="text-red-400 text-sm">You don&lsquo;t own this pixel</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg">
                    <p className="text-yellow-400 text-sm text-center">Connect wallet to interact</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="flex-1 p-6 text-sm text-gray-400 space-y-2">
            <h3 className="text-white font-semibold mb-3">📖 How to Play</h3>
            <p>• Click any pixel to select it</p>
            <p>• Choose a color from the palette</p>
            <p>• Mint unminted pixels to claim them</p>
            <p>• Update colors of pixels you own</p>
            <p>• Watch as others create art in real-time!</p>
            
            <div className="pt-4 border-t border-gray-700 mt-4">
              <p className="text-xs">
                <span className="text-blue-400">●</span> Blue dots = Minted pixels<br/>
                <span className="text-yellow-400">●</span> Yellow border = Selected pixel
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}