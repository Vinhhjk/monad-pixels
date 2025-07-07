'use client';
import { useState, useEffect, useCallback, useMemo } from "react";
import { useWriteContract, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { useAppKitAccount } from '@reown/appkit/react';
import ConnectButton from "@/components/ConnectButton";
import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Log } from "viem";
const CANVAS_WIDTH = 100; // Total canvas size (100x100 = 10,000 pixels)
const CANVAS_HEIGHT = 100;
const MIN_VIEWPORT_SIZE = 10; // Minimum zoom (most zoomed in)
const MAX_VIEWPORT_SIZE =80; // Maximum zoom (most zoomed out)
const PIXEL_SIZE = 8; // Base pixel size in pixels

const CONTRACT_ADDRESS = "0x408226e2F9AabbEf2F71DA1C744e40f0C2cF0F56";

interface PixelData {
  color: string;
  owner: string | null;
  isMinted: boolean;
}



interface WindowWithFallback extends Window {
  clearPixelFallback?: () => void;
}

declare const window: WindowWithFallback;

export default function Home() {
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [selectedPixel, setSelectedPixel] = useState<[number, number] | null>(null);
  const [pixelData, setPixelData] = useState<{ [key: string]: PixelData }>({});
  const [isLoading] = useState(false);  
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadedChunks, setLoadedChunks] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewportX, setViewportX] = useState(0); // Top-left corner of viewport
  const [viewportY, setViewportY] = useState(0);
  const [viewportSize, setViewportSize] = useState(MIN_VIEWPORT_SIZE); // Current zoom level
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showPositionInput, setShowPositionInput] = useState(false);
  const [customHexColor, setCustomHexColor] = useState('');
  const [showHexInput, setShowHexInput] = useState(false);
  const [positionX, setPositionX] = useState('');
  const [positionY, setPositionY] = useState('');

  const [eventWatcher, setEventWatcher] = useState<(() => void) | null>(null);
  // State to track pending transactions
  const [loadingChunks, setLoadingChunks] = useState<Set<string>>(new Set());
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [pendingMints, setPendingMints] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  
  // Track transaction hashes and the pixel being processed
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(null);
  const [pendingTxPixel, setPendingTxPixel] = useState<[number, number] | null>(null);
  const [pendingTxType, setPendingTxType] = useState<'mint' | 'update' | null>(null);
  const [eventWatchingEnabled, setEventWatchingEnabled] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawnPixels, setDrawnPixels] = useState<Map<string, string>>(new Map());  
  const [isBatchMinting, setIsBatchMinting] = useState(false);
  const [highlightedPixel, setHighlightedPixel] = useState<[number, number] | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);

  const { address, isConnected } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [sidebarPosition, setSidebarPosition] = useState({ x: 0, y: 64 }); // Start at top-right, below header
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarDragStart, setSidebarDragStart] = useState({ x: 0, y: 0 });
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });


  useEffect(() => {
    setSidebarPosition({ x: window.innerWidth - 320, y: 64 });
  }, []);
  useEffect(() => {
    const handleResize = () => {
      const sidebarWidth = Math.min(320, window.innerWidth * 0.9);
      const maxX = window.innerWidth - sidebarWidth;
      const maxY = window.innerHeight - 200;
      
      setSidebarPosition(prev => ({
        x: Math.max(0, Math.min(maxX, prev.x)), // Keep within bounds
        y: Math.max(64, Math.min(maxY, prev.y)) // Keep within bounds
      }));
    };
  
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const handleSidebarDragStart = (e: React.MouseEvent) => {
    setIsDraggingSidebar(true);
    setSidebarDragStart({
      x: e.clientX - sidebarPosition.x,
      y: e.clientY - sidebarPosition.y
    });
    e.preventDefault();
  };

  const handleSidebarDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingSidebar) return;
    
    let clientX, clientY;
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const newX = clientX - sidebarDragStart.x;
    const newY = clientY - sidebarDragStart.y;
    
    const sidebarWidth = Math.min(320, window.innerWidth * 0.9);
    const maxX = window.innerWidth - sidebarWidth;
    const maxY = window.innerHeight - 200;
    
    setSidebarPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(64, Math.min(maxY, newY))
    });
  }, [isDraggingSidebar, sidebarDragStart]);
  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDraggingSidebar(true);
    setSidebarDragStart({
      x: touch.clientX - sidebarPosition.x,
      y: touch.clientY - sidebarPosition.y
    });
    e.preventDefault();
  };
  
  const handleSidebarDragEnd = useCallback(() => {
    setIsDraggingSidebar(false);
  }, []);
  useEffect(() => {
    if (isDraggingSidebar) {
      document.addEventListener('mousemove', handleSidebarDragMove);
      document.addEventListener('mouseup', handleSidebarDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleSidebarDragMove);
        document.removeEventListener('mouseup', handleSidebarDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);
  useEffect(() => {
    if (isDraggingSidebar) {
      const handleMove = (e: Event) => handleSidebarDragMove(e as MouseEvent | TouchEvent);
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleSidebarDragEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleSidebarDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleSidebarDragEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleSidebarDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);
  
  useEffect(() => {
    if (isDraggingSidebar) {
      const handleMove = (e: Event) => handleSidebarDragMove(e as MouseEvent | TouchEvent);
      
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleSidebarDragEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleSidebarDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleSidebarDragEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleSidebarDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);
  
  const fetchTotalMinted = useCallback(async () => {
    if (!publicClient) return;
    
    try {
      const total = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: 'totalMinted',
      }) as bigint;
      
      setTotalMinted(Number(total));
    } catch (error) {
      console.error('Error fetching total minted:', error);
    }
  }, [publicClient]);
  useEffect(() => {
    if (publicClient) {
      fetchTotalMinted();
    }
  }, [publicClient, fetchTotalMinted])
  // Watch for transaction receipt
  const { data: txReceipt, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: pendingTxHash || undefined,
  });

  // Move utility functions outside of useEffect to avoid dependency issues
  const getTokenId = useCallback((x: number, y: number) => y * CANVAS_WIDTH + x, []);

  const getCoordinatesFromTokenId = useCallback((tokenId: number) => {
    const x = tokenId % CANVAS_WIDTH;
    const y = Math.floor(tokenId / CANVAS_WIDTH);
    return { x, y };
  }, []);

  // Handle successful transaction with fallback
  useEffect(() => {
    if (isTxSuccess && txReceipt && pendingTxHash && pendingTxPixel) {
      console.log('Transaction confirmed:', txReceipt);
      
      const [x, y] = pendingTxPixel;
      const key = `${x}-${y}`;
      
      // Clear the pending transaction state
      setPendingTxHash(null);
      setPendingTxPixel(null);
      
      // Fallback: If event listeners don't work, manually update after a delay
      const fallbackTimeout = setTimeout(async () => {
        console.log(`Fallback: Manually updating pixel (${x}, ${y}) after transaction confirmation`);
        
        // Clear pending states
        if (pendingTxType === 'mint') {
          setPendingMints(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            console.log(`Fallback: Removed ${key} from pending mints`);
            return newSet;
          });
        } else if (pendingTxType === 'update') {
          setPendingUpdates(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            console.log(`Fallback: Removed ${key} from pending updates`);
            return newSet;
          });
        }
        
        // Manually fetch and update the pixel data
        if (publicClient) {
          try {
            const tokenId = getTokenId(x, y);
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

            setPixelData(prev => ({
              ...prev,
              [key]: {
                color: color || '#ffffff',
                owner,
                isMinted: true,
              }
            }));
            
            console.log(`Fallback: Updated pixel (${x}, ${y}) with color ${color} and owner ${owner}`);
          } catch (error) {
            console.error('Fallback: Error fetching pixel data:', error);
          }
        }
        await fetchTotalMinted();

      }, 2000); // 2 second delay to give event listeners a chance
      
      // Clear the fallback timeout if events work properly
      const clearFallback = () => {
        clearTimeout(fallbackTimeout);
        console.log('Event listeners worked, cancelled fallback');
      };
      
      // Store the clear function to be called by event listeners
      window.clearPixelFallback = clearFallback;

      // Clear transaction type
      setPendingTxType(null);
    }
  }, [isTxSuccess, txReceipt, pendingTxHash, pendingTxPixel, pendingTxType, publicClient, getTokenId, fetchTotalMinted]);
  const memoizedPixelGrid = useMemo(() => {
    // Allow viewport to show the full canvas - don't constrain here
    const actualViewportX = Math.max(0, Math.min(CANVAS_WIDTH - 1, viewportX));
    const actualViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, viewportY));
    
    return [...Array(viewportSize * viewportSize)].map((_, i) => {
      const localX = i % viewportSize;
      const localY = Math.floor(i / viewportSize);
      const globalX = actualViewportX + localX;
      const globalY = actualViewportY + localY;
      
      return { i, globalX, globalY };
    });
  }, [viewportSize, viewportX, viewportY]);

  // Predefined color palette like r/place
  const colorPalette = [
    '#ffffff', '#e4e4e4', '#888888', '#222222',
    '#ffa7d1', '#e50000', '#e59500', '#a06a42',
    '#e5d900', '#94e044', '#02be01', '#00d3dd',
    '#0083c7', '#0000ea', '#cf6ee4', '#820080'
  ];
  const applyHexColor = () => {
    // Validate hex color format
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexRegex.test(customHexColor)) {
      setSelectedColor(customHexColor);
      setCustomHexColor('');
      setShowHexInput(false);
    } else {
      alert('Please enter a valid hex color (e.g., #FF0000 or #F00)');
    }
  };
  const handleHexKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyHexColor();
    } else if (e.key === 'Escape') {
      setCustomHexColor('');
      setShowHexInput(false);
    }
  };

  // Listen for Transfer events (minting) - Fixed typing
  useEffect(() => {
    if (!eventWatchingEnabled || !isConnected || !publicClient) return;
  
    let isActive = true;
    
    const watchEvents = async () => {
      try {
        // Use a more specific event filter
        const unwatch = publicClient.watchContractEvent({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          eventName: 'Transfer',
          args: {
            from: '0x0000000000000000000000000000000000000000' // Only watch mint events
          },
          onLogs: (logs) => {
            if (!isActive) return;
            
            console.log('Transfer event detected:', logs);
            
            if (window.clearPixelFallback) {
              window.clearPixelFallback();
              window.clearPixelFallback = undefined;
            }
            
            logs.forEach(async (log: Log & { args?: { from: string; to: string; tokenId: bigint } }) => {
              const { args } = log;
              if (!args) return;
              
              const { from, to, tokenId } = args;
              
              // Only process mint events (from zero address)
              if (from === '0x0000000000000000000000000000000000000000') {
                const tokenIdNumber = Number(tokenId);
                const { x, y } = getCoordinatesFromTokenId(tokenIdNumber);
                const key = `${x}-${y}`;
                
                console.log(`Mint confirmed for pixel (${x}, ${y}), owner: ${to}`);
                
                // Update total minted count
                setTotalMinted(prev => prev + 1);
                
                // Remove from pending mints
                setPendingMints(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });
                
                // Fetch and update pixel data
                try {
                  const color = await publicClient.readContract({
                    address: CONTRACT_ADDRESS as `0x${string}`,
                    abi: PXNFT_ABI,
                    functionName: 'getColor',
                    args: [BigInt(x), BigInt(y)],
                  }) as string;
  
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
            });
          },
          onError: (error) => {
            console.log('Event watching failed:', error);
            setEventWatchingEnabled(false);
          }
        });
        
        setEventWatcher(unwatch);
        
      } catch (error) {
        console.error('Failed to setup event watcher:', error);
        setEventWatchingEnabled(false);
      }
    };
  
    watchEvents();
  
    return () => {
      isActive = false;
      if (eventWatcher) {
        eventWatcher();
        setEventWatcher(null);
      }
    };
  }, [eventWatchingEnabled, isConnected, publicClient, getCoordinatesFromTokenId,eventWatcher]);
  useEffect(() => {
    if (!eventWatchingEnabled || !isConnected || !publicClient) return;

    let isActive = true;
    
    const watchColorEvents = async () => {
      try {
        const unwatch = publicClient.watchContractEvent({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          eventName: 'ColorUpdated',
          onLogs: (logs: (Log & { args?: { tokenId: bigint; x: bigint; y: bigint; color: string; owner: string } })[]) => {
            if (!isActive) return;
            
            console.log('ColorUpdated event detected:', logs);
            
            logs.forEach((log: Log & { args?: { tokenId: bigint; x: bigint; y: bigint; color: string; owner: string } }) => {
              const { args } = log;
              if (!args) return;
              
              const { x, y, color, owner } = args; // Remove tokenId since it's not used
              const pixelX = Number(x);
              const pixelY = Number(y);
              const key = `${pixelX}-${pixelY}`;
              
              console.log(`Color updated for pixel (${pixelX}, ${pixelY}), color: ${color}, owner: ${owner}`);
              
              // Update pixel data immediately
              setPixelData(prev => ({
                ...prev,
                [key]: {
                  color: color,
                  owner: owner,
                  isMinted: true,
                }
              }));
              
              // Remove from pending states
              setPendingMints(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
              });
              
              setPendingUpdates(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
              });
            });
            
            // Update total minted count
            fetchTotalMinted();
          },
          onError: (error) => {
            console.log('ColorUpdated event watching failed:', error);
          }
        });
        
        return unwatch;
        
      } catch (error) {
        console.error('Failed to setup ColorUpdated event watcher:', error);
      }
    };

    const cleanup = watchColorEvents();
    
    return () => {
      isActive = false;
      cleanup?.then(unwatch => unwatch?.());
    };
  }, [eventWatchingEnabled, isConnected, publicClient, fetchTotalMinted]);


  const loadVisiblePixels = useCallback(async () => {
    if (!publicClient || isLoadingChunks) return;
    
    setIsLoadingChunks(true);
    
    try {
      // Reduce buffer significantly for initial load, increase for subsequent loads
      const buffer = isInitialLoad ? 5 : 15; // Much smaller initial buffer
      const startX = Math.max(0, viewportX - buffer);
      const startY = Math.max(0, viewportY - buffer);
      const endX = Math.min(CANVAS_WIDTH - 1, viewportX + viewportSize + buffer);
      const endY = Math.min(CANVAS_HEIGHT - 1, viewportY + viewportSize + buffer);
      
      const chunkSize = 5;
      const chunksToLoad: Array<{x: number, y: number, endX: number, endY: number, key: string, priority: number}> = [];
      
      // Calculate chunks with priority (center chunks load first)
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;
      
      for (let y = startY; y < endY; y += chunkSize) {
        for (let x = startX; x < endX; x += chunkSize) {
          const chunkEndX = Math.min(Math.floor(x + chunkSize - 1), Math.floor(endX));
          const chunkEndY = Math.min(Math.floor(y + chunkSize - 1), Math.floor(endY));
          const chunkKey = `${x}-${y}-${chunkEndX}-${chunkEndY}`;
          
          if (!loadedChunks.has(chunkKey) && !loadingChunks.has(chunkKey)) {
            // Calculate distance from center for priority
            const chunkCenterX = x + (chunkEndX - x) / 2;
            const chunkCenterY = y + (chunkEndY - y) / 2;
            const distance = Math.sqrt(
              Math.pow(chunkCenterX - centerX, 2) + Math.pow(chunkCenterY - centerY, 2)
            );
            
            chunksToLoad.push({ 
              x: Math.floor(x), 
              y: Math.floor(y), 
              endX: chunkEndX, 
              endY: chunkEndY, 
              key: chunkKey,
              priority: distance
            });
          }
        }
      }
      
      // Sort by priority (closest to center first)
      chunksToLoad.sort((a, b) => a.priority - b.priority);
      
      // Limit concurrent loading for initial load
      const maxConcurrentChunks = isInitialLoad ? 3 : 5;
      const batchSize = Math.min(maxConcurrentChunks, chunksToLoad.length);
      setLoadingProgress({ current: 0, total: chunksToLoad.length });
      // Load in batches
      for (let i = 0; i < chunksToLoad.length; i += batchSize) {
        const batch = chunksToLoad.slice(i, i + batchSize);
        
        // Load batch concurrently
        await Promise.all(batch.map(async (chunk) => {
          setLoadingChunks(prev => new Set(prev).add(chunk.key));
          
          try {
            // console.log(`Loading chunk (${chunk.x},${chunk.y}) to (${chunk.endX},${chunk.endY})`);
            
            if (chunk.x >= CANVAS_WIDTH || chunk.y >= CANVAS_HEIGHT || 
                chunk.endX >= CANVAS_WIDTH || chunk.endY >= CANVAS_HEIGHT) {
              return;
            }
            
            const result = await publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: 'getMintedPixelsInRange',
              args: [BigInt(chunk.x), BigInt(chunk.y), BigInt(chunk.endX), BigInt(chunk.endY)],
            });
            
            const [tokenIds, owners, colors] = result as [bigint[], string[], string[]];
            
            setPixelData(prev => {
              const newData = { ...prev };
              tokenIds.forEach((tokenId, index) => {
                const tokenIdNum = Number(tokenId);
                const pixelX = tokenIdNum % CANVAS_WIDTH;
                const pixelY = Math.floor(tokenIdNum / CANVAS_WIDTH);
                const key = `${pixelX}-${pixelY}`;
                
                newData[key] = {
                  color: colors[index],
                  owner: owners[index],
                  isMinted: true,
                };
              });
              return newData;
            });
            
            setLoadedChunks(prev => new Set(prev).add(chunk.key));
            
          } catch (chunkError) {
            console.error(`Error loading chunk (${chunk.x},${chunk.y}):`, chunkError);
          } finally {
            setLoadingChunks(prev => {
              const newSet = new Set(prev);
              newSet.delete(chunk.key);
              return newSet;
            });
              // ADD THIS:
            setLoadingProgress(prev => ({ 
              current: prev.current + 1, 
              total: prev.total 
            }));
          }
        }));
        
        // Add delay between batches, shorter for initial load
        const delay = isInitialLoad ? 100 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error('Error loading visible pixels:', error);
    } finally {
      setIsLoadingChunks(false);
      setIsInitialLoad(false);
    }
  }, [publicClient, viewportX, viewportY, viewportSize, isInitialLoad, isLoadingChunks,loadedChunks,loadingChunks]);
  
  
  // Load pixels when viewport changes
  useEffect(() => {
    if (publicClient && !isLoadingChunks) {
      const debounceTimer = setTimeout(() => {
        loadVisiblePixels();
      }, 300); // Debounce viewport changes
      
      return () => clearTimeout(debounceTimer);
    }
  }, [publicClient, viewportX, viewportY, viewportSize,isLoadingChunks,loadVisiblePixels]);
  
  // Initial load - just load current viewport
  useEffect(() => {
    if (publicClient && isInitialLoad) {
      loadVisiblePixels();
    }
  }, [publicClient, isInitialLoad, loadVisiblePixels]);
  

