'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useWriteContract, usePublicClient, useWatchContractEvent, useWaitForTransactionReceipt } from "wagmi";
import { useAppKitAccount } from '@reown/appkit/react';
import ConnectButton from "@/components/ConnectButton";
import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Abi, Log } from "viem";

const CANVAS_WIDTH = 100; // Total canvas size (100x100 = 10,000 pixels)
const CANVAS_HEIGHT = 100;
const MIN_VIEWPORT_SIZE = 10; // Minimum zoom (most zoomed in)
const MAX_VIEWPORT_SIZE =100; // Maximum zoom (most zoomed out)
const PIXEL_SIZE = 8; // Base pixel size in pixels
const CHUNK_SIZE = 5; // Load in 5x5 chunks for efficiency
const CONTRACT_ADDRESS = "0x32c25287A2683fC9C834bA686d2f4dcb74Ba19aE";

// Add request throttling
const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent chunk loads
const DEBOUNCE_DELAY = 300; // Debounce delay for viewport changes

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

interface ContractEventLog {
  args?: unknown;
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
  const loadedChunksRef = useRef<Set<string>>(new Set());  
  // State to track pending transactions
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
  // Debouncing for viewport changes
  const viewportChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Request queue management
  const activeRequestsRef = useRef<number>(0);
  const requestQueueRef = useRef<Array<() => Promise<void>>>([]);

