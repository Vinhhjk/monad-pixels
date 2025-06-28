'use client';
import { useState, useEffect, useCallback, useMemo } from "react";
import { useWriteContract, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { useAppKitAccount } from '@reown/appkit/react';
import ConnectButton from "@/components/ConnectButton";
import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Log } from "viem";
const CANVAS_WIDTH = 100; // Total canvas size (260x267 = 69,420 pixels)
const CANVAS_HEIGHT = 100;
const MIN_VIEWPORT_SIZE = 10; // Minimum zoom (most zoomed in)
const MAX_VIEWPORT_SIZE =100; // Maximum zoom (most zoomed out)
const PIXEL_SIZE = 8; // Base pixel size in pixels

const CONTRACT_ADDRESS = "0xd001f83b75ffA5Cd7D2ffdC8bda1A45A963f4dCE";
const EXPLORER_BASE_URL = "https://testnet.monadexplorer.com/tx/"; 

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
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showInstructions, setShowInstructions] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [isPinching, setIsPinching] = useState(false);
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
  const [pendingTxType, setPendingTxType] = useState<'mint' | 'update' | 'batch' | 'compose' | 'delegation' | null>(null); 
  const [pendingBatchSize, setPendingBatchSize] = useState(0);
  const [eventWatchingEnabled, setEventWatchingEnabled] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawnPixels, setDrawnPixels] = useState<Map<string, string>>(new Map());  
  const [isBatchMinting, setIsBatchMinting] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [highlightedPixel, setHighlightedPixel] = useState<[number, number] | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);
  const [screenSize, setScreenSize] = useState({ width: 1024, height: 768 });
  
  // Delegation state
  const [isDelegateMode, setIsDelegateMode] = useState(false);
  const [delegateAddress, setDelegateAddress] = useState('');
  const [delegateAddresses, setDelegateAddresses] = useState<string[]>([]);
  const [isMultiAddressMode, setIsMultiAddressMode] = useState(false);

  const [showDelegateInput, setShowDelegateInput] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isBatchDelegate, setIsBatchDelegate] = useState(false);
  
  // Delegation area selection state
  const [delegateAreaStart, setDelegateAreaStart] = useState<[number, number] | null>(null);
  const [isDelegateAreaDragging, setIsDelegateAreaDragging] = useState(false);
  const [delegateSelectedArea, setDelegateSelectedArea] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
  
  // Authorization checking state for batch updates
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authResults, setAuthResults] = useState<{authorized: number; unauthorized: number} | null>(null);
  
  // Authorization state for selected pixel
  const [pixelAuthStatus, setPixelAuthStatus] = useState<{
    x: number;
    y: number;
    isOwner: boolean;
    isAuthorized: boolean;
    isChecking: boolean;
  } | null>(null);
  
  // Area selection and composition
  const [isAreaSelectMode, setIsAreaSelectMode] = useState(false);
  const [selectedArea, setSelectedArea] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
  const [areaSelectionStart, setAreaSelectionStart] = useState<[number, number] | null>(null);
  const [isAreaDragging, setIsAreaDragging] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [ownedPixelsInArea, setOwnedPixelsInArea] = useState<number[]>([]);
  const [compositionInfo, setCompositionInfo] = useState<{canCompose: boolean, reason: string, ownedCount: number} | null>(null);

  const { address, isConnected } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [sidebarPosition, setSidebarPosition] = useState({ x: 0, y: 64 }); // Start at top-right, below header
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarDragStart, setSidebarDragStart] = useState({ x: 0, y: 0 });
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  // Notification system
  interface Notification {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    timestamp: number;
    txHash?: string; // Add this optional field

  }
  
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Notification helper functions
  const addNotification = useCallback((type: 'success' | 'error' | 'info', title: string, message: string,  txHash?: string) => {
    const id = Date.now().toString();
    const newNotification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      txHash
    };
    
    setNotifications(prev => [...prev, newNotification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    setSidebarPosition({ x: window.innerWidth - 320, y: 64 });
    setScreenSize({ width: window.innerWidth, height: window.innerHeight });
  }, [])
  useEffect(() => {
    const handleResize = () => {
      const sidebarWidth = Math.min(320, window.innerWidth * 0.9);
      const maxX = window.innerWidth - sidebarWidth;
      const maxY = window.innerHeight - 200;
      
      setSidebarPosition(prev => ({
        x: Math.max(0, Math.min(maxX, prev.x)), // Keep within bounds
        y: Math.max(64, Math.min(maxY, prev.y)) // Keep within bounds
      }));
      
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
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

  useEffect(() => {
    if (isTxSuccess && txReceipt && pendingTxHash) {
      console.log('Transaction confirmed:', txReceipt);
      
      // Show success notification
      if (pendingTxType === 'batch') {
        // Determine if it was a mint or update batch based on pending states
        const wasMintBatch = pendingBatchSize > 0 && isBatchMinting;
        const wasUpdateBatch = pendingBatchSize > 0 && isBatchUpdating;
        
        if (wasMintBatch) {
          addNotification('success', 'Batch Mint Complete!', `Successfully minted ${pendingBatchSize} pixels!`, pendingTxHash);
        } else if (wasUpdateBatch) {
          addNotification('success', 'Batch Update Complete!', `Successfully updated ${pendingBatchSize} pixels!`, pendingTxHash);
        } else {
          addNotification('success', 'Batch Operation Complete!', `Successfully processed ${pendingBatchSize} pixels!`, pendingTxHash);
        }
      } else if (pendingTxType === 'compose') {
        // Add success notification for composition
        addNotification('success', 'Composition Complete!', `Successfully composed ${pendingBatchSize} pixels into NFT!`, pendingTxHash);
      } else if (pendingTxType === 'delegation') {
        // Add success notification for delegation and auto-close delegation mode
        addNotification('success', 'Delegation Complete!', `Successfully delegated ${pendingBatchSize} pixels!`, pendingTxHash);
        
        // Auto-close delegation mode after successful delegation
        setTimeout(() => {
          setIsDelegateMode(false);
          setIsBatchDelegate(false);
          setDelegateAddress('');
          setDelegateAddresses([]);
          setIsMultiAddressMode(false);
          setShowDelegateInput(false);
          setDrawnPixels(new Map());
          setSelectedPixel(null);
          setDelegateSelectedArea(null);
          setDelegateAreaStart(null);
          setIsDelegateAreaDragging(false);
        }, 1000); // 1 second delay so user can see the success message
      } else if (pendingTxPixel) {
        const [x, y] = pendingTxPixel;
        if (pendingTxType === 'mint') {
          addNotification('success', 'Pixel Minted!', `Successfully minted pixel at (${x}, ${y})`,pendingTxHash);
        } else if (pendingTxType === 'update') {
          addNotification('success', 'Color Updated!', `Successfully updated pixel at (${x}, ${y})`,pendingTxHash);
        }
      }
      
      // Store the current pixel for fallback (before clearing)
      const currentPixel = pendingTxPixel;
      const currentType = pendingTxType;
      
      // Clear the pending transaction state
      setPendingTxHash(null);
      setPendingTxPixel(null);
      setPendingBatchSize(0);
      
      // Fallback: If event listeners don't work, manually update after a delay
      const fallbackTimeout = setTimeout(async () => {
        if (currentType === 'batch') {
          console.log('Fallback: Batch transaction completed, clearing pending states');
          // Clear all pending states for batch operations
          setPendingMints(new Set());
          setPendingUpdates(new Set());
        } else if (currentPixel) {
          const [x, y] = currentPixel;
          const key = `${x}-${y}`;
          console.log(`Fallback: Manually updating pixel (${x}, ${y}) after transaction confirmation`);
          
          // Clear pending states
          if (currentType === 'mint') {
            setPendingMints(prev => {
              const newSet = new Set(prev);
              newSet.delete(key);
              console.log(`Fallback: Removed ${key} from pending mints`);
              return newSet;
            });
          } else if (currentType === 'update') {
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
  }, [isTxSuccess, txReceipt, pendingTxHash, pendingTxPixel, pendingTxType, pendingBatchSize, publicClient, getTokenId, fetchTotalMinted, addNotification, isBatchMinting, isBatchUpdating]);
  
  const memoizedPixelGrid = useMemo(() => {
    // Calculate the actual renderable area
    const maxX = Math.min(CANVAS_WIDTH, viewportX + viewportSize);
    const maxY = Math.min(CANVAS_HEIGHT, viewportY + viewportSize);
    const startX = Math.max(0, viewportX);
    const startY = Math.max(0, viewportY);
    
    // Only render pixels that are actually within canvas bounds
    const pixels = [];
    for (let y = startY; y < maxY; y++) {
      for (let x = startX; x < maxX; x++) {
        if (x < CANVAS_WIDTH && y < CANVAS_HEIGHT) {
          const localX = x - viewportX;
          const localY = y - viewportY;
          const i = localY * viewportSize + localX;
          pixels.push({ i, globalX: x, globalY: y, localX, localY });
        }
      }
    }
    
    return pixels;
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
            current: Math.min(prev.current + 1, prev.total), 
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
const isPixelMinted = useCallback((x: number, y: number) => {
  const key = `${x}-${y}`;
  return pixelData[key]?.isMinted || false;
}, [pixelData]);

const getPixelColor = (x: number, y: number) => {
  const key = `${x}-${y}`;
  const pixel = pixelData[key];
  
  // If pixel exists in our data, it's minted - use its color
  if (pixel?.isMinted) {
    return pixel.color;
  }
  
  // Handle Batch Mode and selection preview for unminted pixels
  if (isDrawMode && drawnPixels.has(key)) {
    return drawnPixels.get(key) || selectedColor;
  }
  
  if (!isDrawMode && selectedPixel?.[0] === x && selectedPixel?.[1] === y) {
    return selectedColor;
  }
  
  // Default: unminted pixels are white
  return '#ffffff';
};

const getPixelOwner = useCallback((x: number, y: number) => {
  const key = `${x}-${y}`;
  return pixelData[key]?.owner || null;
}, [pixelData]);
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

  // Zoom functions with mouse position support
  const handleZoomIn = useCallback((mouseWorldX?: number, mouseWorldY?: number) => {
    const newSize = Math.max(MIN_VIEWPORT_SIZE, viewportSize - 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      
      // Use mouse position if provided, otherwise use center
      const centerX = mouseWorldX ?? (viewportX + viewportSize / 2);
      const centerY = mouseWorldY ?? (viewportY + viewportSize / 2);
      
      // Keep the center point (or mouse point), but ensure we don't go outside canvas
      const newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - newSize, centerX - newSize / 2));
      const newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - newSize, centerY - newSize / 2));
      
      setViewportX(Math.floor(newViewportX));
      setViewportY(Math.floor(newViewportY));
    }
  }, [viewportSize, viewportX, viewportY]);
  
  const handleZoomOut = useCallback((mouseWorldX?: number, mouseWorldY?: number) => {
    const newSize = Math.min(MAX_VIEWPORT_SIZE, viewportSize + 5);
    if (newSize !== viewportSize) {
      setViewportSize(newSize);
      
      // Use mouse position if provided, otherwise use center
      const centerX = mouseWorldX ?? (viewportX + viewportSize / 2);
      const centerY = mouseWorldY ?? (viewportY + viewportSize / 2);
      
      // When zooming out, adjust viewport to show as much canvas as possible
      let newViewportX = centerX - newSize / 2;
      let newViewportY = centerY - newSize / 2;
      
      // If the new viewport would extend beyond canvas, adjust it
      if (newViewportX + newSize > CANVAS_WIDTH) {
        newViewportX = CANVAS_WIDTH - newSize;
      }
      if (newViewportY + newSize > CANVAS_HEIGHT) {
        newViewportY = CANVAS_HEIGHT - newSize;
      }
      
      // Ensure we don't go negative
      newViewportX = Math.max(0, newViewportX);
      newViewportY = Math.max(0, newViewportY);
      
      setViewportX(Math.floor(newViewportX));
      setViewportY(Math.floor(newViewportY));
    }
  }, [viewportSize, viewportX, viewportY]);
  
  

  // Handle mouse wheel for zooming with mouse position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get mouse position relative to canvas
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert mouse position to world coordinates
    const worldMouseX = viewportX + (mouseX / PIXEL_SIZE);
    const worldMouseY = viewportY + (mouseY / PIXEL_SIZE);
    
    // More sensitive zoom detection
    if (e.deltaY < -10) { // Scroll up = zoom in
      handleZoomIn(worldMouseX, worldMouseY);
    } else if (e.deltaY > 10) { // Scroll down = zoom out
      handleZoomOut(worldMouseX, worldMouseY);
    }
    
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000);
    }
  }, [hasInteracted, handleZoomIn, handleZoomOut, viewportX, viewportY]);
  // Mouse handlers with reduced sensitivity
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCanvas(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000); // Hide after 1 second
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    const movementThreshold = PIXEL_SIZE * 2;
    
    if (Math.abs(deltaX) < movementThreshold && Math.abs(deltaY) < movementThreshold) {
      return;
    }
    
    // Calculate new viewport position
    let newViewportX = viewportX - Math.floor(deltaX / PIXEL_SIZE);
    let newViewportY = viewportY - Math.floor(deltaY / PIXEL_SIZE);
    
    // Constrain viewport to canvas bounds
    newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - Math.min(viewportSize, CANVAS_WIDTH), newViewportX));
    newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - Math.min(viewportSize, CANVAS_HEIGHT), newViewportY));
    
    if (newViewportX !== viewportX || newViewportY !== viewportY) {
      setViewportX(newViewportX);
      setViewportY(newViewportY);
    }
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };
  
  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const handlePixelClick = (e: React.MouseEvent, x: number, y: number) => {
    e.stopPropagation();
    
    if (isAreaSelectMode) {
      handleAreaSelection(x, y);
    } else if (isDelegateMode) {
      // Handle delegation mode
      if (isBatchDelegate) {
        // In batch delegate mode, use area selection for drag selection
        handleDelegateAreaSelection(x, y);
      } else {
        // Single pixel delegation
        if (canUpdatePixel(x, y)) {
          if (!showDelegateInput) {
            setSelectedPixel([x, y]);
            setShowDelegateInput(true);
          }
        } else {
          addNotification('error', 'Not Owner', 'You can only delegate pixels you own');
        }
      }
    } else if (isDrawMode) {
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

  const handlePixelHover = (x: number, y: number) => {
    if (isAreaSelectMode) {
      handleAreaSelectionMove(x, y);
    } else if (isDelegateMode && isBatchDelegate && isDelegateAreaDragging) {
      handleDelegateAreaMove(x, y);
    }
  };

  // Delegation area selection handlers
  const handleDelegateAreaSelection = (x: number, y: number) => {
    if (!isDelegateAreaDragging) {
      // Start new selection
      setDelegateAreaStart([x, y]);
      setIsDelegateAreaDragging(true);
      setDelegateSelectedArea({ startX: x, startY: x, endX: x, endY: y });
    } else {
      // Finish selection
      setIsDelegateAreaDragging(false);
      if (delegateAreaStart) {
        const [startX, startY] = delegateAreaStart;
        const finalArea = {
          startX: Math.min(startX, x),
          startY: Math.min(startY, y),
          endX: Math.max(startX, x),
          endY: Math.max(startY, y)
        };
        setDelegateSelectedArea(finalArea);
        
        // Auto-select owned pixels in the area
        selectOwnedPixelsInArea(finalArea);
      }
    }
  };

  const handleDelegateAreaMove = (x: number, y: number) => {
    if (isDelegateAreaDragging && delegateAreaStart) {
      const [startX, startY] = delegateAreaStart;
      setDelegateSelectedArea({
        startX: Math.min(startX, x),
        startY: Math.min(startY, y),
        endX: Math.max(startX, x),
        endY: Math.max(startY, y)
      });
    }
  };

  const selectOwnedPixelsInArea = (area: {startX: number, startY: number, endX: number, endY: number}) => {
    const newDrawnPixels = new Map<string, string>();
    let ownedCount = 0;
    
    for (let y = area.startY; y <= area.endY; y++) {
      for (let x = area.startX; x <= area.endX; x++) {
        if (canUpdatePixel(x, y)) {
          const key = `${x}-${y}`;
          newDrawnPixels.set(key, '#4F46E5'); // Blue color for delegation
          ownedCount++;
        }
      }
    }
    
    setDrawnPixels(newDrawnPixels);
    
    if (ownedCount > 0) {
      addNotification('info', 'Pixels Selected', `Selected ${ownedCount} owned pixels for delegation`);
    } else {
      addNotification('info', 'No Owned Pixels', 'No pixels you own were found in the selected area');
    }
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDraggingCanvas(true);
    setLastMousePos({ x: touch.clientX, y: touch.clientY });
    if (!hasInteracted) {
      setHasInteracted(true);
      setTimeout(() => setShowInstructions(false), 1000);
    }
  };

  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCanvas) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastMousePos.x;
    const deltaY = touch.clientY - lastMousePos.y;
    
    const movementThreshold = PIXEL_SIZE * 2;
    
    if (Math.abs(deltaX) < movementThreshold && Math.abs(deltaY) < movementThreshold) {
      return;
    }
    
    // Calculate new viewport position
    let newViewportX = viewportX - Math.floor(deltaX / PIXEL_SIZE);
    let newViewportY = viewportY - Math.floor(deltaY / PIXEL_SIZE);
    
    // Constrain viewport to canvas bounds
    newViewportX = Math.max(0, Math.min(CANVAS_WIDTH - Math.min(viewportSize, CANVAS_WIDTH), newViewportX));
    newViewportY = Math.max(0, Math.min(CANVAS_HEIGHT - Math.min(viewportSize, CANVAS_HEIGHT), newViewportY));
    
    if (newViewportX !== viewportX || newViewportY !== viewportY) {
      setViewportX(newViewportX);
      setViewportY(newViewportY);
    }
    
    setLastMousePos({ x: touch.clientX, y: touch.clientY });
  };
  const handleTouchEnd = () => {
    setIsDraggingCanvas(false);
    setIsPinching(false);
    setLastTouchDistance(0);
  };

  // Helper function to calculate distance between two touches
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle pinch-to-zoom gestures
  const handleTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setLastTouchDistance(distance);
      setIsPinching(true);
      setIsDraggingCanvas(false); // Stop dragging when pinching
    } else if (e.touches.length === 1) {
      handleTouchStart(e);
    }
  };

  const handleTouchMovePinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      
      if (lastTouchDistance > 0) {
        const deltaDistance = distance - lastTouchDistance;
        
        if (Math.abs(deltaDistance) > 5) { // Minimum distance change threshold
          if (deltaDistance > 0) {
            // Pinch out = zoom in
            handleZoomIn();
          } else {
            // Pinch in = zoom out
            handleZoomOut();
          }
        }
      }
      
      setLastTouchDistance(distance);
      
      if (!hasInteracted) {
        setHasInteracted(true);
        setTimeout(() => setShowInstructions(false), 1000);
      }
    } else if (e.touches.length === 1 && !isPinching) {
      handleTouchMove(e);
    }
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
      
      // Show notification
      addNotification('info', 'Mint Started', `Minting pixel at (${x}, ${y})...`);
      
      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType('mint');
      
    } catch (error) {
      console.error("Error minting pixel:", error);
      addNotification('error', 'Mint Failed', `Failed to mint pixel at (${x}, ${y})`);
      
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
      
      // Show notification
      addNotification('info', 'Update Started', `Updating pixel at (${x}, ${y})...`);
      
      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType('update');
      
    } catch (error) {
      console.error("Error updating pixel:", error);
      addNotification('error', 'Update Failed', `Failed to update pixel at (${x}, ${y})`);
      
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
      // Entering Batch Mode - clear selected pixel and other modes
      setSelectedPixel(null);
      setIsDelegateMode(false);
      setShowDelegateInput(false);
      setIsAreaSelectMode(false);
      setSelectedArea(null);
      setAreaSelectionStart(null);
      setIsAreaDragging(false);
    } else {
      // Exiting Batch Mode - clear drawn pixels
      setDrawnPixels(new Map());
    }
  };
  
  // REPLACE your drawing functions with these:
  const addPixelToDrawing = (x: number, y: number) => {
    const key = `${x}-${y}`;
    const isMinted = isPixelMinted(x, y);
    const isPending = isPixelPending(x, y);
    
    // Allow adding if:
    // 1. Pixel is unminted and not pending (for minting)
    // 2. Pixel is minted (we'll check delegation during batch operation)
    // Don't allow if pending
    if (!isPending && ((!isMinted) || isMinted)) {
      setDrawnPixels(prev => {
        const newMap = new Map(prev);
        newMap.set(key, selectedColor); // Store the current selected color
        return newMap;
      });
    } else {
      // Optional: Show a notification for why pixel can't be added
      if (isPending) {
        addNotification('info', 'Pixel Pending', `Pixel (${x}, ${y}) has a pending transaction`);
      }
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

  // Area selection and composition functions
  const handleAreaSelection = (x: number, y: number) => {
    if (!isAreaSelectMode) return;
    
    if (!areaSelectionStart) {
      setAreaSelectionStart([x, y]);
      setIsAreaDragging(true);
    }
  };

  const handleAreaSelectionMove = (x: number, y: number) => {
    if (!isAreaSelectMode || !areaSelectionStart || !isAreaDragging) return;
    
    const [startX, startY] = areaSelectionStart;
    const minX = Math.min(startX, x);
    const maxX = Math.max(startX, x);
    const minY = Math.min(startY, y);
    const maxY = Math.max(startY, y);
    
    setSelectedArea({ startX: minX, startY: minY, endX: maxX, endY: maxY });
  };

  const handleAreaSelectionEnd = () => {
    setIsAreaDragging(false);
  };

  const checkCanCompose = useCallback(async () => {
    if (!selectedArea || !address || !publicClient) return { canCompose: false, reason: "No area selected", ownedCount: 0 };
    
    try {
      // First try to get owned pixels count using getOwnedPixelsInArea if available
      let ownedCount = 0;
      try {
        const ownedPixels = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'getOwnedPixelsInArea',
          args: [BigInt(selectedArea.startX), BigInt(selectedArea.startY), BigInt(selectedArea.endX), BigInt(selectedArea.endY), address],
        }) as bigint[];
        ownedCount = ownedPixels.length;
      } catch (error) {
        // getOwnedPixelsInArea not available, we'll count manually
        console.log('Contract method failed, counting manually:', error);
        ownedCount = 0;
        for (let y = selectedArea.startY; y <= selectedArea.endY; y++) {
          for (let x = selectedArea.startX; x <= selectedArea.endX; x++) {
            const key = `${x}-${y}`;
            const pixel = pixelData[key];
            if (pixel?.isMinted && pixel?.owner?.toLowerCase() === address?.toLowerCase()) {
              console.log(`Found owned pixel at (${x}, ${y}):`, pixel);
              ownedCount++;
            }
          }
        }
        console.log(`Manual count: ${ownedCount} owned pixels`);
      }

      // Simple validation logic
      if (ownedCount < 2) {
        return { canCompose: false, reason: "Need at least 2 owned pixels", ownedCount };
      }

      return { canCompose: true, reason: "", ownedCount };
    } catch (error) {
      console.error('Error checking composition eligibility:', error);
      return { canCompose: false, reason: "Error checking eligibility", ownedCount: 0 };
    }
  }, [selectedArea, address, publicClient, pixelData]);

  const getOwnedPixelsInArea = useCallback(async () => {
    if (!selectedArea || !address || !publicClient) return [];
    
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: 'getOwnedPixelsInArea',
        args: [BigInt(selectedArea.startX), BigInt(selectedArea.startY), BigInt(selectedArea.endX), BigInt(selectedArea.endY), address],
      }) as bigint[];
      
      return result.map(tokenId => Number(tokenId));
    } catch (error) {
      console.error('Error getting owned pixels:', error);
      return [];
    }
  }, [selectedArea, address, publicClient]);

  // Effect to check composition eligibility when area changes
  useEffect(() => {
    const updateCompositionInfo = async () => {
      if (!selectedArea || !address || !publicClient) {
        setCompositionInfo(null);
        setOwnedPixelsInArea([]);
        return;
      }

      try {
        const [compInfo, ownedPixels] = await Promise.all([
          checkCanCompose(),
          getOwnedPixelsInArea()
        ]);
        
        setCompositionInfo(compInfo);
        setOwnedPixelsInArea(ownedPixels);
      } catch (error) {
        console.error('Error updating composition info:', error);
        setCompositionInfo({ canCompose: false, reason: "Error checking area", ownedCount: 0 });
        setOwnedPixelsInArea([]);
      }
    };

    updateCompositionInfo();
  }, [selectedArea, address, publicClient, checkCanCompose, getOwnedPixelsInArea]);

  const composePixels = async () => {
    if (!selectedArea || !isConnected || !address) return;
    
    const { canCompose, reason, ownedCount } = await checkCanCompose();
    if (!canCompose) {
      alert(`Cannot compose area: ${reason}`);
      return;
    }

    try {
      setIsComposing(true);
      
      console.log(`Attempting to compose ${ownedCount} pixels in area (${selectedArea.startX}, ${selectedArea.startY}) to (${selectedArea.endX}, ${selectedArea.endY})`);
      
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "composePixels",
        args: [BigInt(selectedArea.startX), BigInt(selectedArea.startY), BigInt(selectedArea.endX), BigInt(selectedArea.endY)],
      });
      // Set the transaction hash and info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxType('compose');
      setPendingBatchSize(ownedCount);
      console.log("Composition transaction submitted:", txHash);
      addNotification('info', 'Composition Started', `Composing ${ownedCount} pixels into NFT...`);
    
      // Clear selection after successful submission
      setSelectedArea(null);
      setAreaSelectionStart(null);
      setIsAreaSelectMode(false);
      
    } catch (error) {
      console.error("Error composing pixels:", error);
      alert("Error composing pixels. Please make sure you own at least 2 pixels in the selected area and they are not already composed.");
    } finally {
      setIsComposing(false);
    }
  };

  const batchMintPixels = async () => {
    if (!isConnected || !address || drawnPixels.size === 0) return;
    
    // Filter to only include pixels that are NOT minted (unminted pixels only)
    const pixelArray = Array.from(drawnPixels.entries()).filter(([key]) => {
      const [x, y] = key.split('-').map(Number);
      return !isPixelMinted(x, y) && !isPixelPending(x, y); // Only unminted and not pending
    });
    
    if (pixelArray.length === 0) {
      addNotification('error', 'No Valid Pixels', 'No unminted pixels selected for minting');
      return;
    }
    
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
      setPendingTxType('batch');
      setPendingBatchSize(pixelArray.length);
      
      // Show notification
      addNotification('info', 'Batch Mint Started', `Minting ${pixelArray.length} pixels...`);
      
      // Clear drawing
      setDrawnPixels(new Map());
      setIsDrawMode(false);
      
    } catch (error) {
      console.error("Error batch minting pixels:", error);
      addNotification('error', 'Batch Mint Failed', 'Failed to submit batch mint transaction');
      // Remove from pending mints on error
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
  
  const batchUpdatePixels = async () => {
    if (!isConnected || !address || drawnPixels.size === 0 || !authResults || authResults.authorized === 0) return;
    
    // Get authorized pixels only (we already checked authorization)
    const pixelArray: [string, string][] = [];
    
    for (const [key, color] of drawnPixels.entries()) {
      const [x, y] = key.split('-').map(Number);
      const pixelIsPending = pendingMints.has(key) || pendingUpdates.has(key);
      
      if (!isPixelMinted(x, y) || pixelIsPending) continue;
      
      // Check if user owns the pixel or is authorized
      if (canUpdatePixel(x, y)) {
        pixelArray.push([key, color]);
        continue;
      }
      
      // Check delegation (we know some are authorized from authResults)
      try {
        const isAuthorized = await publicClient?.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'isPixelAuthorized',
          args: [BigInt(x), BigInt(y), address as `0x${string}`],
        }) as boolean;
        
        if (isAuthorized) {
          pixelArray.push([key, color]);
        }
      } catch (error) {
        console.error(`Error checking authorization for pixel (${x}, ${y}):`, error);
      }
    }
    
    if (pixelArray.length === 0) {
      addNotification('error', 'No Valid Pixels', 'No authorized pixels found');
      return;
    }
    
    try {
      setIsBatchUpdating(true);
      
      const xCoords = pixelArray.map(([key]) => BigInt(key.split('-')[0]));
      const yCoords = pixelArray.map(([key]) => BigInt(key.split('-')[1]));
      const colors = pixelArray.map(([, color]) => color);
      
      // Add all pixels to pending updates
      pixelArray.forEach(([key]) => {
        setPendingUpdates(prev => new Set(prev).add(key));
      });
      
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "batchUpdateColor",
        args: [xCoords, yCoords, colors],
      });
      
      console.log("Batch update transaction submitted:", txHash);
      setPendingTxHash(txHash);
      setPendingTxType('batch');
      setPendingBatchSize(pixelArray.length);
      
      // Show notification
      addNotification('info', 'Batch Update Started', `Updating ${pixelArray.length} pixels...`);
      
      // Clear drawing
      setDrawnPixels(new Map());
      setIsDrawMode(false);
      
    } catch (error) {
      console.error("Error batch updating pixels:", error);
      addNotification('error', 'Batch Update Failed', 'Failed to submit batch update transaction');
      // Remove from pending updates on error
      pixelArray.forEach(([key]) => {
        setPendingUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      });
    } finally {
      setIsBatchUpdating(false);
    }
  };
  
  // Delegation functions
  const delegatePixel = async (x: number, y: number, toAddress: string) => {
    if (!isConnected || !address) {
      addNotification('error', 'Not Connected', 'Please connect your wallet first');
      return;
    }

    // Validate address
    if (!toAddress || toAddress.length !== 42 || !toAddress.startsWith('0x')) {
      addNotification('error', 'Invalid Address', 'Please enter a valid Ethereum address');
      return;
    }

    const pixelOwner = getPixelOwner(x, y);
    if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
      addNotification('error', 'Not Owner', 'You do not own this pixel');
      return;
    }

    setIsDelegating(true);

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: 'approvePixel',
        args: [BigInt(x), BigInt(y), toAddress as `0x${string}`],
      });

      setPendingTxHash(hash);
      setPendingTxPixel([x, y]);
      setPendingTxType('delegation');

      addNotification('info', 'Delegation Submitted', `Delegating pixel (${x}, ${y}) to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`, hash);
      
    } catch (error: Error | unknown) {
      console.error('Error delegating pixel:', error);
      const errorMessage = (error as Error)?.message?.includes('User rejected') 
        ? 'Transaction rejected by user' 
        : 'Failed to delegate pixel';
      addNotification('error', 'Delegation Failed', errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };

  // Multi-address delegation - fallback to multiple transactions until contract is updated
  const batchDelegatePixelsMultiSingleTx = async (pixels: Array<[number, number]>, toAddresses: string[]) => {
    if (!isConnected || !address) {
      addNotification('error', 'Not Connected', 'Please connect your wallet first');
      return;
    }

    if (toAddresses.length === 0) {
      addNotification('error', 'No Addresses', 'Please enter at least one address');
      return;
    }

    // Validate all addresses
    for (const addr of toAddresses) {
      if (!addr || addr.length !== 42 || !addr.startsWith('0x')) {
        addNotification('error', 'Invalid Address', `Invalid address: ${addr}`);
        return;
      }
    }

    if (pixels.length === 0) {
      addNotification('error', 'No Pixels', 'Please select pixels to delegate');
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification('error', 'Not Owner', `You do not own pixel (${x}, ${y})`);
        return;
      }
    }

    setIsDelegating(true);

    try {
      const xCoords = pixels.map(([x]) => BigInt(x));
      const yCoords = pixels.map(([, y]) => BigInt(y));
      
      // Try the new single-transaction function first
      try {
        const operators = toAddresses.map(addr => addr as `0x${string}`);
        
        addNotification('info', 'Single Transaction Multi-Delegation', `Approving ${pixels.length} pixels to ${toAddresses.length} addresses in one transaction...`);
        
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'batchApproveMultipleAddresses',
          args: [xCoords, yCoords, operators],
        });

        setPendingTxHash(hash);
        setPendingTxType('delegation');
        setPendingBatchSize(pixels.length * toAddresses.length);

        addNotification('success', 'Multi-Delegation Submitted', `Single transaction: ${pixels.length} pixels → ${toAddresses.length} addresses`, hash);
        
      } catch (contractError) {
        console.log('New contract function not available, falling back to multiple transactions:', contractError);
        
        // Fallback to multiple transactions
        addNotification('info', 'Multi-Delegation Fallback', `Using multiple transactions for ${toAddresses.length} addresses...`);
        
        let lastHash: `0x${string}` | undefined;
        
        for (let i = 0; i < toAddresses.length; i++) {
          const toAddress = toAddresses[i];
          
          const hash = await writeContractAsync({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: 'batchApprove',
            args: [xCoords, yCoords, toAddress as `0x${string}`],
          });

          lastHash = hash;
          addNotification('info', `Delegation ${i + 1}/${toAddresses.length}`, `Approved for ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`, hash);
        }

        if (lastHash) {
          setPendingTxHash(lastHash);
          setPendingTxType('delegation');
          setPendingBatchSize(pixels.length * toAddresses.length);
        }
      }
      
    } catch (error: Error | unknown) {
      console.error('Error multi-delegating:', error);
      const errorMessage = (error as Error)?.message?.includes('User rejected') 
        ? 'Transaction rejected by user' 
        : 'Failed to delegate pixels';
      addNotification('error', 'Multi-Delegation Failed', errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };



  const batchDelegatePixels = async (pixels: Array<[number, number]>, toAddress: string) => {
    if (!isConnected || !address) {
      addNotification('error', 'Not Connected', 'Please connect your wallet first');
      return;
    }

    if (!toAddress || toAddress.length !== 42 || !toAddress.startsWith('0x')) {
      addNotification('error', 'Invalid Address', 'Please enter a valid Ethereum address');
      return;
    }

    if (pixels.length === 0) {
      addNotification('error', 'No Pixels', 'Please select pixels to delegate');
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification('error', 'Not Owner', `You do not own pixel (${x}, ${y})`);
        return;
      }
    }

    setIsDelegating(true);

    try {
      const xCoords = pixels.map(([x]) => BigInt(x));
      const yCoords = pixels.map(([, y]) => BigInt(y));

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: 'batchApprove',
        args: [xCoords, yCoords, toAddress as `0x${string}`],
      });

      setPendingTxHash(hash);
      setPendingBatchSize(pixels.length);
      setPendingTxType('delegation');

      addNotification('info', 'Batch Delegation Submitted', `Delegating ${pixels.length} pixels to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`, hash);
      
    } catch (error: Error | unknown) {
      console.error('Error batch delegating pixels:', error);
      const errorMessage = (error as Error)?.message?.includes('User rejected') 
        ? 'Transaction rejected by user' 
        : 'Failed to delegate pixels';
      addNotification('error', 'Batch Delegation Failed', errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };

  const canUpdatePixel = useCallback((x: number, y: number) => {
    if (!isConnected || !address) return false;
    const key = `${x}-${y}`;
    const owner = pixelData[key]?.owner || null;
    return owner && owner.toLowerCase() === address.toLowerCase();
  }, [isConnected, address, pixelData]);

  // Memoize drawn pixels keys to only trigger auth check when they actually change
  const drawnPixelKeys = useMemo(() => {
    return Array.from(drawnPixels.keys());
  }, [drawnPixels]);

  // Check authorization for all drawn pixels
  const checkBatchAuthorization = useCallback(async () => {
    if (!isConnected || !address || !publicClient || drawnPixelKeys.length === 0) {
      setAuthResults(null);
      return;
    }

    setIsCheckingAuth(true);
    
    const candidatePixels: string[] = [];
    for (const key of drawnPixelKeys) {
      // Access pixelData directly
      const pixelIsMinted = pixelData[key]?.isMinted || false;
      const pixelIsPending = pendingMints.has(key) || pendingUpdates.has(key);
      
      if (pixelIsMinted && !pixelIsPending) {
        candidatePixels.push(key);
      }
    }

    if (candidatePixels.length === 0) {
      setAuthResults(null);
      setIsCheckingAuth(false);
      return;
    }

    let authorized = 0;
    let unauthorized = 0;

    for (const key of candidatePixels) {
      const [x, y] = key.split('-').map(Number);
      
      // Check if user owns the pixel (access pixelData directly)
      const owner = pixelData[key]?.owner || null;
      const isOwner = owner && owner.toLowerCase() === address?.toLowerCase();
      if (isOwner) {
        authorized++;
        continue;
      }
      
      // Check delegation
      try {
        const isAuthorized = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: 'isPixelAuthorized',
          args: [BigInt(x), BigInt(y), address as `0x${string}`],
        }) as boolean;
        
        if (isAuthorized) {
          authorized++;
        } else {
          unauthorized++;
        }
      } catch (error) {
        console.error(`Error checking authorization for pixel (${x}, ${y}):`, error);
        unauthorized++;
      }
    }

    setAuthResults({ authorized, unauthorized });
    setIsCheckingAuth(false);
  }, [isConnected, address, publicClient, drawnPixelKeys, pendingMints, pendingUpdates]);

  // Check authorization whenever drawn pixels change
  useEffect(() => {
    if (isDrawMode && drawnPixelKeys.length > 0) {
      const timeoutId = setTimeout(() => {
        checkBatchAuthorization();
      }, 500); // Debounce to avoid too many calls
      
      return () => clearTimeout(timeoutId);
    } else {
      setAuthResults(null);
    }
  }, [isDrawMode, drawnPixelKeys, checkBatchAuthorization]);







  // Check authorization when pixel is selected (only on pixel selection change)
  useEffect(() => {
    if (!selectedPixel || !isConnected || !publicClient || !address) {
      setPixelAuthStatus(null);
      return;
    }

    const [x, y] = selectedPixel;
    
    // Check if user owns the pixel (get current data at the time of selection)
    const key = `${x}-${y}`;
    const owner = pixelData[key]?.owner || null;
    const isOwner = owner && owner.toLowerCase() === address.toLowerCase();
    
    // Set initial state
    setPixelAuthStatus({
      x,
      y,
      isOwner: Boolean(isOwner),
      isAuthorized: Boolean(isOwner), // Owner is always authorized
      isChecking: !Boolean(isOwner) // Only check contract if not owner
    });

    // If not owner, check delegation
    if (!isOwner) {
      const checkDelegation = async () => {
        try {
          const isAuthorized = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: 'isPixelAuthorized',
            args: [BigInt(x), BigInt(y), address as `0x${string}`],
          }) as boolean;
          
          // Only update if this is still the selected pixel
          setPixelAuthStatus(prev => {
            if (prev && prev.x === x && prev.y === y) {
              return {
                ...prev,
                isAuthorized,
                isChecking: false
              };
            }
            return prev;
          });
        } catch (error) {
          console.error('Error checking pixel authorization:', error);
          setPixelAuthStatus(prev => {
            if (prev && prev.x === x && prev.y === y) {
              return {
                ...prev,
                isAuthorized: false,
                isChecking: false
              };
            }
            return prev;
          });
        }
      };

      checkDelegation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPixel, isConnected, publicClient, address]); // Removed pixelData dependency to prevent infinite refresh

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
      <div className="w-full h-full bg-gray-800 relative overflow-hidden">
                {/* Header - Fixed at top with high z-index */}
        <div className="fixed top-0 left-0 right-0 z-40 px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex justify-between items-center gap-1 sm:gap-2">
            {/* Left side  */}
            <div className="flex items-center gap-2 sm:gap-4">
            </div>
            
            {/* Right side controls */}
            <div className="relative flex items-center gap-1 sm:gap-2 flex-wrap">
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

              {/* Batch Mode Button */}
              <button
                onClick={toggleDrawMode}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  isDrawMode 
                    ? 'bg-orange-600 hover:bg-orange-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={isDrawMode ? "Exit Batch Mode" : "Enter Batch Mode"}
              >
                {isDrawMode ? '🎨' : '✏️'}
              </button>

              {/* Area Select Mode Button */}
              <button
                onClick={() => {
                  setIsAreaSelectMode(!isAreaSelectMode);
                  if (!isAreaSelectMode) {
                    // Entering area select mode - clear other modes and selections
                    setIsDrawMode(false);
                    setSelectedPixel(null);
                    setDrawnPixels(new Map());
                    setIsDelegateMode(false);
                    setShowDelegateInput(false);
                  } else {
                    // Exiting area select mode - clear selections
                    setSelectedArea(null);
                    setAreaSelectionStart(null);
                    setIsAreaDragging(false);
                  }
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  isAreaSelectMode 
                    ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={isAreaSelectMode ? "Exit Area Select Mode" : "Enter Area Select Mode"}
              >
                {isAreaSelectMode ? '🔲' : '□'}
              </button>

              {/* Delegate Mode Button */}
              <button
                onClick={() => {
                  setIsDelegateMode(!isDelegateMode);
                  if (!isDelegateMode) {
                    // Entering delegate mode - clear other modes
                    setIsDrawMode(false);
                    setIsAreaSelectMode(false);
                    setSelectedPixel(null);
                    setDrawnPixels(new Map());
                    setSelectedArea(null);
                    setAreaSelectionStart(null);
                    setIsAreaDragging(false);
                  } else {
                    // Exiting delegate mode - clear delegate selections
                    setShowDelegateInput(false);
                    setDelegateAddress('');
                    setIsBatchDelegate(false);
                    setDelegateSelectedArea(null);
                    setDelegateAreaStart(null);
                    setIsDelegateAreaDragging(false);
                  }
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  isDelegateMode 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={isDelegateMode ? "Exit Delegate Mode" : "Enter Delegate Mode"}
                disabled={!isConnected}
              >
                {isDelegateMode ? '👥' : '🤝'}
              </button>

              {/* Batch Mode Controls - Stack on mobile */}
              {isDrawMode && drawnPixels.size > 0 && (() => {
                const drawnPixelArray = Array.from(drawnPixels.keys());
                
                const unmintedCount = drawnPixelArray.filter(key => {
                  const [x, y] = key.split('-').map(Number);
                  return !isPixelMinted(x, y) && !isPixelPending(x, y);
                }).length;
                
                const ownedCount = drawnPixelArray.filter(key => {
                  const [x, y] = key.split('-').map(Number);
                  return isPixelMinted(x, y) && canUpdatePixel(x, y) && !isPixelPending(x, y);
                }).length;

                const pendingCount = drawnPixelArray.filter(key => {
                  const [x, y] = key.split('-').map(Number);
                  return isPixelPending(x, y);
                }).length;

                const otherCount = drawnPixels.size - unmintedCount - ownedCount - pendingCount;

                return (
                  <div className="flex items-center gap-1 bg-orange-800 rounded-lg px-1 sm:px-2 py-1">
                    <span className="text-xs text-orange-200 hidden sm:inline">
                      {drawnPixels.size} pixels
                    </span>
                    <span className="text-xs text-orange-200 sm:hidden">{drawnPixels.size}</span>
                    
                    {/* Show breakdown on hover/larger screens */}
                    <div className="hidden sm:block text-xs text-orange-300">
                      {unmintedCount > 0 && `${unmintedCount} new`}
                      {unmintedCount > 0 && ownedCount > 0 && ', '}
                      {ownedCount > 0 && `${ownedCount} owned`}
                      {pendingCount > 0 && `, ${pendingCount} pending`}
                      {otherCount > 0 && `, ${otherCount} other`}
                    </div>
                    
                    {/* Batch Mint Button - only show if there are unminted pixels */}
                    {unmintedCount > 0 && (
                      <button
                        onClick={batchMintPixels}
                        className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                        disabled={isBatchMinting || isBatchUpdating}
                        title={`Mint ${unmintedCount} unminted pixels`}
                      >
                        {isBatchMinting ? '⏳' : `⚡${unmintedCount}`}
                      </button>
                    )}
                    
                    {/* Batch Update Button - only show if there are owned pixels */}
                    {ownedCount > 0 && (
                      <button
                        onClick={batchUpdatePixels}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                        disabled={isBatchMinting || isBatchUpdating}
                        title={`Update ${ownedCount} owned pixels`}
                      >
                        {isBatchUpdating ? '⏳' : `🎨${ownedCount}`}
                      </button>
                    )}
                    
                    <button
                      onClick={clearDrawing}
                      className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-2 py-1 rounded text-xs transition-colors"
                      title="Clear Selection"
                      disabled={isBatchMinting || isBatchUpdating}
                    >
                      ✕
                    </button>
                  </div>
                );
              })()}

              {/* Delegate Mode Controls */}
              {isDelegateMode && (
                <div className="absolute top-full right-0 mt-2 flex flex-col gap-2 bg-blue-800 rounded-lg px-2 py-2 shadow-lg z-50 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-200">Delegate Mode</span>
                    <button
                      onClick={() => {
                        const newBatchMode = !isBatchDelegate;
                        setIsBatchDelegate(newBatchMode);
                        setDrawnPixels(new Map());
                        setSelectedPixel(null);
                        setShowDelegateInput(false);
                        setDelegateSelectedArea(null);
                        setDelegateAreaStart(null);
                        setIsDelegateAreaDragging(false);
                        
                        if (newBatchMode) {
                          addNotification('info', 'Batch Delegation Mode', 'Click and drag to select an area, or click individual pixels');
                        } else {
                          addNotification('info', 'Single Delegation Mode', 'Click an owned pixel to delegate it to a friend');
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isBatchDelegate 
                          ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                      title={isBatchDelegate ? "Switch to Single Delegate" : "Switch to Batch Delegate"}
                    >
                      {isBatchDelegate ? '📦 Batch' : '📦 Single'}
                    </button>
                  </div>
                  
                  {/* Address Input Mode Toggle */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <button
                      onClick={() => setIsMultiAddressMode(!isMultiAddressMode)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        isMultiAddressMode 
                          ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      {isMultiAddressMode ? '📋 Multi-Address' : '📋 Single Address'}
                    </button>
                    

                  </div>

                  {/* Address Input */}
                  <div className="flex flex-col gap-1">
                    {isMultiAddressMode ? (
                      <div className="space-y-1">
                        <textarea
                          placeholder="Enter addresses (one per line or paste multiple)&#10;0x123...&#10;0x456..."
                          value={delegateAddresses.join('\n')}
                          onChange={(e) => {
                            const input = e.target.value;
                            // First try splitting by line breaks
                            let addresses = input.split('\n').filter(addr => addr.trim());
                            
                            // If only one line but looks like multiple addresses concatenated
                            if (addresses.length === 1 && addresses[0].length > 42) {
                              // Split by "0x" and rebuild addresses
                              const parts = addresses[0].split('0x').filter(part => part.length > 0);
                              addresses = parts.map(part => '0x' + part.substring(0, 40)).filter(addr => addr.length === 42);
                            }
                            
                            setDelegateAddresses(addresses);
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-blue-400 focus:outline-none resize-none h-20"
                          rows={4}
                        />
                        <div className="text-xs text-blue-200">
                          {delegateAddresses.length} address{delegateAddresses.length !== 1 ? 'es' : ''} entered
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Friend's address (0x...)"
                        value={delegateAddress}
                        onChange={(e) => setDelegateAddress(e.target.value)}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:border-blue-400 focus:outline-none"
                      />
                    )}
                  </div>
                  
                  {/* Batch delegate controls */}
                  {isBatchDelegate && drawnPixels.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-200">
                        {drawnPixels.size} pixels selected
                      </span>
                      <button
                        onClick={() => {
                          const pixels = Array.from(drawnPixels.keys()).map(key => {
                            const [x, y] = key.split('-').map(Number);
                            return [x, y] as [number, number];
                          });

                          if (isMultiAddressMode) {
                            if (delegateAddresses.length > 0) {
                              batchDelegatePixelsMultiSingleTx(pixels, delegateAddresses);
                            } else {
                              addNotification('error', 'Missing Addresses', 'Please enter at least one address');
                            }
                          } else {
                            if (delegateAddress) {
                              batchDelegatePixels(pixels, delegateAddress);
                            } else {
                              addNotification('error', 'Missing Address', 'Please enter friend\'s address');
                            }
                          }
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
                        disabled={isDelegating || (!delegateAddress && !isMultiAddressMode) || (isMultiAddressMode && delegateAddresses.length === 0)}
                      >
                        {isDelegating ? '⏳' : isMultiAddressMode ? `Delegate to ${delegateAddresses.length}` : `Delegate ${drawnPixels.size}`}
                      </button>
                      <button
                        onClick={() => setDrawnPixels(new Map())}
                        className="bg-red-600 hover:bg-red-500 text-white px-1 py-1 rounded text-xs transition-colors"
                        title="Clear Selection"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {/* Single delegate control */}
                  {!isBatchDelegate && selectedPixel && showDelegateInput && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-200">
                        Pixel ({selectedPixel[0]}, {selectedPixel[1]})
                      </span>
                      <button
                        onClick={() => {
                          if (selectedPixel) {
                            if (isMultiAddressMode) {
                              if (delegateAddresses.length > 0) {
                                batchDelegatePixelsMultiSingleTx([selectedPixel], delegateAddresses);
                              } else {
                                addNotification('error', 'Missing Addresses', 'Please enter at least one address');
                              }
                            } else {
                              if (delegateAddress) {
                                delegatePixel(selectedPixel[0], selectedPixel[1], delegateAddress);
                              } else {
                                addNotification('error', 'Missing Address', 'Please enter friend\'s address');
                              }
                            }
                            setShowDelegateInput(false);
                            setSelectedPixel(null);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors"
                        disabled={isDelegating || (!delegateAddress && !isMultiAddressMode) || (isMultiAddressMode && delegateAddresses.length === 0)}
                      >
                        {isDelegating ? '⏳' : isMultiAddressMode ? `Delegate to ${delegateAddresses.length}` : 'Delegate'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDelegateInput(false);
                          setSelectedPixel(null);
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white px-1 py-1 rounded text-xs transition-colors"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {isBatchDelegate && (
                    <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-30 p-2 rounded">
                      <div className="font-medium mb-1">📦 Batch Delegation Mode Active</div>
                      <div>• Click and drag to select an area of pixels</div>
                      <div>• Only your owned pixels will be selected (highlighted in blue)</div>
                      <div>• {isMultiAddressMode ? 'Enter multiple addresses (one per line) to delegate to all' : 'Enter friend\'s address and click "Delegate" to approve all'}</div>
                      <div>• {isMultiAddressMode ? 'Multi-address mode: all pixels will be delegated to ALL entered addresses in one transaction' : 'Single-address mode: all pixels will be delegated to ONE address'}</div>
                    </div>
                  )}
                  
                  {!isBatchDelegate && !showDelegateInput && (
                    <div className="text-xs text-blue-300 bg-blue-900 bg-opacity-30 p-2 rounded">
                      <div className="font-medium mb-1">🤝 Single Delegation Mode</div>
                      <div>• Click an owned pixel to delegate it to a friend</div>
                      <div>• {isMultiAddressMode ? 'Enter multiple addresses to delegate to all' : 'Enter friend\'s address to approve access'}</div>
                      <div>• {isMultiAddressMode ? 'Multi-address mode: pixel will be delegated to ALL entered addresses' : 'Single-address mode: pixel will be delegated to ONE address'}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Zoom Controls - Compact on mobile */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-1 sm:px-2 py-1">
                <button 
                  onClick={() => handleZoomIn()}
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
                  onClick={() => handleZoomOut()}
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
            cursor: isDraggingCanvas ? 'grabbing' : 'default',
            touchAction: 'none' // Prevent default touch behaviors
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStartPinch}
          onTouchMove={handleTouchMovePinch}
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
            <div className="absolute top-20 left-4 bg-black bg-opacity-80 text-white text-xs px-4 py-3 rounded-lg z-10 min-w-[200px]">
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
            className="absolute inset-0 overflow-hidden"
          >
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{
                padding: screenSize.width < 768 ? '8px' : '16px',
                minHeight: '0' // Allow flex shrinking
              }}
            >
              <div 
                className="grid bg-gray-200"
                style={{ 
                  gridTemplateColumns: `repeat(${Math.min(viewportSize, CANVAS_WIDTH - viewportX)}, 1fr)`,
                  gridTemplateRows: `repeat(${Math.min(viewportSize, CANVAS_HEIGHT - viewportY)}, 1fr)`,
                  gap: '1px',
                  padding: '1px',
                  // Dynamic sizing based on zoom level
                  // When zoomed out (showing full canvas), maintain square aspect ratio
                  // When zoomed in, fill available space
                  width: viewportSize >= MAX_VIEWPORT_SIZE 
                    ? // Full canvas view - use smaller dimension to fit square
                      screenSize.width < 768
                        ? 'min(calc(100vw - 16px), calc(100vh - 16px))'
                        : showSidebar
                          ? 'min(calc(100vw - 340px), calc(100vh - 32px))'
                          : 'min(calc(100vw - 32px), calc(100vh - 32px))'
                    : // Zoomed in view - fill available space
                      screenSize.width < 768
                        ? 'calc(100vw - 16px)'
                        : showSidebar 
                          ? 'calc(100vw - 340px)'
                          : 'calc(100vw - 32px)',
                  height: viewportSize >= MAX_VIEWPORT_SIZE
                    ? // Full canvas view - use smaller dimension to fit square
                      screenSize.width < 768
                        ? 'min(calc(100vw - 16px), calc(100vh - 16px))'
                        : showSidebar
                          ? 'min(calc(100vw - 340px), calc(100vh - 32px))'
                          : 'min(calc(100vw - 32px), calc(100vh - 32px))'
                    : // Zoomed in view - fill available space
                      screenSize.width < 768
                        ? 'calc(100vh - 16px)'
                        : 'calc(100vh - 32px)',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
              >
                {memoizedPixelGrid.map(({ globalX, globalY }) => {
                  const isSelected = selectedPixel?.[0] === globalX && selectedPixel?.[1] === globalY;
                  const isHighlighted = highlightedPixel?.[0] === globalX && highlightedPixel?.[1] === globalY;
                  const isMinted = isPixelMinted(globalX, globalY);
                  const isPending = isPixelPending(globalX, globalY);
                  const pixelColor = getPixelColor(globalX, globalY);
                  const isDrawn = isDrawMode && drawnPixels.has(`${globalX}-${globalY}`);
                  
                  // Check if pixel is in selected area (composition)
                  const isInSelectedArea = selectedArea && 
                    globalX >= selectedArea.startX && globalX <= selectedArea.endX &&
                    globalY >= selectedArea.startY && globalY <= selectedArea.endY;
                  
                  // Check if pixel is owned by user in the selected area (composition)
                  const isOwnedInArea = isInSelectedArea && ownedPixelsInArea.includes(getTokenId(globalX, globalY));
                  
                  // Check if pixel is in delegation area selection
                  const isInDelegateArea = delegateSelectedArea && 
                    globalX >= delegateSelectedArea.startX && globalX <= delegateSelectedArea.endX &&
                    globalY >= delegateSelectedArea.startY && globalY <= delegateSelectedArea.endY;
                  
                  // Check if pixel is owned and selected for delegation
                  const isOwnedForDelegation = isInDelegateArea && canUpdatePixel(globalX, globalY);
                  
                  // Determine border style based on state
                  let borderStyle = 'none';
                  if (isHighlighted) {
                    borderStyle = '2px solid #f59e0b';
                  } else if (isSelected) {
                    borderStyle = '2px solid #3b82f6';
                  } else if (isOwnedForDelegation) {
                    borderStyle = '2px solid #4F46E5'; // Blue for owned pixels in delegation area
                  } else if (isInDelegateArea) {
                    borderStyle = '2px solid #6B7280'; // Gray for delegation area selection
                  } else if (isOwnedInArea) {
                    borderStyle = '2px solid #10b981'; // Green for owned pixels in area
                  } else if (isInSelectedArea) {
                    borderStyle = '2px solid #a855f7'; // Purple for area selection
                  }          
                  
                  return (
                    <div
                      key={`${globalX}-${globalY}`}
                      onClick={(e) => handlePixelClick(e, globalX, globalY)}
                      onMouseEnter={() => handlePixelHover(globalX, globalY)}
                      onMouseUp={handleAreaSelectionEnd}
                      className={`
                        relative cursor-crosshair transition-all duration-150 hover:opacity-80 hover:scale-105 hover:z-10
                        ${isPending ? "animate-pulse" : ""}
                        ${isDrawn ? "ring-2 ring-orange-400" : ""} 
                        ${isHighlighted ? "animate-bounce" : ""}
                        ${isOwnedForDelegation ? "ring-2 ring-blue-500" : isInDelegateArea ? "ring-2 ring-gray-400" : ""}
                        ${isOwnedInArea ? "ring-2 ring-green-400" : isInSelectedArea ? "ring-2 ring-purple-400" : ""}
                      `}
                      style={{ 
                        backgroundColor: pixelColor,
                        border: borderStyle,
                        aspectRatio: '1 / 1', // Force each pixel to be square
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

            {/* Area Selection Info */}
            {isAreaSelectMode && (
              <div className="p-6 border-b border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-purple-400">
                  🔲 Area Composition Mode
                </h3>
                
                {selectedArea ? (
                  <>
                    <div className="space-y-2 mb-4">
                      <div className="text-sm">
                        <span className="text-gray-400">Selected Area:</span>{' '}
                        <span className="text-purple-300">
                          ({selectedArea.startX}, {selectedArea.startY}) to ({selectedArea.endX}, {selectedArea.endY})
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Total Area:</span>{' '}
                        <span className="text-purple-300">
                          {selectedArea.endX - selectedArea.startX + 1} × {selectedArea.endY - selectedArea.startY + 1} = {(selectedArea.endX - selectedArea.startX + 1) * (selectedArea.endY - selectedArea.startY + 1)} pixels
                        </span>
                      </div>
                      {compositionInfo && (
                        <div className="text-sm">
                          <span className="text-gray-400">Your Pixels:</span>{' '}
                          <span className={`font-medium ${compositionInfo.canCompose ? 'text-green-400' : 'text-yellow-400'}`}>
                            {compositionInfo.ownedCount} pixels
                          </span>
                          {compositionInfo.ownedCount > 0 && (
                            <span className="text-gray-500 text-xs ml-2">
                              (will compose these only)
                            </span>
                          )}
                        </div>
                      )}
                      {compositionInfo && !compositionInfo.canCompose && compositionInfo.ownedCount < 2 && (
                        <div className="text-sm p-2 bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded">
                          <span className="text-yellow-400">ℹ️ {compositionInfo.reason}</span>
                        </div>
                      )}
                    </div>

                    {isConnected ? (
                      <div className="space-y-2">
                        <button 
                          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                          onClick={composePixels}
                          disabled={isComposing || !compositionInfo?.canCompose}
                        >
                          {isComposing ? (
                            <>
                              <span className="animate-spin">⏳</span>
                              Composing {compositionInfo?.ownedCount || 0} pixels...
                            </>
                          ) : (
                            <>
                              <span>🔧</span>
                              Compose {compositionInfo?.ownedCount || 0} Pixels
                            </>
                          )}
                        </button>
                        
                        <button 
                          className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                          onClick={() => {
                            setSelectedArea(null);
                            setAreaSelectionStart(null);
                            setIsAreaDragging(false);
                          }}
                        >
                          <span>❌</span>
                          Clear Selection
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-4">
                        Connect wallet to compose pixels
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-400 text-sm space-y-2">
                    <p>Select any area - small or large! The system automatically finds your pixels and composes them into one NFT.</p>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 border-2 border-purple-400 rounded-sm"></div>
                      <span>Selected area</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 border-2 border-green-400 rounded-sm"></div>
                      <span>Your pixels (will be composed)</span>
                    </div>
                    <p className="text-xs text-green-300">💡 No limits - compose 2 pixels or 2000!</p>
                  </div>
                )}
              </div>
            )}

            {/* Selected Pixel Info - Modified to handle batch mode */}
            {(selectedPixel || (isDrawMode && drawnPixels.size > 0)) && !isAreaSelectMode && (
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
                  {/* Show batch mint info when in Batch Mode without selected pixel */}
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
                      {/* Batch mode info when no specific pixel is selected but pixels are drawn */}
                      {!selectedPixel && isDrawMode && drawnPixels.size > 0 && (() => {
                        const drawnPixelArray = Array.from(drawnPixels.keys());
                        
                        const unmintedPixels = drawnPixelArray.filter(key => {
                          const [x, y] = key.split('-').map(Number);
                          return !isPixelMinted(x, y) && !isPixelPending(x, y);
                        });
                        
                        const ownedPixels = drawnPixelArray.filter(key => {
                          const [x, y] = key.split('-').map(Number);
                          return isPixelMinted(x, y) && canUpdatePixel(x, y) && !isPixelPending(x, y);
                        });

                        const pendingPixels = drawnPixelArray.filter(key => {
                          const [x, y] = key.split('-').map(Number);
                          return isPixelPending(x, y);
                        });

                        // For minted pixels that user doesn't own, show as "potentially updatable" 
                        // since they might have delegation (checked during actual update)
                        const mintedNotOwnedPixels = drawnPixelArray.filter(key => {
                          const [x, y] = key.split('-').map(Number);
                          return isPixelMinted(x, y) && !canUpdatePixel(x, y) && !isPixelPending(x, y);
                        });

                        // Total updateable pixels = owned + potentially delegated
                        const totalUpdateablePixels = ownedPixels.length + mintedNotOwnedPixels.length;

                        return (
                          <>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                              <span className="text-orange-400 font-medium">Batch Mode - {drawnPixels.size} pixels selected</span>
                            </div>
                            
                            {/* Breakdown of selected pixels */}
                            <div className="space-y-2 mb-4">
                              {unmintedPixels.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                                  <span className="text-green-400">{unmintedPixels.length} unminted (ready to mint)</span>
                                </div>
                              )}

                              {ownedPixels.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                  <span className="text-blue-400">{ownedPixels.length} owned (ready to update)</span>
                                </div>
                              )}
                              {mintedNotOwnedPixels.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                                  <span className="text-purple-400">{mintedNotOwnedPixels.length} minted (check delegation)</span>
                                </div>
                              )}
                              {pendingPixels.length > 0 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-3 h-3 bg-orange-500 rounded animate-pulse"></div>
                                  <span className="text-orange-400">{pendingPixels.length} pending transactions</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded mb-4">
                              <span className="text-sm text-gray-400">Selected color:</span>
                              <div 
                                className="w-6 h-6 border border-gray-600 rounded"
                                style={{ backgroundColor: selectedColor }}
                              ></div>
                              <span className="text-xs text-gray-300 font-mono">{selectedColor}</span>
                            </div>
                            
                            <div className="space-y-2">
                              {/* Batch Mint Button */}
                              {unmintedPixels.length > 0 && (
                                <button 
                                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                                  onClick={batchMintPixels}
                                  disabled={isBatchMinting || isBatchUpdating}
                                >
                                  {isBatchMinting ? (
                                    <>
                                      <span className="animate-spin">⏳</span>
                                      Minting {unmintedPixels.length} pixels...
                                    </>
                                  ) : (
                                    <>
                                      <span>⚡</span>
                                      Mint {unmintedPixels.length} Pixels
                                    </>
                                  )}
                                </button>
                              )}
                              
                              {/* Batch Update Button */}
                              {totalUpdateablePixels > 0 && (
                                <button 
                                  className={`w-full px-4 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                                    isCheckingAuth 
                                      ? 'bg-yellow-600 cursor-wait' 
                                      : authResults && authResults.authorized > 0
                                        ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white'
                                        : 'bg-red-600 cursor-not-allowed text-white'
                                  }`}
                                  onClick={batchUpdatePixels}
                                  disabled={isBatchMinting || isBatchUpdating || isCheckingAuth || !authResults || authResults.authorized === 0}
                                >
                                  {isBatchUpdating ? (
                                    <>
                                      <span className="animate-spin">⏳</span>
                                      Updating {authResults?.authorized || 0} pixels...
                                    </>
                                  ) : isCheckingAuth ? (
                                    <>
                                      <span className="animate-spin">🔍</span>
                                      Checking Authorization...
                                    </>
                                  ) : authResults && authResults.authorized > 0 ? (
                                    <>
                                      <span>🎨</span>
                                      Update {authResults.authorized} Pixel{authResults.authorized > 1 ? 's' : ''}
                                      {authResults.unauthorized > 0 && ` (${authResults.unauthorized} not authorized)`}
                                    </>
                                  ) : (
                                    <>
                                      <span>🚫</span>
                                      Not Authorized to Update
                                    </>
                                  )}
                                </button>
                              )}
                              
                              <button 
                                className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                                onClick={clearDrawing}
                                disabled={isBatchMinting || isBatchUpdating}
                              >
                                <span>🗑️</span>
                                Clear Selection
                              </button>
                              
                              <button 
                                className="w-full bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2" 
                                onClick={toggleDrawMode}
                                disabled={isBatchMinting || isBatchUpdating}
                              >
                                <span>✏️</span>
                                Exit Batch Mode
                              </button>
                            </div>
                            
                            <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-4">
                              💡 <strong>Tip:</strong> Click pixels on canvas to add/remove them. Green pixels will be minted, blue pixels will be updated with your selected color.
                            </div>
                          </>
                        );
                      })()}


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
                            <>
                              {/* Check if user is authorized (including delegation) */}
                              {pixelAuthStatus?.x === selectedPixel[0] && pixelAuthStatus?.y === selectedPixel[1] && (
                                <>
                                  {pixelAuthStatus.isChecking ? (
                                    <div className="text-center p-3 bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg">
                                      <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-blue-400 text-sm">Checking delegation...</p>
                                      </div>
                                    </div>
                                  ) : pixelAuthStatus.isAuthorized ? (
                                    <button
                                      onClick={() => updatePixel(selectedPixel[0], selectedPixel[1])}
                                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                      disabled={isMinting}
                                    >
                                      {isMinting ? (
                                        <>
                                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          Updating...
                                        </>
                                      ) : (
                                        <>
                                          <span>🎨</span>
                                          Update Color {pixelAuthStatus.isOwner ? '' : '(Delegated)'}
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="text-center p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                                        <p className="text-red-400 text-sm">You don&apos;t have permission to update this pixel</p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          // Re-trigger authorization check by re-selecting the pixel
                                          const currentPixel = selectedPixel;
                                          setSelectedPixel(null);
                                          setTimeout(() => setSelectedPixel(currentPixel), 100);
                                        }}
                                        className="w-full bg-gray-600 hover:bg-gray-500 text-white text-sm py-2 px-3 rounded transition-colors"
                                      >
                                        🔄 Check Again
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
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
                <p>Minted pixels: {Object.keys(pixelData).length}</p>
                <p>Total possible: {CANVAS_WIDTH * CANVAS_HEIGHT}</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Container section */}
      <div className={`fixed ${isDelegateMode ? 'bottom-4 right-4' : 'top-20 right-4'} z-50 space-y-2 pointer-events-none`}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              w-80 pointer-events-auto
              bg-white rounded-lg shadow-lg border-l-4 p-3
              transform transition-all duration-300 ease-in-out
              ${notification.type === 'success' ? 'border-green-500' : 
                notification.type === 'error' ? 'border-red-500' : 'border-blue-500'}
              animate-slide-in-right
            `}
            style={{
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                {notification.type === 'error' && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✕</span>
                  </div>
                )}
                {notification.type === 'info' && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">i</span>
                  </div>
                )}
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {notification.message}
                </p>
                {/* Add explorer link for success notifications with txHash */}
                {notification.type === 'success' && notification.txHash && (
                  <div className="mt-2">
                    <a
                      href={`${EXPLORER_BASE_URL}${notification.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <span>🔗</span>
                      View on Explorer
                      <span className="text-gray-400">↗</span>
                    </a>
                  </div>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => removeNotification(notification.id)}
                >
                  <span className="sr-only">Close</span>
                  <span className="h-5 w-5 text-lg leading-none">×</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}