// Update your pixel checking functions:
const isPixelMinted = (x: number, y: number) => {
  const key = `${x}-${y}`;
  return pixelData[key]?.isMinted || false;
};

const getPixelColor = (x: number, y: number) => {
  const key = `${x}-${y}`;
  const pixel = pixelData[key];
  
  // If pixel exists in our data, it's minted - use its color
  if (pixel?.isMinted) {
    return pixel.color;
  }
  
  // Handle draw mode and selection preview for unminted pixels
  if (isDrawMode && drawnPixels.has(key)) {
    return drawnPixels.get(key) || selectedColor;
  }
  
  if (!isDrawMode && selectedPixel?.[0] === x && selectedPixel?.[1] === y) {
    return selectedColor;
  }
  
  // Default: unminted pixels are white
  return '#ffffff';
};

const getPixelOwner = (x: number, y: number) => {
  const key = `${x}-${y}`;
  return pixelData[key]?.owner || null;
};
  useEffect(() => {
    if (publicClient) {
      loadVisiblePixels();
    }
  }, [publicClient, loadVisiblePixels]);
  

  // Enable event watching after initial load
  useEffect(() => {
    if (isConnected && publicClient) {
      const timer = setTimeout(() => {
        setEventWatchingEnabled(true);
      }, 2000); // Increased delay to 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, publicClient]);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    const newSize = Math.max(MIN_VIEWPORT_SIZE, viewportSize - 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;
      
      // Don't over-constrain - allow viewing edge pixels
      const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - 1, centerX - newSize / 2));
      const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, centerY - newSize / 2));
      
      setViewportX(Math.floor(newViewportX));
      setViewportY(Math.floor(newViewportY));
    }
  }, [viewportSize, viewportX, viewportY]);
  
  const handleZoomOut = useCallback(() => {
    const newSize = Math.min(MAX_VIEWPORT_SIZE, viewportSize + 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;
      
      let newViewportX = centerX - newSize / 2;
      let newViewportY = centerY - newSize / 2;
      
      // Only constrain to prevent negative values, allow viewing full canvas
      newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - 1, newViewportX));
      newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, newViewportY));
      
      setViewportX(Math.floor(newViewportX));
      setViewportY(Math.floor(newViewportY));
    }
  }, [viewportSize, viewportX, viewportY]);
  

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // More sensitive zoom detection
    if (e.deltaY < -10) { // Scroll up = zoom in
      handleZoomIn();
    } else if (e.deltaY > 10) { // Scroll down = zoom out
      handleZoomOut();
    }
    
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000);
    }
  }, [hasInteracted, handleZoomIn, handleZoomOut]);
  // Mouse handlers with reduced sensitivity
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000); // Hide after 1 second
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    const movementThreshold = PIXEL_SIZE * 2;
    
    if (Math.abs(deltaX) < movementThreshold && Math.abs(deltaY) < movementThreshold) {
      return;
    }
    
    // Allow full canvas navigation - only constrain to prevent going negative
    const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - 1, 
      Math.floor(viewportX - deltaX / PIXEL_SIZE)));
    const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, 
      Math.floor(viewportY - deltaY / PIXEL_SIZE)));
    
    if (newViewportX !== viewportX || newViewportY !== viewportY) {
      setViewportX(newViewportX);
      setViewportY(newViewportY);
    }
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handlePixelClick = (e: React.MouseEvent, x: number, y: number) => {
    e.stopPropagation();
    
    if (isDrawMode) {
      const key = `${x}-${y}`;
      if (drawnPixels.has(key)) {
        removePixelFromDrawing(x, y);
      } else {
        addPixelToDrawing(x, y);
      }
    } else {
      setSelectedPixel([x, y]);
    }
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setLastMousePos({ x: touch.clientX, y: touch.clientY });
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000);
    }
  };

  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastMousePos.x;
    const deltaY = touch.clientY - lastMousePos.y;
    
    const movementThreshold = PIXEL_SIZE * 2;
    
    if (Math.abs(deltaX) < movementThreshold && Math.abs(deltaY) < movementThreshold) {
      return;
    }
    
    // Allow full canvas navigation
    const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - 1, 
      viewportX - Math.floor(deltaX / PIXEL_SIZE)));
    const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - 1, 
      viewportY - Math.floor(deltaY / PIXEL_SIZE)));
    
    if (newViewportX !== viewportX || newViewportY !== viewportY) {
      setViewportX(newViewportX);
      setViewportY(newViewportY);
    }
    
    setLastMousePos({ x: touch.clientX, y: touch.clientY });
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  const mintPixel = async (x: number, y: number) => {
    if (!isConnected || !address) return;
    
    // Add color validation
    if (!selectedColor || selectedColor === '') {
      alert('Please select a color before minting!');
      return;
    }
    
    const key = `${x}-${y}`;
    
    try {
      setIsMinting(true);
      
      // Add to pending mints
      setPendingMints(prev => {
        const newSet = new Set(prev).add(key);
        console.log(`Added ${key} to pending mints with color ${selectedColor}`);
        return newSet;
      });

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "mint",
        args: [BigInt(x), BigInt(y), selectedColor],
      });

      console.log("Mint transaction submitted:", txHash, "with color:", selectedColor);
      
      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType('mint');
      
    } catch (error) {
      console.error("Error minting pixel:", error);
      
      // Remove from pending mints on error
      setPendingMints(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        console.log(`Removed ${key} from pending mints due to error`);
        return newSet;
      });
    } finally {
      setIsMinting(false);
    }
  };

  
  const updatePixel = async (x: number, y: number) => {
    if (!isConnected) return;
    
    const key = `${x}-${y}`;
    
    try {
      setIsMinting(true); // Use separate minting state
      
      // Add to pending updates
      setPendingUpdates(prev => {
        const newSet = new Set(prev).add(key);
        console.log(`Added ${key} to pending updates`);
        return newSet;
      });
      
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "updateColor",
        args: [BigInt(x), BigInt(y), selectedColor],
      });
  
      console.log("Update transaction submitted:", txHash);
      
      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType('update');
      
    } catch (error) {
      console.error("Error updating pixel:", error);
      
      // Remove from pending updates on error
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        console.log(`Removed ${key} from pending updates due to error`);
        return newSet;
      });
    } finally {
      setIsMinting(false);
    }
  };
  const toggleDrawMode = () => {
    setIsDrawMode(!isDrawMode);
    if (!isDrawMode) {
      // Entering draw mode - clear selected pixel to avoid confusion
      setSelectedPixel(null);
      // Clear drawn pixels when exiting draw mode is already handled below
    } else {
      // Exiting draw mode - clear drawn pixels
      setDrawnPixels(new Map());
    }
  };
  
  // REPLACE your drawing functions with these:
  const addPixelToDrawing = (x: number, y: number) => {
    const key = `${x}-${y}`;
    // Only add unminted and non-pending pixels
    if (!isPixelMinted(x, y) && !isPixelPending(x, y)) {
      setDrawnPixels(prev => {
        const newMap = new Map(prev);
        newMap.set(key, selectedColor); // Store the current selected color
        return newMap;
      });
    }
  };

  const removePixelFromDrawing = (x: number, y: number) => {
    const key = `${x}-${y}`;
    setDrawnPixels(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  };

  const clearDrawing = () => {
    setDrawnPixels(new Map());
  };

  const batchMintPixels = async () => {
    if (!isConnected || !address || drawnPixels.size === 0) return;
    
    // Move pixelArray definition outside try block so it's accessible in catch
    const pixelArray = Array.from(drawnPixels.entries()); // Now gets [key, color] pairs
    
    try {
      setIsBatchMinting(true);
      
      const xCoords = pixelArray.map(([key]) => BigInt(key.split('-')[0]));
      const yCoords = pixelArray.map(([key]) => BigInt(key.split('-')[1]));
      const colors = pixelArray.map(([, color]) => color); // Use individual colors
      
      // Add all pixels to pending mints
      pixelArray.forEach(([key]) => {
        setPendingMints(prev => new Set(prev).add(key));
      });
      
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "batchMint",
        args: [xCoords, yCoords, colors],
      });
      
      console.log("Batch mint transaction submitted:", txHash);
      setPendingTxHash(txHash);
      setPendingTxType('mint');
      
      // Clear drawing
      setDrawnPixels(new Map());
      setIsDrawMode(false);
      
    } catch (error) {
      console.error("Error batch minting pixels:", error);
      // Remove from pending mints on error - now pixelArray is accessible
      pixelArray.forEach(([key]: [string, string]) => {
        setPendingMints(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      });
    } finally {
      setIsBatchMinting(false);
    }
  };
  

  const canUpdatePixel = (x: number, y: number) => {
    if (!isConnected || !address) return false;
    const owner = getPixelOwner(x, y);
    return owner && owner.toLowerCase() === address.toLowerCase();
  };

  const isPixelPending = (x: number, y: number) => {
    const key = `${x}-${y}`;
    return pendingMints.has(key) || pendingUpdates.has(key);
  };

  // Calculate zoom percentage for display
  const zoomPercentage = Math.round(((MAX_VIEWPORT_SIZE - viewportSize) / (MAX_VIEWPORT_SIZE - MIN_VIEWPORT_SIZE)) * 100);
  
  const handleGoToPosition = () => {
    const x = parseInt(positionX);
    const y = parseInt(positionY);
    
    // Validate input
    if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) {
      alert(`Please enter valid coordinates (0-${CANVAS_WIDTH-1}, 0-${CANVAS_HEIGHT-1})`);
      return;
    }
    
    // Calculate new viewport position to center the target pixel
    const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - viewportSize, x - Math.floor(viewportSize / 2)));
    const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - viewportSize, y - Math.floor(viewportSize / 2)));
    
    // Update viewport
    setViewportX(newViewportX);
    setViewportY(newViewportY);
    
    // Select the pixel
    setSelectedPixel([x, y]);
    // Highlight the pixel with a special border
    setHighlightedPixel([x, y]);
    // Clear the highlight after 3 seconds
    setTimeout(() => {
      setHighlightedPixel(null);
    }, 3000);
  
    // Clear input and close
    setPositionX('');
    setPositionY('');
    setShowPositionInput(false);
    
    // Show sidebar if hidden to see the selected pixel info
    if (!showSidebar) {
      setShowSidebar(true);
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* Full Screen Canvas Background */}
      <div className="w-full h-full bg-gray-800 relative">
                {/* Header - Fixed at top with high z-index */}
        <div className="fixed top-0 left-0 right-0 z-40 px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex justify-between items-center gap-1 sm:gap-2">
            {/* Left side  */}
            <div className="flex items-center gap-2 sm:gap-4">
            </div>
            
            {/* Right side controls */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {/* Position Input - Hide on very small screens */}
              {showPositionInput ? (
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 sm:px-2 py-1">
                  <input
                    type="number"
                    placeholder="X"
                    value={positionX}
                    onChange={(e) => setPositionX(e.target.value)}
                    className="w-12 sm:w-16 px-1 py-1 text-xs bg-gray-700 text-white rounded border-none outline-none"
                    min="0"
                    max={CANVAS_WIDTH - 1}
                  />
                  <input
                    type="number"
                    placeholder="Y"
                    value={positionY}
                    onChange={(e) => setPositionY(e.target.value)}
                    className="w-12 sm:w-16 px-1 py-1 text-xs bg-gray-700 text-white rounded border-none outline-none"
                    min="0"
                    max={CANVAS_HEIGHT - 1}
                  />
                  <button
                    onClick={handleGoToPosition}
                    className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                    title="Go to Position"
                  >
                    Go
                  </button>
                  <button
                    onClick={() => {
                      setShowPositionInput(false);
                      setPositionX('');
                      setPositionY('');
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPositionInput(true)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors"
                  title="Go to Position"
                >
                  📍
                </button>
              )}

              {/* Draw Mode Button */}
              <button
                onClick={toggleDrawMode}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  isDrawMode 
                    ? 'bg-orange-600 hover:bg-orange-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={isDrawMode ? "Exit Draw Mode" : "Enter Draw Mode"}
              >
                {isDrawMode ? '🎨' : '✏️'}
              </button>

              {/* Draw Mode Controls - Stack on mobile */}
              {isDrawMode && drawnPixels.size > 0 && (
                <div className="flex items-center gap-1 bg-orange-800 rounded-lg px-1 sm:px-2 py-1">
                  <span className="text-xs text-orange-200 hidden sm:inline">{drawnPixels.size} pixels</span>
                  <span className="text-xs text-orange-200 sm:hidden">{drawnPixels.size}</span>
                  <button
                    onClick={batchMintPixels}
                    className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                    disabled={isBatchMinting}
                    title="Mint Selected Pixels"
                  >
                    {isBatchMinting ? '⏳' : '⚡'}
                  </button>
                  <button
                    onClick={clearDrawing}
                    className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                    title="Clear Selection"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Zoom Controls - Compact on mobile */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 sm:px-2 py-1">
                <button 
                  onClick={handleZoomIn}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs sm:text-sm transition-colors"
                  disabled={viewportSize <= MIN_VIEWPORT_SIZE}
                  title="Zoom In"
                >
                  🔍+
                </button>
                <span className="text-xs text-gray-300 px-1 sm:px-2 min-w-[2rem] sm:min-w-[3rem] text-center">
                  {zoomPercentage}%
                </span>
                <button 
                  onClick={handleZoomOut}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs sm:text-sm transition-colors"
                  disabled={viewportSize >= MAX_VIEWPORT_SIZE}
                  title="Zoom Out"
                >
                  🔍-
                </button>
              </div>
              
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
                title={showSidebar ? 'Hide Tools' : 'Show Tools'}
              >
                🎨
              </button>

              {/* Connect Button */}
              <ConnectButton />
            </div>
          </div>
        </div>



        {/* Full Screen Canvas - No container, direct grid */}
        <div 
          className="absolute inset-0 bg-gray-100 select-none"
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none' // Prevent default touch behaviors

          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Loading overlay */}
          {isLoadingChunks && isInitialLoad && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⚡</div>
                <p className="text-xl text-gray-700">Loading canvas...</p>

              </div>
            </div>
          )}
          {/* Chunk loading progress indicator */}
          {isLoadingChunks && !isInitialLoad && loadingProgress.total > 0 && (
            <div className="absolute top-20 right-4 bg-black bg-opacity-80 text-white text-xs px-4 py-3 rounded-lg z-10 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="animate-spin">⚡</span>
                <span>Loading...</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(loadingProgress.current / loadingProgress.total) * 100}%` 
                  }}
                ></div>
              </div>
              <div className="text-center text-gray-300">

                ({Math.round((loadingProgress.current / loadingProgress.total) * 100)}%)
              </div>
            </div>
          )}

          {/* Direct pixel grid - fills entire screen */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
          >
          <div 
            className="absolute inset-0 grid"
            style={{ 
              gridTemplateColumns: `repeat(${viewportSize}, 1fr)`,
              gridTemplateRows: `repeat(${viewportSize}, 1fr)`,
              gap: '1px',
              padding: '1px',
              width: '100vw',
              height: '100vh',
              minWidth: '100vw', // Ensure minimum full width
              minHeight: '100vh', // Ensure minimum full height
            }}
          >

        {memoizedPixelGrid.map(({ i, globalX, globalY }) => {
          // Skip if outside canvas bounds, but render empty space
          if (globalX >= CANVAS_WIDTH || globalY >= CANVAS_HEIGHT || globalX < 0 || globalY < 0) {
            return (
              <div key={i} className="bg-gray-300 opacity-50" />
            );
          }
              
            const isSelected = selectedPixel?.[0] === globalX && selectedPixel?.[1] === globalY;
            const isHighlighted = highlightedPixel?.[0] === globalX && highlightedPixel?.[1] === globalY;
            const isMinted = isPixelMinted(globalX, globalY);
            const isPending = isPixelPending(globalX, globalY);
            const pixelColor = getPixelColor(globalX, globalY);
            const isDrawn = isDrawMode && drawnPixels.has(`${globalX}-${globalY}`);
                // Determine border style based on state
              let borderStyle = 'none';
              if (isHighlighted) {
                borderStyle = '3px solid #f59e0b'; // Amber border for highlighted pixel
              } else if (isSelected) {
                borderStyle = '2px solid #3b82f6'; // Blue border for selected pixel
              }          
              return (
                <div
                  key={i}
                  onClick={(e) => handlePixelClick(e, globalX, globalY)}
                  className={`
                    relative cursor-crosshair transition-all duration-150 hover:opacity-80 hover:scale-105 hover:z-10
                    ${isPending ? "animate-pulse" : ""}
                    ${isDrawn ? "ring-2 ring-orange-400" : ""} 
                    ${isHighlighted ? "animate-bounce" : ""}
                  `}
                  style={{ 
                    backgroundColor: pixelColor,
                    border: borderStyle,
                    aspectRatio: '1 / 1', // Ensure each pixel is square
                    boxShadow: isHighlighted ? '0 0 10px rgba(245, 158, 11, 0.8)' : 'none',
                  }}
                  title={`Pixel (${globalX}, ${globalY}) ${isMinted ? '- Minted' : '- Available'}${isPending ? ' - Pending' : ''}${isDrawn ? ' - Selected for minting' : ''}${isHighlighted ? ' - Found!' : ''}`}
                >
                  {isPending && (
                    <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-sm"></div>
                  )}
                  {isDrawn && (
                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-orange-400 rounded-full shadow-sm"></div>
                  )}
                  {isHighlighted && (
                    <div className="absolute inset-0 border-2 border-amber-400 animate-ping"></div>
                  )}
                </div>
              );
            })}
          </div>
          </div>
          {/* Viewport indicator */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded-lg z-10">
            ({viewportX}, {viewportY}) | {viewportSize}×{viewportSize} | {Object.keys(pixelData).length} minted
            {isLoadingChunks && !isInitialLoad && (
              <div className="text-xs text-blue-400 mt-1">Loading...</div>
            )}
          </div>

          {/* Zoom instructions */}
          {showInstructions && (
          <div 
            className="absolute top-20 left-4 bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded-lg z-10 cursor-pointer hover:bg-opacity-80 transition-opacity"
            onClick={() => setShowInstructions(false)}
            title="Click to dismiss"
          >
            🖱️ Drag to pan • 🔍 Scroll to zoom • 🎯 Click pixel to select
            <span className="ml-2 text-gray-400">✕</span>
          </div>
        )}
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div 
          className={`fixed w-80 h-full bg-gray-900 bg-opacity-95 backdrop-blur-sm border border-gray-700 flex flex-col z-30 shadow-2xl rounded-lg ${
            isDraggingSidebar ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ 
            left: `${sidebarPosition.x}px`,
            top: `${sidebarPosition.y}px`,
            right: 'auto' // Override the original right: 0
          }}
        >
          {/* Draggable header */}
          <div 
            className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleSidebarDragStart}
            onTouchStart={handleSidebarTouchStart}
            style={{ touchAction: 'none' }}
          >
            <div>
              <h2 className="text-lg font-semibold">🎨 Pixel Canvas</h2>
              <div className="text-sm text-gray-300">
                {CANVAS_WIDTH * CANVAS_HEIGHT} pixels • {totalMinted} minted
              </div>
            </div>

            <button 
              onClick={() => setShowSidebar(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          {/* Scrollable content container */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
              
              {/* Custom Color Options */}
              <div className="space-y-3">
                {/* Color Picker */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Picker:</label>
                  <input 
                    type="color" 
                    value={selectedColor} 
                    onChange={e => setSelectedColor(e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                    title="Color Picker"
                  />
                  <span className="text-xs text-gray-400 font-mono">{selectedColor}</span>
                </div>
                
                {/* Hex Input */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Hex:</label>
                  {showHexInput ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={customHexColor}
                        onChange={(e) => setCustomHexColor(e.target.value)}
                        onKeyDown={handleHexKeyPress}
                        placeholder="#FF0000"
                        className="flex-1 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-gray-600 outline-none focus:border-blue-500"
                        maxLength={7}
                        autoFocus
                      />
                      <button
                        onClick={applyHexColor}
                        className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
                        title="Apply Color"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setCustomHexColor('');
                          setShowHexInput(false);
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs transition-colors"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowHexInput(true)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      title="Enter Hex Color"
                    >
                      # Enter Hex
                    </button>
                  )}
                </div>
                
                {/* Current Selected Color Display */}
                <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                  <span className="text-sm text-gray-400">Selected:</span>
                  <div 
                    className="w-6 h-6 border border-gray-600 rounded"
                    style={{ backgroundColor: selectedColor }}
                  ></div>
                  <span className="text-xs text-gray-300 font-mono">{selectedColor}</span>
                </div>
              </div>
            </div>

            {/* Selected Pixel Info - Modified to handle batch mode */}
            {(selectedPixel || (isDrawMode && drawnPixels.size > 0)) && (
              <div className="p-6 border-b border-gray-700">
                {selectedPixel ? (
                  <h3 className="text-lg font-semibold mb-4">
                    📍 Pixel ({selectedPixel[0]}, {selectedPixel[1]})
                  </h3>
                ) : (
                  <h3 className="text-lg font-semibold mb-4">
                    🎨 Batch Mint
                  </h3>
                )}
                
                <div className="space-y-3">
                  {/* Show batch mint info when in draw mode without selected pixel */}
                  {!selectedPixel && isDrawMode && drawnPixels.size > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                        <span className="text-orange-400 font-medium">Batch Mode - {drawnPixels.size} pixels selected</span>
                      </div>
                      
                      <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                        <span className="text-sm text-gray-400">Will mint with:</span>
                        <div 
                          className="w-6 h-6 border border-gray-600 rounded"
                          style={{ backgroundColor: selectedColor }}
                        ></div>
                        <span className="text-xs text-gray-300 font-mono">{selectedColor}</span>
                      </div>
                      
                      <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                        Click more pixels on canvas to add them, or use the mint button below to mint all selected pixels.
                      </div>
                    </>
                  )}
                  
                  {/* Existing selected pixel logic */}
                  {selectedPixel && (
                    <>
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Owner:</span>
                            <span className="text-xs text-gray-300 font-mono break-all">
                              {getPixelOwner(selectedPixel[0], selectedPixel[1])?.slice(0, 6)}...
                              {getPixelOwner(selectedPixel[0], selectedPixel[1])?.slice(-4)}
                            </span>
                          </div>
                        </div>
                      ) : isPixelPending(selectedPixel[0], selectedPixel[1]) ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                          <span className="text-orange-400">Transaction Pending...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                            <span className="text-gray-400">Available</span>
                          </div>
                          
                          {/* Show selected color for single pixel minting */}
                          <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                            <span className="text-sm text-gray-400">Will mint with:</span>
                            <div 
                              className="w-6 h-6 border border-gray-600 rounded"
                              style={{ backgroundColor: selectedColor }}
                            ></div>
                            <span className="text-xs text-gray-300 font-mono">{selectedColor}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {isConnected ? (
                    <div className="pt-2 space-y-2">
                      {/* Batch mint button when no specific pixel is selected but pixels are drawn */}
                      {!selectedPixel && isDrawMode && drawnPixels.size > 0 && (
                        <>
                          <button 
                            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                            onClick={batchMintPixels}
                            disabled={isBatchMinting}
                          >
                            {isBatchMinting ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                Minting {drawnPixels.size} pixels...
                              </>
                            ) : (
                              <>
                                <span>⚡</span>
                                Mint {drawnPixels.size} Pixels
                              </>
                            )}
                          </button>
                          
                          <button 
                            className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                            onClick={clearDrawing}
                            disabled={isBatchMinting}
                          >
                            <span>🗑️</span>
                            Clear Selection
                          </button>
                          
                          <button 
                            className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                            onClick={toggleDrawMode}
                          >
                            <span>✏️</span>
                            Exit Draw Mode
                          </button>
                        </>
                      )}
                      
                      {/* Single pixel buttons when a pixel is selected */}
                      {selectedPixel && (
                        <>
                          {/* Only show View NFT button for minted pixels */}
                          {isPixelMinted(selectedPixel[0], selectedPixel[1]) && (
                            <button 
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                              onClick={() => {
                                const tokenId = getTokenId(selectedPixel[0], selectedPixel[1]);
                              window.open(`/nft?tokenId=${tokenId}`, '_blank');
                              }}
                            >
                              <span>🖼️</span>
                              View Details
                            </button>
                          )}

                          {!isPixelMinted(selectedPixel[0], selectedPixel[1]) ? (
                            <button 
                              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                              onClick={() => {
                                console.log(`Attempting to mint pixel (${selectedPixel[0]}, ${selectedPixel[1]})`);
                                mintPixel(...selectedPixel);
                              }}
                              disabled={isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting || isBatchMinting}
                            >
                              {isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting ? (
                                <>
                                  <span className="animate-spin">⏳</span>
                                  Minting...
                                </>
                              ) : (
                                <>
                                  <span>⚡</span>
                                  Mint Pixel
                                </>
                              )}
                            </button>
                          ) : canUpdatePixel(selectedPixel[0], selectedPixel[1]) ? (
                            <button 
                              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                              onClick={() => {
                                console.log(`Attempting to update pixel (${selectedPixel[0]}, ${selectedPixel[1]})`);
                                updatePixel(...selectedPixel);
                              }}
                              disabled={isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting}
                            >
                              {isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting ? (
                                <>
                                  <span className="animate-spin">⏳</span>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <span>🎨</span>
                                  Update Color
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-center p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                              <p className="text-red-400 text-sm">You don&lsquo;t own this pixel</p>
                            </div>
                          )}
                        </>
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
          </div>
        </div>
      )}

    </div>
  );
}