  const { address, isConnected } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [sidebarPosition, setSidebarPosition] = useState({ x: 0, y: 64 }); // Start at top-right, below header
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarDragStart, setSidebarDragStart] = useState({ x: 0, y: 0 });
  useEffect(() => {
    setSidebarPosition({ x: window.innerWidth - 320, y: 64 });
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

  // Request queue processor
  const processRequestQueue = useCallback(async () => {
    if (activeRequestsRef.current >= MAX_CONCURRENT_REQUESTS || requestQueueRef.current.length === 0) {
      return;
    }

    const request = requestQueueRef.current.shift();
    if (request) {
      activeRequestsRef.current++;
      try {
        await request();
      } finally {
        activeRequestsRef.current--;
        // Process next request
        setTimeout(processRequestQueue, 50); // Small delay between requests
      }
    }
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
  }, [isTxSuccess, txReceipt, pendingTxHash, pendingTxPixel, pendingTxType, publicClient, getTokenId]);

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
  const getChunkKey = useCallback((chunkX: number, chunkY: number) => `${chunkX}-${chunkY}`, []);

  const getChunkCoords = useCallback((x: number, y: number) => ({
    chunkX: Math.floor(x / CHUNK_SIZE),
    chunkY: Math.floor(y / CHUNK_SIZE)
  }), []);

  const getRequiredChunks = useCallback((viewX: number, viewY: number, currentViewportSize: number) => {
    const chunks = [];
    const startChunkX = Math.floor(viewX / CHUNK_SIZE);
    const startChunkY = Math.floor(viewY / CHUNK_SIZE);
    const endChunkX = Math.floor((viewX + currentViewportSize) / CHUNK_SIZE);
    const endChunkY = Math.floor((viewY + currentViewportSize) / CHUNK_SIZE);
    
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
        if (chunkX >= 0 && chunkY >= 0 && 
            chunkX < Math.ceil(CANVAS_WIDTH / CHUNK_SIZE) && 
            chunkY < Math.ceil(CANVAS_HEIGHT / CHUNK_SIZE)) {
          chunks.push({ chunkX, chunkY });
        }
      }
    }
    return chunks;
  }, []);

  // Listen for Transfer events (minting) - Fixed typing
  useWatchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: PXNFT_ABI,
    eventName: 'Transfer',
    enabled: eventWatchingEnabled && isConnected && !!publicClient,
    onError: (error) => {
      console.log('Event watching failed, disabling:', error);      
      setEventWatchingEnabled(false);
    },
    onLogs: useCallback((logs: Log[]) => {
      console.log('Transfer event detected:', logs);
      
      if (window.clearPixelFallback) {
        window.clearPixelFallback();
        window.clearPixelFallback = undefined;
      }
      
      logs.forEach(async (log: Log) => {
        const logArgs = (log as ContractEventLog).args as TransferEventArgs | undefined;
        if (!logArgs) return;
        
        const { from, to, tokenId } = logArgs;
        
        // Check if this is a mint (from zero address)
        if (from === '0x0000000000000000000000000000000000000000') {
          const tokenIdNumber = Number(tokenId);
          const { x, y } = getCoordinatesFromTokenId(tokenIdNumber);
          const key = `${x}-${y}`;
          
          console.log(`Mint confirmed for pixel (${x}, ${y}), owner: ${to}`);
          // Update total minted count
          setTotalMinted(prev => prev + 1);
        
          // Remove from pending mints when confirmed
          setPendingMints(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            console.log(`Removed ${key} from pending mints`);
            return newSet;
          });
          
          if (publicClient) {
            try {
              const color = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: 'getColor',
                args: [BigInt(x), BigInt(y)],
              }) as string;

              console.log(`Fetched color for newly minted pixel (${x}, ${y}): ${color}`);

              setPixelData(prev => {
                const updated = {
                  ...prev,
                  [key]: {
                    color: color || '#ffffff',
                    owner: to,
                    isMinted: true,
                  }
                };
                console.log(`Updated pixel data for ${key}:`, updated[key]);
                return updated;
              });
            } catch (error) {
              console.error('Error fetching color for newly minted pixel:', error);
              // Fallback: update without fetching color
              setPixelData(prev => ({
                ...prev,
                [key]: {
                  color: '#ffffff',
                  owner: to,
                  isMinted: true,
                }
              }));
            }
          }
        }
      });
    }, [publicClient, getCoordinatesFromTokenId]),
  });

  const fetchChunkData = useCallback(async (chunkX: number, chunkY: number) => {
    if (!publicClient) return;
    
    const chunkKey = getChunkKey(chunkX, chunkY);
    if (loadedChunksRef.current.has(chunkKey)) return;
    
    // Mark as loaded immediately to prevent duplicate requests
    loadedChunksRef.current.add(chunkKey);
    
    const ownerCalls = [];
    const colorCalls = [];
    
    const startX = chunkX * CHUNK_SIZE;
    const startY = chunkY * CHUNK_SIZE;
    const endX = Math.min(startX + CHUNK_SIZE, CANVAS_WIDTH);
    const endY = Math.min(startY + CHUNK_SIZE, CANVAS_HEIGHT);
    
    // Reduced chunk size means fewer calls per chunk
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tokenId = getTokenId(x, y);
        
        ownerCalls.push({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        });
        
        colorCalls.push({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'getColor',
          args: [BigInt(x), BigInt(y)],
        });
      }
    }
  
    try {
      console.log(`Loading chunk ${chunkKey} with ${ownerCalls.length} pixels`);
      
      const [ownerResults, colorResults] = await Promise.all([
        publicClient.multicall({ 
          contracts: ownerCalls.map(call => ({
            ...call,
            abi: call.abi as Abi
          }))
        }),
        publicClient.multicall({ 
          contracts: colorCalls.map(call => ({
            ...call,
            abi: call.abi as Abi
          }))
        })
      ]);
  
      const newPixelData: { [key: string]: PixelData } = {};
      let index = 0;
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const key = `${x}-${y}`;
          const ownerResult = ownerResults[index];
          const colorResult = colorResults[index];
          
          if (ownerResult.status === 'success' && colorResult.status === 'success') {
            newPixelData[key] = {
              color: colorResult.result as string || '#ffffff',
              owner: ownerResult.result as string,
              isMinted: true,
            };
          } else {
            newPixelData[key] = {
              color: '#ffffff',
              owner: null,
              isMinted: false,
            };
          }
          index++;
        }
      }
  
      setPixelData(prev => ({ ...prev, ...newPixelData }));
      console.log(`Loaded chunk ${chunkKey} successfully`);
    } catch (error) {
      console.error(`Error fetching chunk ${chunkKey}:`, error);
      // Remove from loaded chunks on error so it can be retried
      loadedChunksRef.current.delete(chunkKey);
    }
  }, [publicClient, getChunkKey, getTokenId]);

  const loadViewportChunks = useCallback(async (viewX: number, viewY: number, currentViewportSize: number) => {
    const requiredChunks = getRequiredChunks(viewX, viewY, currentViewportSize);
    
    console.log(`Loading viewport (${viewX}, ${viewY}) - ${requiredChunks.length} chunks required`);
    
    // Add chunks to request queue instead of loading all at once
    requiredChunks.forEach(({ chunkX, chunkY }) => {
      const chunkKey = getChunkKey(chunkX, chunkY);
      if (!loadedChunksRef.current.has(chunkKey)) {
        requestQueueRef.current.push(() => fetchChunkData(chunkX, chunkY));
      }
    });
    
    // Start processing the queue
    processRequestQueue();
    
    // Clean up chunks that are too far away (but less aggressively)
    const cleanupDistance = 3; // Increased cleanup distance for zoom
    const currentChunkX = Math.floor(viewX / CHUNK_SIZE);
    const currentChunkY = Math.floor(viewY / CHUNK_SIZE);
    
    const newLoadedChunks = new Set<string>();
    loadedChunksRef.current.forEach(chunkKey => {
      const [chunkX, chunkY] = chunkKey.split('-').map(Number);
      const distance = Math.max(
        Math.abs(chunkX - currentChunkX),
        Math.abs(chunkY - currentChunkY)
      );
      
      if (distance <= cleanupDistance) {
        newLoadedChunks.add(chunkKey);
      }
    });
    loadedChunksRef.current = newLoadedChunks;
    
    // Remove pixel data for unloaded chunks
    setPixelData(prev => {
      const newData = { ...prev };
      Object.keys(newData).forEach(key => {
        const [x, y] = key.split('-').map(Number);
        const { chunkX, chunkY } = getChunkCoords(x, y);
        const distance = Math.max(
          Math.abs(chunkX - currentChunkX),
          Math.abs(chunkY - currentChunkY)
        );
        
        if (distance > cleanupDistance) {
          delete newData[key];
        }
      });
      return newData;
    });
  }, [fetchChunkData, getRequiredChunks, getChunkKey, getChunkCoords, processRequestQueue]);

  // Debounced viewport loading with longer delay
  const debouncedLoadViewportChunks = useCallback((viewX: number, viewY: number, currentViewportSize: number) => {
    if (viewportChangeTimeoutRef.current) {
      clearTimeout(viewportChangeTimeoutRef.current);
    }
    
    viewportChangeTimeoutRef.current = setTimeout(() => {
      loadViewportChunks(viewX, viewY, currentViewportSize);
    }, DEBOUNCE_DELAY);
  }, [loadViewportChunks]);

  useEffect(() => {
    debouncedLoadViewportChunks(viewportX, viewportY, viewportSize);
    
    // Cleanup timeout on unmount
    return () => {
      if (viewportChangeTimeoutRef.current) {
        clearTimeout(viewportChangeTimeoutRef.current);
      }
    };
  }, [debouncedLoadViewportChunks, viewportX, viewportY, viewportSize]);

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
  const handleZoomIn = () => {
    const newSize = Math.max(MIN_VIEWPORT_SIZE, viewportSize - 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      // Adjust viewport position to keep center roughly the same
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;
      setViewportX(Math.max(0, Math.min(CANVAS_WIDTH - newSize, centerX - newSize / 2)));
      setViewportY(Math.max(0, Math.min(CANVAS_HEIGHT - newSize, centerY - newSize / 2)));
    }
  };

  const handleZoomOut = () => {
    const newSize = Math.min(MAX_VIEWPORT_SIZE, viewportSize + 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      
      // When zooming out, try to center the viewport to show maximum area
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;
      
      // Calculate new viewport position to center the view
      let newViewportX = centerX - newSize / 2;
      let newViewportY = centerY - newSize / 2;
      
      // If we're at maximum zoom out, try to show as much as possible
      if (newSize === MAX_VIEWPORT_SIZE) {
        // Center the viewport to show maximum area
        newViewportX = Math.max(0, (CANVAS_WIDTH - newSize) / 2);
        newViewportY = Math.max(0, (CANVAS_HEIGHT - newSize) / 2);
      }
      
      // Ensure viewport stays within bounds
      newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - newSize, newViewportX));
      newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - newSize, newViewportY));
      
      setViewportX(newViewportX);
      setViewportY(newViewportY);
    }
  };

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000);
    }
  }, [viewportSize, viewportX, viewportY, hasInteracted]);

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
    
    // Increase threshold for movement to reduce viewport changes
    const movementThreshold = PIXEL_SIZE * 2; // Require more movement before updating
    
    if (Math.abs(deltaX) < movementThreshold && Math.abs(deltaY) < movementThreshold) {
      return;
    }
    
    const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - viewportSize, 
      viewportX - Math.floor(deltaX / PIXEL_SIZE)));
    const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - viewportSize, 
      viewportY - Math.floor(deltaY / PIXEL_SIZE)));
    
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
  
  const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - viewportSize, 
    viewportX - Math.floor(deltaX / PIXEL_SIZE)));
  const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - viewportSize, 
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
    
    const key = `${x}-${y}`;
    
    try {
      setIsMinting(true); // Use separate minting state
      
      // Add to pending mints
      setPendingMints(prev => {
        const newSet = new Set(prev).add(key);
        console.log(`Added ${key} to pending mints`);
        return newSet;
      });
  
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "mint",
        args: [BigInt(x), BigInt(y), selectedColor],
      });
  
      console.log("Mint transaction submitted:", txHash);
      
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
    if (isDrawMode) {
      // Clear drawn pixels when exiting draw mode
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
  
// REPLACE your getPixelColor function with this:
const getPixelColor = (x: number, y: number) => {
  const key = `${x}-${y}`;
  const pixel = pixelData[key];
  
  // In draw mode, handle drawn pixels specially
  if (isDrawMode && drawnPixels.has(key)) {
    // If pixel is already minted, keep its original color (user can't mint it anyway)
    if (pixel?.isMinted) {
      return pixel.color;
    }
    // For unminted drawn pixels, show the color it was selected with
    return drawnPixels.get(key) || selectedColor;
  }
  
  // Regular selection mode - only show preview for unminted pixels
  if (!isDrawMode && selectedPixel?.[0] === x && selectedPixel?.[1] === y && !pixel?.isMinted) {
    return selectedColor;
  }
  
  // Default: show actual pixel color or white for unminted
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
        <div className="fixed top-0 left-0 right-0 bg-gray-900 bg-opacity-95 z-40 px-2 sm:px-4 py-2 sm:py-3">
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
                  loadedChunksRef.current.clear();
                  requestQueueRef.current = [];
                  setIsLoadingChunks(true);
                  debouncedLoadViewportChunks(viewportX, viewportY, viewportSize);
                  setTimeout(() => setIsLoadingChunks(false), 1000);
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
          {isLoadingChunks  && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⚡</div>
                <p className="text-xl text-gray-700">Loading pixel data...</p>
              </div>
            </div>
          )}

          {/* Direct pixel grid - fills entire screen */}
          <div 
            className="absolute inset-0 grid"
            style={{ 
              gridTemplateColumns: `repeat(${viewportSize}, 1fr)`,
              gridTemplateRows: `repeat(${viewportSize}, 1fr)`,
              gap: '1px',
              padding: '1px',
              aspectRatio: '1 / 1',
            }}
          >
            {[...Array(viewportSize * viewportSize)].map((_, i) => {
              const localX = i % viewportSize;
              const localY = Math.floor(i / viewportSize);
              const globalX = viewportX + localX;
              const globalY = viewportY + localY;
              
              // Skip if outside canvas bounds
              if (globalX >= CANVAS_WIDTH || globalY >= CANVAS_HEIGHT) {
                return (
                  <div key={i} className="bg-gray-300" />
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
          
          {/* Viewport indicator */}
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded-lg z-10">
            ({viewportX}, {viewportY}) | {viewportSize}×{viewportSize} | {loadedChunksRef.current.size} chunks
          </div>
          
          {/* Request queue indicator */}
          {requestQueueRef.current.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-blue-600 bg-opacity-90 text-white text-sm px-3 py-2 rounded-lg z-10">
              Loading... ({requestQueueRef.current.length} chunks queued)
            </div>
          )}

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


            {/* Zoom Controls in Sidebar */}
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold mb-4">🔍 Zoom & Navigation</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Zoom Level:</span>
                  <span className="text-sm font-mono">{zoomPercentage}%</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleZoomIn}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    disabled={viewportSize <= MIN_VIEWPORT_SIZE}
                  >
                    🔍+ Zoom In
                  </button>
                  <button 
                    onClick={handleZoomOut}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    disabled={viewportSize >= MAX_VIEWPORT_SIZE}
                  >
                    🔍- Zoom Out
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Viewing {viewportSize}×{viewportSize} pixels ({viewportSize * viewportSize} total)
                </div>
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
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                      <span className="text-gray-400">Available</span>
                    </div>
                  )}

                  {isConnected ? (
                    <div className="pt-2 space-y-2">
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
                          disabled={isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting}
                        >
                          {isPixelPending(selectedPixel[0], selectedPixel[1]) || isMinting  ? (
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
              
              <div className="pt-4 border-t border-gray-700 mt-4">
                <h4 className="text-white font-medium mb-2">Legend</h4>
                <div className="space-y-1 text-xs">
                  <p><span className="text-blue-400">●</span> Blue dots = Minted pixels</p>
                  <p><span className="text-orange-400">●</span> Orange dots = Pending transactions</p>
                  <p><span className="text-yellow-400">●</span> Yellow border = Selected pixel</p>
                </div>
              </div>
              
              {/* Performance info */}
              <div className="pt-4 border-t border-gray-700 mt-4">
                <h4 className="text-white font-medium mb-2">Performance Info</h4>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>Canvas: {CANVAS_WIDTH}×{CANVAS_HEIGHT} pixels</p>
                  <p>Viewport: {viewportSize}×{viewportSize} pixels</p>
                  <p>Chunk size: {CHUNK_SIZE}×{CHUNK_SIZE} pixels</p>
                  <p>Active requests: {activeRequestsRef.current}/{MAX_CONCURRENT_REQUESTS}</p>
                  <p>Queue: {requestQueueRef.current.length} pending</p>
                  <p>Loaded chunks: {loadedChunksRef.current.size}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

