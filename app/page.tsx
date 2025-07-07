"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import IndividualDelegationPopup from "@/components/IndividualDelegationPopup";
import BatchDelegationPopup from "@/components/BatchDelegationPopup";
import CopyNotification from "@/components/CopyNotification";
import { Header } from "@/components/header";
import Sidebar from "@/components/sidebar/Sidebar";
import {
  useWriteContract,
  usePublicClient,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";

import PXNFT_ABI from "@/contractABI/PXNFT.json";
import type { Log } from "viem";
const CANVAS_WIDTH = 150; // Total canvas size (150x150 = 22500 pixels)
const CANVAS_HEIGHT = 150;
const MIN_VIEWPORT_SIZE = 10; // Minimum zoom (most zoomed in)
const MAX_VIEWPORT_SIZE = 100; // Maximum zoom (most zoomed out)
const PIXEL_SIZE = 8; // Base pixel size in pixels

const CONTRACT_ADDRESS = "0xE2948e08947430068C99d99d457a243d7Dc978cb";
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
  const [selectedPixel, setSelectedPixel] = useState<[number, number] | null>(
    null
  );
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
  const [customHexColor, setCustomHexColor] = useState("");
  const [showHexInput, setShowHexInput] = useState(false);
  const [positionX, setPositionX] = useState("");
  const [positionY, setPositionY] = useState("");

  const [eventWatcher, setEventWatcher] = useState<(() => void) | null>(null);
  // State to track pending transactions
  const [loadingChunks, setLoadingChunks] = useState<Set<string>>(new Set());
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [pendingMints, setPendingMints] = useState<Set<string>>(new Set());
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  // Track transaction hashes and the pixel being processed
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | null>(
    null
  );
  const [pendingTxPixel, setPendingTxPixel] = useState<[number, number] | null>(
    null
  );
  const [pendingTxType, setPendingTxType] = useState<
    "mint" | "update" | "batch" | "compose" | "delegation" | "revocation" | null
  >(null);
  const [pendingBatchSize, setPendingBatchSize] = useState(0);
  const [eventWatchingEnabled, setEventWatchingEnabled] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawnPixels, setDrawnPixels] = useState<Map<string, string>>(
    new Map()
  );
  const [isBatchMinting, setIsBatchMinting] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [highlightedPixel, setHighlightedPixel] = useState<
    [number, number] | null
  >(null);
  const [totalMinted, setTotalMinted] = useState(0);
  const [screenSize, setScreenSize] = useState({ width: 1024, height: 768 });

  // Delegation state
  const [isDelegateMode, setIsDelegateMode] = useState(false);
  const [delegateAddress, setDelegateAddress] = useState("");
  const [delegateAddresses, setDelegateAddresses] = useState<string[]>([]);
  const [isMultiAddressMode, setIsMultiAddressMode] = useState(false);

  const [showDelegateInput, setShowDelegateInput] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isBatchDelegate, setIsBatchDelegate] = useState(false);

  // Delegation area selection state
  const [delegateAreaStart, setDelegateAreaStart] = useState<
    [number, number] | null
  >(null);
  const [isDelegateAreaDragging, setIsDelegateAreaDragging] = useState(false);
  const [delegateSelectedArea, setDelegateSelectedArea] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Revoke mode state
  const [isRevokeMode, setIsRevokeMode] = useState(false);
  const [revokeAddress, setRevokeAddress] = useState("");
  const [revokeAddresses, setRevokeAddresses] = useState<string[]>([]);
  const [isRevokeMultiAddressMode, setIsRevokeMultiAddressMode] =
    useState(false);
  const [showRevokeInput, setShowRevokeInput] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isBatchRevoke, setIsBatchRevoke] = useState(false);

  // Revoke area selection state
  const [revokeAreaStart, setRevokeAreaStart] = useState<
    [number, number] | null
  >(null);
  const [isRevokeAreaDragging, setIsRevokeAreaDragging] = useState(false);
  const [revokeSelectedArea, setRevokeSelectedArea] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Authorization checking state for batch updates
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authResults, setAuthResults] = useState<{
    authorized: number;
    unauthorized: number;
  } | null>(null);

  // Pixel delegation info for display
  const [pixelDelegationCount, setPixelDelegationCount] = useState<number>(0);
  const [isLoadingPixelDelegations, setIsLoadingPixelDelegations] =
    useState(false);
  const [showDelegationPopup, setShowDelegationPopup] = useState(false);
  const [pixelDelegatedAddresses, setPixelDelegatedAddresses] = useState<
    string[]
  >([]);

  // Batch delegation info for multiple pixels
  const [batchDelegationData, setBatchDelegationData] = useState<{
    totalDelegations: number;
    pixelData: Array<{
      x: number;
      y: number;
      delegationCount: number;
      delegatedAddresses: string[];
    }>;
  }>({ totalDelegations: 0, pixelData: [] });
  const [isLoadingBatchDelegations, setIsLoadingBatchDelegations] =
    useState(false);
  const [showBatchDelegationPopup, setShowBatchDelegationPopup] =
    useState(false);
  const [expandedPixel, setExpandedPixel] = useState<number | null>(null);

  // Copy notification state (for popup overlay)
  const [copyNotification, setCopyNotification] = useState<{
    show: boolean;
    address: string;
  }>({ show: false, address: "" });

  // Fee system state
  const [feeRequired, setFeeRequired] = useState<bigint>(BigInt(0));
  const [hasExemption, setHasExemption] = useState(false);
  const [isCheckingFee, setIsCheckingFee] = useState(false);

  // Authorization state for selected pixel
  const [pixelAuthStatus, setPixelAuthStatus] = useState<{
    x: number;
    y: number;
    isOwner: boolean;
    isAuthorized: boolean;
    isChecking: boolean;
  } | null>(null);

  // Store batch fee calculation results for UI display
  const [batchFeeInfo, setBatchFeeInfo] = useState<{
    totalFee: bigint;
    unauthorizedCount: number;
    authorized: number;
  } | null>(null);

  // Area selection and composition
  const [isAreaSelectMode, setIsAreaSelectMode] = useState(false);
  const [selectedArea, setSelectedArea] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [areaSelectionStart, setAreaSelectionStart] = useState<
    [number, number] | null
  >(null);
  const [isAreaDragging, setIsAreaDragging] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [ownedPixelsInArea, setOwnedPixelsInArea] = useState<number[]>([]);
  const [compositionInfo, setCompositionInfo] = useState<{
    canCompose: boolean;
    reason: string;
    ownedCount: number;
  } | null>(null);

  // Approval management
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pixelApprovedAddresses, setPixelApprovedAddresses] = useState<
    string[]
  >([]);
  const [isRevokingApproval, setIsRevokingApproval] = useState(false);
  const lastCheckedApprovalPixel = useRef<string | null>(null);
  const lastCheckedDelegationPixel = useRef<string | null>(null);
  const [revokingAddress, setRevokingAddress] = useState<string | null>(null);

  const { address, isConnected } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [sidebarPosition, setSidebarPosition] = useState({ x: 0, y: 64 }); // Start at top-right, below header
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarDragStart, setSidebarDragStart] = useState({ x: 0, y: 0 });
  const [loadingProgress, setLoadingProgress] = useState({
    current: 0,
    total: 0,
  });

  // Notification system
  interface Notification {
    id: string;
    type: "success" | "error" | "info";
    title: string;
    message: string;
    timestamp: number;
    txHash?: string; // Add this optional field
  }

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Notification helper functions
  const addNotification = useCallback(
    (
      type: "success" | "error" | "info",
      title: string,
      message: string,
      txHash?: string
    ) => {
      const id = Date.now().toString();
      const newNotification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
        txHash,
      };

      setNotifications((prev) => [...prev, newNotification]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 8000);
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        // Show popup copy notification
        setCopyNotification({ show: true, address: text });
        // Auto-hide after 2 seconds
        setTimeout(() => {
          setCopyNotification({ show: false, address: "" });
        }, 2000);
      } catch {
        addNotification("error", "Copy Failed", "Failed to copy address");
      }
    },
    [addNotification]
  );

  useEffect(() => {
    setSidebarPosition({ x: window.innerWidth - 320, y: 64 });
    setScreenSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);
  useEffect(() => {
    const handleResize = () => {
      const sidebarWidth = Math.min(320, window.innerWidth * 0.9);
      const maxX = window.innerWidth - sidebarWidth;
      const maxY = window.innerHeight - 200;

      setSidebarPosition((prev) => ({
        x: Math.max(0, Math.min(maxX, prev.x)), // Keep within bounds
        y: Math.max(64, Math.min(maxY, prev.y)), // Keep within bounds
      }));

      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  const handleSidebarDragStart = (e: React.MouseEvent) => {
    setIsDraggingSidebar(true);
    setSidebarDragStart({
      x: e.clientX - sidebarPosition.x,
      y: e.clientY - sidebarPosition.y,
    });
    e.preventDefault();
  };

  const handleSidebarDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDraggingSidebar) return;

      let clientX, clientY;
      if ("touches" in e) {
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
        y: Math.max(64, Math.min(maxY, newY)),
      });
    },
    [isDraggingSidebar, sidebarDragStart]
  );
  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDraggingSidebar(true);
    setSidebarDragStart({
      x: touch.clientX - sidebarPosition.x,
      y: touch.clientY - sidebarPosition.y,
    });
    e.preventDefault();
  };

  const handleSidebarDragEnd = useCallback(() => {
    setIsDraggingSidebar(false);
  }, []);
  useEffect(() => {
    if (isDraggingSidebar) {
      document.addEventListener("mousemove", handleSidebarDragMove);
      document.addEventListener("mouseup", handleSidebarDragEnd);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleSidebarDragMove);
        document.removeEventListener("mouseup", handleSidebarDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);
  useEffect(() => {
    if (isDraggingSidebar) {
      const handleMove = (e: Event) =>
        handleSidebarDragMove(e as MouseEvent | TouchEvent);

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleSidebarDragEnd);
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleSidebarDragEnd);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleSidebarDragEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleSidebarDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);

  useEffect(() => {
    if (isDraggingSidebar) {
      const handleMove = (e: Event) =>
        handleSidebarDragMove(e as MouseEvent | TouchEvent);

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleSidebarDragEnd);
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleSidebarDragEnd);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleSidebarDragEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleSidebarDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDraggingSidebar, handleSidebarDragMove, handleSidebarDragEnd]);

  const fetchTotalMinted = useCallback(async () => {
    if (!publicClient) return;

    try {
      const total = (await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "totalMinted",
      })) as bigint;

      setTotalMinted(Number(total));
    } catch (error) {
      console.error("Error fetching total minted:", error);
    }
  }, [publicClient]);
  useEffect(() => {
    if (publicClient) {
      fetchTotalMinted();
    }
  }, [publicClient, fetchTotalMinted]);
  // Watch for transaction receipt
  const { data: txReceipt, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({
      hash: pendingTxHash || undefined,
    });

  // Move utility functions outside of useEffect to avoid dependency issues
  const getTokenId = useCallback(
    (x: number, y: number) => y * CANVAS_WIDTH + x,
    []
  );

  const getCoordinatesFromTokenId = useCallback((tokenId: number) => {
    const x = tokenId % CANVAS_WIDTH;
    const y = Math.floor(tokenId / CANVAS_WIDTH);
    return { x, y };
  }, []);

  useEffect(() => {
    if (isTxSuccess && txReceipt && pendingTxHash) {
      console.log("Transaction confirmed:", txReceipt);

      // Show success notification
      if (pendingTxType === "batch") {
        // Determine if it was a mint or update batch based on pending states
        const wasMintBatch = pendingBatchSize > 0 && isBatchMinting;
        const wasUpdateBatch = pendingBatchSize > 0 && isBatchUpdating;

        if (wasMintBatch) {
          addNotification(
            "success",
            "Batch Mint Complete!",
            `Successfully minted ${pendingBatchSize} pixels!`,
            pendingTxHash
          );
        } else if (wasUpdateBatch) {
          addNotification(
            "success",
            "Batch Update Complete!",
            `Successfully updated ${pendingBatchSize} pixels!`,
            pendingTxHash
          );
        } else {
          addNotification(
            "success",
            "Batch Operation Complete!",
            `Successfully processed ${pendingBatchSize} pixels!`,
            pendingTxHash
          );
        }
      } else if (pendingTxType === "compose") {
        // Add success notification for composition
        addNotification(
          "success",
          "Composition Complete!",
          `Successfully composed ${pendingBatchSize} pixels into NFT!`,
          pendingTxHash
        );
      } else if (pendingTxType === "delegation") {
        // Add success notification for delegation and auto-close delegation mode
        addNotification(
          "success",
          "Delegation Complete!",
          `Successfully delegated ${pendingBatchSize} pixels!`,
          pendingTxHash
        );

        // Auto-close delegation mode after successful delegation
        setTimeout(() => {
          setIsDelegateMode(false);
          setIsBatchDelegate(false);
          setDelegateAddress("");
          setDelegateAddresses([]);
          setIsMultiAddressMode(false);
          setShowDelegateInput(false);
          setDrawnPixels(new Map());
          setSelectedPixel(null);
          setDelegateSelectedArea(null);
          setDelegateAreaStart(null);
          setIsDelegateAreaDragging(false);
        }, 1000); // 1 second delay so user can see the success message
      } else if (pendingTxType === "revocation") {
        // Add success notification for revocation and auto-close revoke mode
        addNotification(
          "success",
          "Revocation Complete!",
          `Successfully revoked access for ${pendingBatchSize} pixels!`,
          pendingTxHash
        );

        // Auto-close revoke mode after successful revocation
        setTimeout(() => {
          setIsRevokeMode(false);
          setIsBatchRevoke(false);
          setRevokeAddress("");
          setRevokeAddresses([]);
          setIsRevokeMultiAddressMode(false);
          setShowRevokeInput(false);
          setDrawnPixels(new Map());
          setSelectedPixel(null);
          setRevokeSelectedArea(null);
          setRevokeAreaStart(null);
          setIsRevokeAreaDragging(false);
        }, 1000); // 1 second delay so user can see the success message
      } else if (pendingTxPixel) {
        const [x, y] = pendingTxPixel;
        if (pendingTxType === "mint") {
          addNotification(
            "success",
            "Pixel Minted!",
            `Successfully minted pixel at (${x}, ${y})`,
            pendingTxHash
          );
        } else if (pendingTxType === "update") {
          addNotification(
            "success",
            "Color Updated!",
            `Successfully updated pixel at (${x}, ${y})`,
            pendingTxHash
          );
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
        if (currentType === "batch") {
          console.log(
            "Fallback: Batch transaction completed, clearing pending states"
          );
          // Clear all pending states for batch operations
          setPendingMints(new Set());
          setPendingUpdates(new Set());
        } else if (currentPixel) {
          const [x, y] = currentPixel;
          const key = `${x}-${y}`;
          console.log(
            `Fallback: Manually updating pixel (${x}, ${y}) after transaction confirmation`
          );

          // Clear pending states
          if (currentType === "mint") {
            setPendingMints((prev) => {
              const newSet = new Set(prev);
              newSet.delete(key);
              console.log(`Fallback: Removed ${key} from pending mints`);
              return newSet;
            });
          } else if (currentType === "update") {
            setPendingUpdates((prev) => {
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
              const owner = (await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: "ownerOf",
                args: [BigInt(tokenId)],
              })) as string;

              const color = (await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: "getColor",
                args: [BigInt(x), BigInt(y)],
              })) as string;

              setPixelData((prev) => ({
                ...prev,
                [key]: {
                  color: color || "#ffffff",
                  owner,
                  isMinted: true,
                },
              }));

              console.log(
                `Fallback: Updated pixel (${x}, ${y}) with color ${color} and owner ${owner}`
              );
            } catch (error) {
              console.error("Fallback: Error fetching pixel data:", error);
            }
          }
        }
        await fetchTotalMinted();
      }, 2000); // 2 second delay to give event listeners a chance

      // Clear the fallback timeout if events work properly
      const clearFallback = () => {
        clearTimeout(fallbackTimeout);
        console.log("Event listeners worked, cancelled fallback");
      };

      // Store the clear function to be called by event listeners
      window.clearPixelFallback = clearFallback;

      // Clear transaction type
      setPendingTxType(null);
    }
  }, [
    isTxSuccess,
    txReceipt,
    pendingTxHash,
    pendingTxPixel,
    pendingTxType,
    pendingBatchSize,
    publicClient,
    getTokenId,
    fetchTotalMinted,
    addNotification,
    isBatchMinting,
    isBatchUpdating,
  ]);

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
    "#ffffff",
    "#e4e4e4",
    "#888888",
    "#222222",
    "#ffa7d1",
    "#e50000",
    "#e59500",
    "#a06a42",
    "#e5d900",
    "#94e044",
    "#02be01",
    "#00d3dd",
    "#0083c7",
    "#0000ea",
    "#cf6ee4",
    "#820080",
  ];
  const applyHexColor = () => {
    // Validate hex color format
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexRegex.test(customHexColor)) {
      setSelectedColor(customHexColor);
      setCustomHexColor("");
      setShowHexInput(false);
    } else {
      alert("Please enter a valid hex color (e.g., #FF0000 or #F00)");
    }
  };
  const handleHexKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyHexColor();
    } else if (e.key === "Escape") {
      setCustomHexColor("");
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
          eventName: "Transfer",
          args: {
            from: "0x0000000000000000000000000000000000000000", // Only watch mint events
          },
          onLogs: (logs) => {
            if (!isActive) return;

            console.log("Transfer event detected:", logs);

            if (window.clearPixelFallback) {
              window.clearPixelFallback();
              window.clearPixelFallback = undefined;
            }

            logs.forEach(
              async (
                log: Log & {
                  args?: { from: string; to: string; tokenId: bigint };
                }
              ) => {
                const { args } = log;
                if (!args) return;

                const { from, to, tokenId } = args;

                // Only process mint events (from zero address)
                if (from === "0x0000000000000000000000000000000000000000") {
                  const tokenIdNumber = Number(tokenId);
                  const { x, y } = getCoordinatesFromTokenId(tokenIdNumber);
                  const key = `${x}-${y}`;

                  console.log(
                    `Mint confirmed for pixel (${x}, ${y}), owner: ${to}`
                  );

                  // Update total minted count
                  setTotalMinted((prev) => prev + 1);

                  // Remove from pending mints
                  setPendingMints((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(key);
                    return newSet;
                  });

                  // Fetch and update pixel data
                  try {
                    const color = (await publicClient.readContract({
                      address: CONTRACT_ADDRESS as `0x${string}`,
                      abi: PXNFT_ABI,
                      functionName: "getColor",
                      args: [BigInt(x), BigInt(y)],
                    })) as string;

                    setPixelData((prev) => ({
                      ...prev,
                      [key]: {
                        color: color || "#ffffff",
                        owner: to,
                        isMinted: true,
                      },
                    }));
                  } catch (error) {
                    console.error(
                      "Error fetching color for newly minted pixel:",
                      error
                    );
                  }
                }
              }
            );
          },
          onError: (error) => {
            console.log("Event watching failed:", error);
            setEventWatchingEnabled(false);
          },
        });

        setEventWatcher(unwatch);
      } catch (error) {
        console.error("Failed to setup event watcher:", error);
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
  }, [
    eventWatchingEnabled,
    isConnected,
    publicClient,
    getCoordinatesFromTokenId,
    eventWatcher,
  ]);
  useEffect(() => {
    if (!eventWatchingEnabled || !isConnected || !publicClient) return;

    let isActive = true;

    const watchColorEvents = async () => {
      try {
        const unwatch = publicClient.watchContractEvent({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          eventName: "ColorUpdated",
          onLogs: (
            logs: (Log & {
              args?: {
                tokenId: bigint;
                x: bigint;
                y: bigint;
                color: string;
                owner: string;
              };
            })[]
          ) => {
            if (!isActive) return;

            console.log("ColorUpdated event detected:", logs);

            logs.forEach(
              (
                log: Log & {
                  args?: {
                    tokenId: bigint;
                    x: bigint;
                    y: bigint;
                    color: string;
                    owner: string;
                  };
                }
              ) => {
                const { args } = log;
                if (!args) return;

                const { x, y, color, owner } = args;
                const pixelX = Number(x);
                const pixelY = Number(y);
                const key = `${pixelX}-${pixelY}`;

                console.log(
                  `Color updated for pixel (${pixelX}, ${pixelY}), color: ${color}, owner: ${owner}`
                );

                // Update pixel data immediately
                setPixelData((prev) => ({
                  ...prev,
                  [key]: {
                    color: color,
                    owner: owner,
                    isMinted: true,
                  },
                }));

                // Remove from pending states
                setPendingMints((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });

                setPendingUpdates((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });
              }
            );

            // Update total minted count
            fetchTotalMinted();
          },
          onError: (error) => {
            console.log("ColorUpdated event watching failed:", error);
          },
        });

        return unwatch;
      } catch (error) {
        console.error("Failed to setup ColorUpdated event watcher:", error);
      }
    };

    const cleanup = watchColorEvents();

    return () => {
      isActive = false;
      cleanup?.then((unwatch) => unwatch?.());
    };
  }, [eventWatchingEnabled, isConnected, publicClient, fetchTotalMinted]);

  const loadVisiblePixels = useCallback(async () => {
    if (!publicClient || isLoadingChunks) return;

    setIsLoadingChunks(true);

    try {
      // Reduce buffer significantly for initial load, increase for subsequent loads
      const buffer = isInitialLoad ? 5 : 15;
      const startX = Math.max(0, viewportX - buffer);
      const startY = Math.max(0, viewportY - buffer);
      const endX = Math.min(
        CANVAS_WIDTH - 1,
        viewportX + viewportSize + buffer
      );
      const endY = Math.min(
        CANVAS_HEIGHT - 1,
        viewportY + viewportSize + buffer
      );

      const chunkSize = 5;
      const chunksToLoad: Array<{
        x: number;
        y: number;
        endX: number;
        endY: number;
        key: string;
        priority: number;
      }> = [];

      // Calculate chunks with priority (center chunks load first)
      const centerX = viewportX + viewportSize / 2;
      const centerY = viewportY + viewportSize / 2;

      for (let y = startY; y < endY; y += chunkSize) {
        for (let x = startX; x < endX; x += chunkSize) {
          const chunkEndX = Math.min(
            Math.floor(x + chunkSize - 1),
            Math.floor(endX)
          );
          const chunkEndY = Math.min(
            Math.floor(y + chunkSize - 1),
            Math.floor(endY)
          );
          const chunkKey = `${x}-${y}-${chunkEndX}-${chunkEndY}`;

          if (!loadedChunks.has(chunkKey) && !loadingChunks.has(chunkKey)) {
            // Calculate distance from center for priority
            const chunkCenterX = x + (chunkEndX - x) / 2;
            const chunkCenterY = y + (chunkEndY - y) / 2;
            const distance = Math.sqrt(
              Math.pow(chunkCenterX - centerX, 2) +
                Math.pow(chunkCenterY - centerY, 2)
            );

            chunksToLoad.push({
              x: Math.floor(x),
              y: Math.floor(y),
              endX: chunkEndX,
              endY: chunkEndY,
              key: chunkKey,
              priority: distance,
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
        await Promise.all(
          batch.map(async (chunk) => {
            setLoadingChunks((prev) => new Set(prev).add(chunk.key));

            try {
              // console.log(`Loading chunk (${chunk.x},${chunk.y}) to (${chunk.endX},${chunk.endY})`);

              if (
                chunk.x >= CANVAS_WIDTH ||
                chunk.y >= CANVAS_HEIGHT ||
                chunk.endX >= CANVAS_WIDTH ||
                chunk.endY >= CANVAS_HEIGHT
              ) {
                return;
              }

              const result = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: "getMintedPixelsInRange",
                args: [
                  BigInt(chunk.x),
                  BigInt(chunk.y),
                  BigInt(chunk.endX),
                  BigInt(chunk.endY),
                ],
              });

              const [tokenIds, owners, colors] = result as [
                bigint[],
                string[],
                string[]
              ];

              setPixelData((prev) => {
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

              setLoadedChunks((prev) => new Set(prev).add(chunk.key));
            } catch (chunkError) {
              console.error(
                `Error loading chunk (${chunk.x},${chunk.y}):`,
                chunkError
              );
            } finally {
              setLoadingChunks((prev) => {
                const newSet = new Set(prev);
                newSet.delete(chunk.key);
                return newSet;
              });
              setLoadingProgress((prev) => ({
                current: Math.min(prev.current + 1, prev.total),
                total: prev.total,
              }));
            }
          })
        );

        // Add delay between batches, shorter for initial load
        const delay = isInitialLoad ? 100 : 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error("Error loading visible pixels:", error);
    } finally {
      setIsLoadingChunks(false);
      setIsInitialLoad(false);
    }
  }, [
    publicClient,
    viewportX,
    viewportY,
    viewportSize,
    isInitialLoad,
    isLoadingChunks,
    loadedChunks,
    loadingChunks,
  ]);

  // Load pixels when viewport changes
  useEffect(() => {
    if (publicClient && !isLoadingChunks) {
      const debounceTimer = setTimeout(() => {
        loadVisiblePixels();
      }, 300); // Debounce viewport changes

      return () => clearTimeout(debounceTimer);
    }
  }, [
    publicClient,
    viewportX,
    viewportY,
    viewportSize,
    isLoadingChunks,
    loadVisiblePixels,
  ]);

  // Initial load - just load current viewport
  useEffect(() => {
    if (publicClient && isInitialLoad) {
      loadVisiblePixels();
    }
  }, [publicClient, isInitialLoad, loadVisiblePixels]);

  // Update your pixel checking functions:
  const isPixelMinted = useCallback(
    (x: number, y: number) => {
      const key = `${x}-${y}`;
      return pixelData[key]?.isMinted || false;
    },
    [pixelData]
  );

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
    return "#ffffff";
  };

  const getPixelOwner = useCallback(
    (x: number, y: number) => {
      const key = `${x}-${y}`;
      return pixelData[key]?.owner || null;
    },
    [pixelData]
  );
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
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, publicClient]);

  // Zoom functions with mouse position support
  const handleZoomIn = useCallback(
    (mouseWorldX?: number, mouseWorldY?: number) => {
      const newSize = Math.max(MIN_VIEWPORT_SIZE, viewportSize - 5);
      if (newSize !== viewportSize) {
        setViewportSize(newSize);

        // Use mouse position if provided, otherwise use center
        const centerX = mouseWorldX ?? viewportX + viewportSize / 2;
        const centerY = mouseWorldY ?? viewportY + viewportSize / 2;

        // Keep the center point (or mouse point), but ensure we don't go outside canvas
        const newViewportX = Math.max(
          0,
          Math.min(CANVAS_WIDTH - newSize, centerX - newSize / 2)
        );
        const newViewportY = Math.max(
          0,
          Math.min(CANVAS_HEIGHT - newSize, centerY - newSize / 2)
        );

        setViewportX(Math.floor(newViewportX));
        setViewportY(Math.floor(newViewportY));
      }
    },
    [viewportSize, viewportX, viewportY]
  );

  const handleZoomOut = useCallback(
    (mouseWorldX?: number, mouseWorldY?: number) => {
      const newSize = Math.min(MAX_VIEWPORT_SIZE, viewportSize + 5);
      if (newSize !== viewportSize) {
        setViewportSize(newSize);

        // Use mouse position if provided, otherwise use center
        const centerX = mouseWorldX ?? viewportX + viewportSize / 2;
        const centerY = mouseWorldY ?? viewportY + viewportSize / 2;

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
    },
    [viewportSize, viewportX, viewportY]
  );

  // Handle mouse wheel for zooming with mouse position
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Get mouse position relative to canvas
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert mouse position to world coordinates
      const worldMouseX = viewportX + mouseX / PIXEL_SIZE;
      const worldMouseY = viewportY + mouseY / PIXEL_SIZE;

      // More sensitive zoom detection
      if (e.deltaY < -10) {
        // Scroll up = zoom in
        handleZoomIn(worldMouseX, worldMouseY);
      } else if (e.deltaY > 10) {
        // Scroll down = zoom out
        handleZoomOut(worldMouseX, worldMouseY);
      }

      if (!hasInteracted) {
        setHasInteracted(true);
        setTimeout(() => setShowInstructions(false), 1000);
      }
    },
    [hasInteracted, handleZoomIn, handleZoomOut, viewportX, viewportY]
  );
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

    if (
      Math.abs(deltaX) < movementThreshold &&
      Math.abs(deltaY) < movementThreshold
    ) {
      return;
    }

    // Calculate new viewport position
    let newViewportX = viewportX - Math.floor(deltaX / PIXEL_SIZE);
    let newViewportY = viewportY - Math.floor(deltaY / PIXEL_SIZE);

    // Constrain viewport to canvas bounds
    newViewportX = Math.max(
      0,
      Math.min(
        CANVAS_WIDTH - Math.min(viewportSize, CANVAS_WIDTH),
        newViewportX
      )
    );
    newViewportY = Math.max(
      0,
      Math.min(
        CANVAS_HEIGHT - Math.min(viewportSize, CANVAS_HEIGHT),
        newViewportY
      )
    );

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

    // Always select the pixel to show delegation info (unless in specific area modes)
    if (
      !isAreaSelectMode &&
      !(isDelegateMode && isBatchDelegate && isDelegateAreaDragging) &&
      !(isRevokeMode && isBatchRevoke && isRevokeAreaDragging)
    ) {
      setSelectedPixel([x, y]);
    }

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
            setShowDelegateInput(true);
          }
        } else {
          addNotification(
            "error",
            "Not Owner",
            "You can only delegate pixels you own"
          );
        }
      }
    } else if (isRevokeMode) {
      // Handle revoke mode
      if (isBatchRevoke) {
        // In batch revoke mode, use area selection for drag selection
        handleRevokeAreaSelection(x, y);
      } else {
        // Single pixel revoke
        if (canUpdatePixel(x, y)) {
          if (!showRevokeInput) {
            setShowRevokeInput(true);
          }
        } else {
          addNotification(
            "error",
            "Not Owner",
            "You can only revoke access from pixels you own"
          );
        }
      }
    } else if (isDrawMode) {
      const key = `${x}-${y}`;
      if (drawnPixels.has(key)) {
        removePixelFromDrawing(x, y);
      } else {
        addPixelToDrawing(x, y);
      }
      // Keep the pixel selected in draw mode to show delegation info
    }
  };

  const handlePixelHover = (x: number, y: number) => {
    if (isAreaSelectMode) {
      handleAreaSelectionMove(x, y);
    } else if (isDelegateMode && isBatchDelegate && isDelegateAreaDragging) {
      handleDelegateAreaMove(x, y);
    } else if (isRevokeMode && isBatchRevoke && isRevokeAreaDragging) {
      handleRevokeAreaMove(x, y);
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
          endY: Math.max(startY, y),
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
        endY: Math.max(startY, y),
      });
    }
  };

  const selectOwnedPixelsInArea = (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }) => {
    const newDrawnPixels = new Map<string, string>();
    let ownedCount = 0;

    for (let y = area.startY; y <= area.endY; y++) {
      for (let x = area.startX; x <= area.endX; x++) {
        if (canUpdatePixel(x, y)) {
          const key = `${x}-${y}`;
          newDrawnPixels.set(key, "#4F46E5"); // Blue color for delegation
          ownedCount++;
        }
      }
    }

    setDrawnPixels(newDrawnPixels);

    if (ownedCount > 0) {
      addNotification(
        "info",
        "Pixels Selected",
        `Selected ${ownedCount} owned pixels for delegation`
      );
    } else {
      addNotification(
        "info",
        "No Owned Pixels",
        "No pixels you own were found in the selected area"
      );
    }
  };

  // Revoke area selection handlers
  const handleRevokeAreaSelection = (x: number, y: number) => {
    if (!isRevokeAreaDragging) {
      // Start new selection
      setRevokeAreaStart([x, y]);
      setIsRevokeAreaDragging(true);
      setDrawnPixels(new Map()); // Clear existing selection
    } else {
      // End selection
      setIsRevokeAreaDragging(false);
      if (revokeAreaStart) {
        const [startX, startY] = revokeAreaStart;
        const finalArea = {
          startX: Math.min(startX, x),
          startY: Math.min(startY, y),
          endX: Math.max(startX, x),
          endY: Math.max(startY, y),
        };
        setRevokeSelectedArea(finalArea);

        // Auto-select owned pixels in the area
        selectOwnedPixelsInAreaForRevoke(finalArea);
      }
    }
  };

  const handleRevokeAreaMove = (x: number, y: number) => {
    if (isRevokeAreaDragging && revokeAreaStart) {
      const [startX, startY] = revokeAreaStart;
      setRevokeSelectedArea({
        startX: Math.min(startX, x),
        startY: Math.min(startY, y),
        endX: Math.max(startX, x),
        endY: Math.max(startY, y),
      });
    }
  };

  const selectOwnedPixelsInAreaForRevoke = (area: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }) => {
    const newDrawnPixels = new Map<string, string>();
    let ownedCount = 0;

    for (let y = area.startY; y <= area.endY; y++) {
      for (let x = area.startX; x <= area.endX; x++) {
        if (canUpdatePixel(x, y)) {
          const key = `${x}-${y}`;
          newDrawnPixels.set(key, "#DC2626"); // Red color for revoke
          ownedCount++;
        }
      }
    }

    setDrawnPixels(newDrawnPixels);

    if (ownedCount > 0) {
      addNotification(
        "info",
        "Pixels Selected",
        `Selected ${ownedCount} owned pixels for revoke`
      );
    } else {
      addNotification(
        "info",
        "No Owned Pixels",
        "No pixels you own were found in the selected area"
      );
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

    if (
      Math.abs(deltaX) < movementThreshold &&
      Math.abs(deltaY) < movementThreshold
    ) {
      return;
    }

    // Calculate new viewport position
    let newViewportX = viewportX - Math.floor(deltaX / PIXEL_SIZE);
    let newViewportY = viewportY - Math.floor(deltaY / PIXEL_SIZE);

    // Constrain viewport to canvas bounds
    newViewportX = Math.max(
      0,
      Math.min(
        CANVAS_WIDTH - Math.min(viewportSize, CANVAS_WIDTH),
        newViewportX
      )
    );
    newViewportY = Math.max(
      0,
      Math.min(
        CANVAS_HEIGHT - Math.min(viewportSize, CANVAS_HEIGHT),
        newViewportY
      )
    );

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

        if (Math.abs(deltaDistance) > 5) {
          // Minimum distance change threshold
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
    if (!selectedColor || selectedColor === "") {
      alert("Please select a color before minting!");
      return;
    }

    const key = `${x}-${y}`;

    try {
      setIsMinting(true);

      // Add to pending mints
      setPendingMints((prev) => {
        const newSet = new Set(prev).add(key);
        console.log(
          `Added ${key} to pending mints with color ${selectedColor}`
        );
        return newSet;
      });

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "mint",
        args: [BigInt(x), BigInt(y), selectedColor],
      });

      console.log(
        "Mint transaction submitted:",
        txHash,
        "with color:",
        selectedColor
      );

      // Show notification
      addNotification(
        "info",
        "Mint Started",
        `Minting pixel at (${x}, ${y})...`
      );

      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType("mint");
    } catch (error) {
      console.error("Error minting pixel:", error);
      addNotification(
        "error",
        "Mint Failed",
        `Failed to mint pixel at (${x}, ${y})`
      );

      // Remove from pending mints on error
      setPendingMints((prev) => {
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
    if (!isConnected || !address) return;

    const key = `${x}-${y}`;

    try {
      setIsMinting(true);

      // Comprehensive authorization check (workaround for contract bug)
      const [isAuthorized, hasExemption] = await Promise.all([
        publicClient?.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "isPixelAuthorized",
          args: [BigInt(x), BigInt(y), address as `0x${string}`],
        }) as Promise<boolean>,
        publicClient?.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "hasExemption",
          args: [address as `0x${string}`],
        }) as Promise<boolean>,
      ]);

      // Check if user should be free from fees
      const shouldBeFree = isAuthorized || hasExemption;

      // Calculate fee requirements (but override if should be free)
      const [fee, requiresFee] = shouldBeFree
        ? [BigInt(0), false]
        : ((await publicClient?.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "calculateUpdateFee",
            args: [BigInt(x), BigInt(y), address as `0x${string}`],
          })) as [bigint, boolean]);

      console.log("Authorization check for pixel update:", {
        x,
        y,
        address,
        isAuthorized,
        hasExemption,
        shouldBeFree,
        fee: fee.toString(),
        requiresFee,
      });

      // Add to pending updates
      setPendingUpdates((prev) => {
        const newSet = new Set(prev).add(key);
        console.log(`Added ${key} to pending updates`);
        return newSet;
      });

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "updateColor",
        args: [BigInt(x), BigInt(y), selectedColor],
        value: requiresFee ? fee : BigInt(0), // Include fee if required
      });

      console.log("Update transaction submitted:", txHash);

      // Show notification with fee info
      if (requiresFee && fee > BigInt(0)) {
        const feeInEth = Number(fee) / 1e18;
        addNotification(
          "info",
          "Update Started",
          `Updating pixel at (${x}, ${y}) with fee ${feeInEth} ETH...`
        );
      } else {
        addNotification(
          "info",
          "Update Started",
          `Updating pixel at (${x}, ${y})...`
        );
      }

      // Set the transaction hash and pixel info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxPixel([x, y]);
      setPendingTxType("update");
    } catch (error) {
      console.error("Error updating pixel:", error);
      addNotification(
        "error",
        "Update Failed",
        `Failed to update pixel at (${x}, ${y})`
      );

      // Remove from pending updates on error
      setPendingUpdates((prev) => {
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

  const addPixelToDrawing = (x: number, y: number) => {
    const key = `${x}-${y}`;
    const isMinted = isPixelMinted(x, y);
    const isPending = isPixelPending(x, y);

    // Allow adding if:
    // 1. Pixel is unminted and not pending (for minting)
    // 2. Pixel is minted (we'll check delegation during batch operation)
    // Don't allow if pending
    if (!isPending && (!isMinted || isMinted)) {
      setDrawnPixels((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, selectedColor); // Store the current selected color
        return newMap;
      });
    } else {
      if (isPending) {
        addNotification(
          "info",
          "Pixel Pending",
          `Pixel (${x}, ${y}) has a pending transaction`
        );
      }
    }
  };

  const removePixelFromDrawing = (x: number, y: number) => {
    const key = `${x}-${y}`;
    setDrawnPixels((prev) => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  };

  const clearDrawing = () => {
    setDrawnPixels(new Map());
    setBatchFeeInfo(null);
    setAuthResults(null);
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
    if (!selectedArea || !address || !publicClient)
      return { canCompose: false, reason: "No area selected", ownedCount: 0 };

    try {
      // First try to get owned pixels count using getOwnedPixelsInArea if available
      let ownedCount = 0;
      try {
        const ownedPixels = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "getOwnedPixelsInArea",
          args: [
            BigInt(selectedArea.startX),
            BigInt(selectedArea.startY),
            BigInt(selectedArea.endX),
            BigInt(selectedArea.endY),
            address,
          ],
        })) as bigint[];
        ownedCount = ownedPixels.length;
      } catch (error) {
        // getOwnedPixelsInArea not available, count manually
        console.log("Contract method failed, counting manually:", error);
        ownedCount = 0;
        for (let y = selectedArea.startY; y <= selectedArea.endY; y++) {
          for (let x = selectedArea.startX; x <= selectedArea.endX; x++) {
            const key = `${x}-${y}`;
            const pixel = pixelData[key];
            if (
              pixel?.isMinted &&
              pixel?.owner?.toLowerCase() === address?.toLowerCase()
            ) {
              console.log(`Found owned pixel at (${x}, ${y}):`, pixel);
              ownedCount++;
            }
          }
        }
        console.log(`Manual count: ${ownedCount} owned pixels`);
      }

      // Validation
      if (ownedCount < 2) {
        return {
          canCompose: false,
          reason: "Need at least 2 owned pixels",
          ownedCount,
        };
      }

      return { canCompose: true, reason: "", ownedCount };
    } catch (error) {
      console.error("Error checking composition eligibility:", error);
      return {
        canCompose: false,
        reason: "Error checking eligibility",
        ownedCount: 0,
      };
    }
  }, [selectedArea, address, publicClient, pixelData]);

  const getOwnedPixelsInArea = useCallback(async () => {
    if (!selectedArea || !address || !publicClient) return [];

    try {
      const result = (await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "getOwnedPixelsInArea",
        args: [
          BigInt(selectedArea.startX),
          BigInt(selectedArea.startY),
          BigInt(selectedArea.endX),
          BigInt(selectedArea.endY),
          address,
        ],
      })) as bigint[];

      return result.map((tokenId) => Number(tokenId));
    } catch (error) {
      console.error("Error getting owned pixels:", error);
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
          getOwnedPixelsInArea(),
        ]);

        setCompositionInfo(compInfo);
        setOwnedPixelsInArea(ownedPixels);
      } catch (error) {
        console.error("Error updating composition info:", error);
        setCompositionInfo({
          canCompose: false,
          reason: "Error checking area",
          ownedCount: 0,
        });
        setOwnedPixelsInArea([]);
      }
    };

    updateCompositionInfo();
  }, [
    selectedArea,
    address,
    publicClient,
    checkCanCompose,
    getOwnedPixelsInArea,
  ]);

  const composePixels = async () => {
    if (!selectedArea || !isConnected || !address) return;

    const { canCompose, reason, ownedCount } = await checkCanCompose();
    if (!canCompose) {
      alert(`Cannot compose area: ${reason}`);
      return;
    }

    try {
      setIsComposing(true);

      console.log(
        `Attempting to compose ${ownedCount} pixels in area (${selectedArea.startX}, ${selectedArea.startY}) to (${selectedArea.endX}, ${selectedArea.endY})`
      );

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "composePixels",
        args: [
          BigInt(selectedArea.startX),
          BigInt(selectedArea.startY),
          BigInt(selectedArea.endX),
          BigInt(selectedArea.endY),
        ],
      });
      // Set the transaction hash and info to watch for receipt
      setPendingTxHash(txHash);
      setPendingTxType("compose");
      setPendingBatchSize(ownedCount);
      console.log("Composition transaction submitted:", txHash);
      addNotification(
        "info",
        "Composition Started",
        `Composing ${ownedCount} pixels into NFT...`
      );

      // Clear selection after successful submission
      setSelectedArea(null);
      setAreaSelectionStart(null);
      setIsAreaSelectMode(false);
    } catch (error) {
      console.error("Error composing pixels:", error);
      alert(
        "Error composing pixels. Please make sure you own at least 2 pixels in the selected area and they are not already composed."
      );
    } finally {
      setIsComposing(false);
    }
  };

  const batchMintPixels = async () => {
    if (!isConnected || !address || drawnPixels.size === 0) return;

    // Filter to only include pixels that are NOT minted (unminted pixels only)
    const pixelArray = Array.from(drawnPixels.entries()).filter(([key]) => {
      const [x, y] = key.split("-").map(Number);
      return !isPixelMinted(x, y) && !isPixelPending(x, y); // Only unminted and not pending
    });

    if (pixelArray.length === 0) {
      addNotification(
        "error",
        "No Valid Pixels",
        "No unminted pixels selected for minting"
      );
      return;
    }

    try {
      setIsBatchMinting(true);

      const xCoords = pixelArray.map(([key]) => BigInt(key.split("-")[0]));
      const yCoords = pixelArray.map(([key]) => BigInt(key.split("-")[1]));
      const colors = pixelArray.map(([, color]) => color); // Use individual colors

      // Add all pixels to pending mints
      pixelArray.forEach(([key]) => {
        setPendingMints((prev) => new Set(prev).add(key));
      });

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "batchMint",
        args: [xCoords, yCoords, colors],
      });

      console.log("Batch mint transaction submitted:", txHash);
      setPendingTxHash(txHash);
      setPendingTxType("batch");
      setPendingBatchSize(pixelArray.length);

      // Show notification
      addNotification(
        "info",
        "Batch Mint Started",
        `Minting ${pixelArray.length} pixels...`
      );

      // Clear drawing
      setDrawnPixels(new Map());
      setIsDrawMode(false);
    } catch (error) {
      console.error("Error batch minting pixels:", error);
      addNotification(
        "error",
        "Batch Mint Failed",
        "Failed to submit batch mint transaction"
      );
      // Remove from pending mints on error
      pixelArray.forEach(([key]: [string, string]) => {
        setPendingMints((prev) => {
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
    if (!isConnected || !address || !publicClient || drawnPixels.size === 0)
      return;

    // Get all valid pixels (minted and not pending) - let contract handle authorization/fees
    const pixelArray: [string, string][] = [];

    for (const [key, color] of drawnPixels.entries()) {
      const [x, y] = key.split("-").map(Number);
      const pixelIsPending = pendingMints.has(key) || pendingUpdates.has(key);

      // Only include minted pixels that aren't pending
      if (isPixelMinted(x, y) && !pixelIsPending) {
        pixelArray.push([key, color]);
      }
    }

    if (pixelArray.length === 0) {
      addNotification(
        "error",
        "No Valid Pixels",
        "No minted pixels found to update"
      );
      return;
    }

    try {
      setIsBatchUpdating(true);

      const xCoords = pixelArray.map(([key]) => BigInt(key.split("-")[0]));
      const yCoords = pixelArray.map(([key]) => BigInt(key.split("-")[1]));
      const colors = pixelArray.map(([, color]) => color);

      // Check authorization for each pixel individually (workaround for contract bug)
      let actualAuthorizedCount = 0;
      let actualUnauthorizedCount = 0;

      // Check if user has global exemption first
      const hasGlobalExemption = (await publicClient?.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "hasExemption",
        args: [address as `0x${string}`],
      })) as boolean;

      if (hasGlobalExemption) {
        // User has exemption - all pixels are free
        actualAuthorizedCount = xCoords.length;
        actualUnauthorizedCount = 0;
      } else {
        // Check each pixel individually for authorization
        for (let i = 0; i < xCoords.length; i++) {
          try {
            const isAuthorized = (await publicClient?.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: "isPixelAuthorized",
              args: [xCoords[i], yCoords[i], address as `0x${string}`],
            })) as boolean;

            if (isAuthorized) {
              actualAuthorizedCount++;
            } else {
              actualUnauthorizedCount++;
            }
          } catch (error) {
            console.error(
              `Error checking authorization for pixel ${i}:`,
              error
            );
            actualUnauthorizedCount++; // Default to requiring fee if check fails
          }
        }
      }

      console.log("Batch authorization check:", {
        totalPixels: xCoords.length,
        hasGlobalExemption,
        actualAuthorizedCount,
        actualUnauthorizedCount,
        address,
      });

      // Use the contract's fee calculation instead of hardcoded values
      const [contractTotalFee, contractUnauthorizedCount] =
        (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "calculateBatchUpdateFee",
          args: [xCoords, yCoords, address as `0x${string}`],
        })) as [bigint, bigint];

      const totalFee = contractTotalFee;
      const unauthorizedCount = contractUnauthorizedCount;

      // Add all pixels to pending updates
      pixelArray.forEach(([key]) => {
        setPendingUpdates((prev) => new Set(prev).add(key));
      });

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "batchUpdateColor",
        args: [xCoords, yCoords, colors],
        value: totalFee, // Include calculated fee
      });

      console.log("Batch update transaction submitted:", txHash);
      setPendingTxHash(txHash);
      setPendingTxType("batch");
      setPendingBatchSize(pixelArray.length);

      // Show notification with fee info
      if (totalFee > BigInt(0)) {
        const feeInEth = Number(totalFee) / 1e18;
        const authorizedCount = pixelArray.length - Number(unauthorizedCount);
        addNotification(
          "info",
          "Batch Update Started",
          `Updating ${pixelArray.length} pixels (${authorizedCount} free, ${unauthorizedCount} paid) with total fee ${feeInEth} ETH...`
        );
      } else {
        addNotification(
          "info",
          "Batch Update Started",
          `Updating ${pixelArray.length} pixels (all authorized - no fee)...`
        );
      }

      // Clear drawing and fee info
      setDrawnPixels(new Map());
      setIsDrawMode(false);
      setBatchFeeInfo(null);
      setAuthResults(null);
    } catch (error) {
      console.error("Error batch updating pixels:", error);
      addNotification(
        "error",
        "Batch Update Failed",
        "Failed to submit batch update transaction"
      );
      // Remove from pending updates on error
      pixelArray.forEach(([key]) => {
        setPendingUpdates((prev) => {
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
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    // Validate address
    if (!toAddress || toAddress.length !== 42 || !toAddress.startsWith("0x")) {
      addNotification(
        "error",
        "Invalid Address",
        "Please enter a valid Ethereum address"
      );
      return;
    }

    const pixelOwner = getPixelOwner(x, y);
    if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
      addNotification("error", "Not Owner", "You do not own this pixel");
      return;
    }

    setIsDelegating(true);

    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "approvePixelMulti",
        args: [BigInt(x), BigInt(y), toAddress as `0x${string}`],
      });

      setPendingTxHash(hash);
      setPendingTxPixel([x, y]);
      setPendingTxType("delegation");

      addNotification(
        "info",
        "Delegation Submitted",
        `Delegating pixel (${x}, ${y}) to ${toAddress.slice(
          0,
          6
        )}...${toAddress.slice(-4)}`,
        hash
      );
    } catch (error: Error | unknown) {
      console.error("Error delegating pixel:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to delegate pixel";
      addNotification("error", "Delegation Failed", errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };

  // Multi-address delegation - fallback to multiple transactions until contract is updated
  const batchDelegatePixelsMultiSingleTx = async (
    pixels: Array<[number, number]>,
    toAddresses: string[]
  ) => {
    if (!isConnected || !address) {
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    if (toAddresses.length === 0) {
      addNotification(
        "error",
        "No Addresses",
        "Please enter at least one address"
      );
      return;
    }

    // Validate all addresses
    for (const addr of toAddresses) {
      if (!addr || addr.length !== 42 || !addr.startsWith("0x")) {
        addNotification("error", "Invalid Address", `Invalid address: ${addr}`);
        return;
      }
    }

    if (pixels.length === 0) {
      addNotification("error", "No Pixels", "Please select pixels to delegate");
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification(
          "error",
          "Not Owner",
          `You do not own pixel (${x}, ${y})`
        );
        return;
      }
    }

    setIsDelegating(true);

    try {
      const xCoords = pixels.map(([x]) => BigInt(x));
      const yCoords = pixels.map(([, y]) => BigInt(y));

      // Try the new single-transaction function first
      try {
        const operators = toAddresses.map((addr) => addr as `0x${string}`);

        addNotification(
          "info",
          "Single Transaction Multi-Delegation",
          `Approving ${pixels.length} pixels to ${toAddresses.length} addresses in one transaction...`
        );

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "batchApprovePixelMulti",
          args: [xCoords, yCoords, operators],
        });

        setPendingTxHash(hash);
        setPendingTxType("delegation");
        setPendingBatchSize(pixels.length * toAddresses.length);

        addNotification(
          "success",
          "Multi-Delegation Submitted",
          `Single transaction: ${pixels.length} pixels → ${toAddresses.length} addresses`,
          hash
        );
      } catch (contractError) {
        console.log(
          "New contract function not available, falling back to multiple transactions:",
          contractError
        );

        // Fallback to multiple transactions
        addNotification(
          "info",
          "Multi-Delegation Fallback",
          `Using multiple transactions for ${toAddresses.length} addresses...`
        );

        let lastHash: `0x${string}` | undefined;

        for (let i = 0; i < toAddresses.length; i++) {
          const toAddress = toAddresses[i];

          const hash = await writeContractAsync({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "batchApprovePixelMulti",
            args: [xCoords, yCoords, [toAddress as `0x${string}`]],
          });

          lastHash = hash;

          addNotification(
            "info",
            `Delegation ${i + 1}/${toAddresses.length}`,
            `Approved for ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
            hash
          );
        }

        if (lastHash) {
          setPendingTxHash(lastHash);
          setPendingTxType("delegation");
          setPendingBatchSize(pixels.length * toAddresses.length);
        }
      }
    } catch (error: Error | unknown) {
      console.error("Error multi-delegating:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to delegate pixels";
      addNotification("error", "Multi-Delegation Failed", errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };

  const batchDelegatePixels = async (
    pixels: Array<[number, number]>,
    toAddress: string
  ) => {
    if (!isConnected || !address) {
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    if (!toAddress || toAddress.length !== 42 || !toAddress.startsWith("0x")) {
      addNotification(
        "error",
        "Invalid Address",
        "Please enter a valid Ethereum address"
      );
      return;
    }

    if (pixels.length === 0) {
      addNotification("error", "No Pixels", "Please select pixels to delegate");
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification(
          "error",
          "Not Owner",
          `You do not own pixel (${x}, ${y})`
        );
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
        functionName: "batchApprovePixelMulti",
        args: [xCoords, yCoords, [toAddress as `0x${string}`]],
      });

      setPendingTxHash(hash);
      setPendingBatchSize(pixels.length);
      setPendingTxType("delegation");

      addNotification(
        "info",
        "Batch Delegation Submitted",
        `Delegating ${pixels.length} pixels to ${toAddress.slice(
          0,
          6
        )}...${toAddress.slice(-4)}`,
        hash
      );
    } catch (error: Error | unknown) {
      console.error("Error batch delegating pixels:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to delegate pixels";
      addNotification("error", "Batch Delegation Failed", errorMessage);
    } finally {
      setIsDelegating(false);
    }
  };

  const canUpdatePixel = useCallback(
    (x: number, y: number) => {
      if (!isConnected || !address) return false;
      const key = `${x}-${y}`;
      const owner = pixelData[key]?.owner || null;
      return owner ? owner.toLowerCase() === address.toLowerCase() : false;
    },
    [isConnected, address, pixelData]
  );

  // Memoize drawn pixels keys to only trigger auth check when they actually change
  const drawnPixelKeys = useMemo(() => {
    return Array.from(drawnPixels.keys());
  }, [drawnPixels]);

  // Check authorization for all drawn pixels
  const checkBatchAuthorization = useCallback(async () => {
    if (
      !isConnected ||
      !address ||
      !publicClient ||
      drawnPixelKeys.length === 0
    ) {
      setAuthResults(null);
      setBatchFeeInfo(null);
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

    try {
      // Use the contract's fee calculation which includes exemption checking
      const xCoords = candidatePixels.map((key) => BigInt(key.split("-")[0]));
      const yCoords = candidatePixels.map((key) => BigInt(key.split("-")[1]));

      const [totalFee, unauthorizedCount] = (await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "calculateBatchUpdateFee",
        args: [xCoords, yCoords, address as `0x${string}`],
      })) as [bigint, bigint];

      const unauthorized = Number(unauthorizedCount);
      const authorized = candidatePixels.length - unauthorized;

      console.log("Batch authorization check:", {
        candidatePixels: candidatePixels.length,
        totalFee: totalFee.toString(),
        unauthorizedCount: unauthorized,
        authorized,
        address,
        pixels: candidatePixels,
      });

      setAuthResults({ authorized, unauthorized });
      setBatchFeeInfo({
        totalFee,
        unauthorizedCount: unauthorized,
        authorized,
      });
    } catch (error) {
      console.error("Error checking batch update fees:", error);
      // Fallback to old logic if fee calculation fails
      let authorized = 0;
      let unauthorized = 0;

      for (const key of candidatePixels) {
        const [x, y] = key.split("-").map(Number);

        // Check if user owns the pixel (access pixelData directly)
        const owner = pixelData[key]?.owner || null;
        const isOwner = owner && owner.toLowerCase() === address?.toLowerCase();
        if (isOwner) {
          authorized++;
          continue;
        }

        // Check delegation
        try {
          const isAuthorized = (await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "isPixelAuthorized",
            args: [BigInt(x), BigInt(y), address as `0x${string}`],
          })) as boolean;

          if (isAuthorized) {
            authorized++;
          } else {
            unauthorized++;
          }
        } catch (error) {
          console.error(
            `Error checking authorization for pixel (${x}, ${y}):`,
            error
          );
          unauthorized++;
        }
      }

      setAuthResults({ authorized, unauthorized });
    }

    setIsCheckingAuth(false);
  }, [
    isConnected,
    address,
    publicClient,
    drawnPixelKeys,
    pendingMints,
    pendingUpdates,
    pixelData,
  ]);

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

  // Check authorization and fee requirements when pixel is selected
  useEffect(() => {
    if (!selectedPixel || !isConnected || !publicClient || !address) {
      setPixelAuthStatus(null);
      setFeeRequired(BigInt(0));
      setHasExemption(false);
      setIsCheckingFee(false);
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
      isChecking: !Boolean(isOwner), // Only check contract if not owner
    });

    // If not owner, check delegation and fee requirements
    if (!isOwner) {
      setIsCheckingFee(true);

      const checkDelegationAndFee = async () => {
        try {
          // Check both authorization and fee requirements in parallel
          const [isAuthorized, feeResult, exemption] = await Promise.all([
            publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: "isPixelAuthorized",
              args: [BigInt(x), BigInt(y), address as `0x${string}`],
            }) as Promise<boolean>,
            publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: "calculateUpdateFee",
              args: [BigInt(x), BigInt(y), address as `0x${string}`],
            }) as Promise<[bigint, boolean]>,
            publicClient.readContract({
              address: CONTRACT_ADDRESS as `0x${string}`,
              abi: PXNFT_ABI,
              functionName: "hasExemption",
              args: [address as `0x${string}`],
            }) as Promise<boolean>,
          ]);

          const [fee, requiresFee] = feeResult;

          console.log("Single pixel authorization check:", {
            x,
            y,
            isAuthorized,
            fee: fee.toString(),
            requiresFee,
            hasExemption: exemption,
            address,
          });

          // Only update if this is still the selected pixel
          setPixelAuthStatus((prev) => {
            if (prev && prev.x === x && prev.y === y) {
              return {
                ...prev,
                isAuthorized,
                isChecking: false,
              };
            }
            return prev;
          });

          setFeeRequired(fee);
          setHasExemption(exemption);
          setIsCheckingFee(false);
        } catch (error) {
          console.error("Error checking pixel authorization and fee:", error);
          setPixelAuthStatus((prev) => {
            if (prev && prev.x === x && prev.y === y) {
              return {
                ...prev,
                isAuthorized: false,
                isChecking: false,
              };
            }
            return prev;
          });
          setFeeRequired(BigInt(0));
          setHasExemption(false);
          setIsCheckingFee(false);
        }
      };

      checkDelegationAndFee();
    } else {
      // Owner doesn't need to pay fees
      setFeeRequired(BigInt(0));
      setHasExemption(false);
      setIsCheckingFee(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPixel, isConnected, publicClient, address]);
  // Function to batch revoke approvals
  const batchRevokeApprovals = async () => {
    if (!isConnected || !address || drawnPixels.size === 0) return;

    const pixelArray: [number, number][] = [];
    for (const [key] of drawnPixels.entries()) {
      const [x, y] = key.split("-").map(Number);
      if (isPixelMinted(x, y) && canUpdatePixel(x, y)) {
        pixelArray.push([x, y]);
      }
    }

    if (pixelArray.length === 0) {
      addNotification(
        "error",
        "No Valid Pixels",
        "No owned pixels found to revoke approvals"
      );
      return;
    }

    try {
      setIsRevokingApproval(true);

      const xCoords = pixelArray.map(([x]) => BigInt(x));
      const yCoords = pixelArray.map(([, y]) => BigInt(y));

      // For batch revoke, we need to know which addresses to revoke
      if (revokeAddresses.length === 0) {
        addNotification(
          "error",
          "No Addresses Selected",
          "Please specify which addresses to revoke from in revoke mode"
        );
        return;
      }

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: PXNFT_ABI,
        functionName: "batchRevokePixelMulti",
        args: [xCoords, yCoords, revokeAddresses as `0x${string}`[]],
      });

      console.log("Batch revoke approval transaction submitted:", txHash);
      addNotification(
        "success",
        "Batch Revocation Complete",
        `Successfully revoked approvals for ${pixelArray.length} pixels`
      );

      // Clear drawing mode
      setDrawnPixels(new Map());
      setIsDrawMode(false);
    } catch (error) {
      console.error("Error batch revoking approvals:", error);
      addNotification(
        "error",
        "Batch Revocation Failed",
        "Failed to revoke batch approvals"
      );
    } finally {
      setIsRevokingApproval(false);
    }
  };

  // Function to check pixel approval status using the full list from blockchain
  const checkPixelApproval = useCallback(
    async (x: number, y: number) => {
      if (!publicClient || !address) return;

      try {
        // First check if the user owns the pixel
        const tokenId = y * CANVAS_WIDTH + x;
        const owner = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })) as string;

        // Only fetch approvals if the user owns the pixel
        if (owner && owner.toLowerCase() === address.toLowerCase()) {
          const approvedAddresses = (await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "getPixelApprovedAddressesList",
            args: [BigInt(x), BigInt(y)],
          })) as string[];

          setPixelApprovedAddresses(approvedAddresses);
        } else {
          setPixelApprovedAddresses([]);
        }
      } catch (error) {
        console.error("Error checking pixel approval:", error);
        setPixelApprovedAddresses([]);
      }
    },
    [publicClient, address]
  );

  //Check delegation count for any pixel
  const checkPixelDelegationCount = useCallback(
    async (x: number, y: number) => {
      if (!publicClient) return;

      try {
        setIsLoadingPixelDelegations(true);

        // Check if pixel is minted by trying to get its owner
        const tokenId = y * CANVAS_WIDTH + x;
        let isMinted = false;
        try {
          await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "ownerOf",
            args: [BigInt(tokenId)],
          });
          isMinted = true;
        } catch {
          // If ownerOf fails, the pixel is not minted
          isMinted = false;
        }

        // Only check delegation for minted pixels
        if (!isMinted) {
          setPixelDelegationCount(0);
          setPixelDelegatedAddresses([]);
          return;
        }

        const count = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "getPixelApprovalCount",
          args: [BigInt(x), BigInt(y)],
        })) as bigint;

        setPixelDelegationCount(Number(count));

        // Also fetch the actual addresses for the popup
        if (Number(count) > 0) {
          const addresses = (await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "getPixelApprovedAddressesList",
            args: [BigInt(x), BigInt(y)],
          })) as string[];

          setPixelDelegatedAddresses(addresses);
        } else {
          setPixelDelegatedAddresses([]);
        }
      } catch (error) {
        console.error("Error checking pixel delegation count:", error);
        setPixelDelegationCount(0);
        setPixelDelegatedAddresses([]);
      } finally {
        setIsLoadingPixelDelegations(false);
      }
    },
    [publicClient]
  );

  const checkBatchDelegationData = useCallback(
    async (pixelKeys: string[]) => {
      if (!publicClient || pixelKeys.length === 0) return;

      try {
        setIsLoadingBatchDelegations(true);

        const pixelData = [];
        let totalDelegations = 0;

        // Process pixels in batches to avoid overwhelming the RPC
        const batchSize = 10;
        for (let i = 0; i < pixelKeys.length; i += batchSize) {
          const batch = pixelKeys.slice(i, i + batchSize);

          const batchPromises = batch.map(async (key) => {
            const [x, y] = key.split("-").map(Number);

            // Only check delegation for minted pixels
            if (!isPixelMinted(x, y)) {
              return {
                x,
                y,
                delegationCount: 0,
                delegatedAddresses: [],
              };
            }

            try {
              const count = (await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: PXNFT_ABI,
                functionName: "getPixelApprovalCount",
                args: [BigInt(x), BigInt(y)],
              })) as bigint;

              const delegationCount = Number(count);
              let delegatedAddresses: string[] = [];

              if (delegationCount > 0) {
                delegatedAddresses = (await publicClient.readContract({
                  address: CONTRACT_ADDRESS as `0x${string}`,
                  abi: PXNFT_ABI,
                  functionName: "getPixelApprovedAddressesList",
                  args: [BigInt(x), BigInt(y)],
                })) as string[];
              }

              return {
                x,
                y,
                delegationCount,
                delegatedAddresses,
              };
            } catch (error) {
              console.error(
                `Error checking delegation for pixel (${x}, ${y}):`,
                error
              );
              return {
                x,
                y,
                delegationCount: 0,
                delegatedAddresses: [],
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          pixelData.push(...batchResults);
          totalDelegations += batchResults.reduce(
            (sum, pixel) => sum + pixel.delegationCount,
            0
          );
        }

        setBatchDelegationData({
          totalDelegations,
          pixelData,
        });
      } catch (error) {
        console.error("Error checking batch delegation data:", error);
        setBatchDelegationData({ totalDelegations: 0, pixelData: [] });
      } finally {
        setIsLoadingBatchDelegations(false);
      }
    },
    [publicClient, isPixelMinted]
  );

  // Revoke delegation functions for popup
  const revokeSingleDelegation = useCallback(
    async (x: number, y: number, operatorAddress: string) => {
      if (!writeContractAsync || !address) return;

      try {
        setRevokingAddress(operatorAddress);
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "revokePixelMulti",
          args: [BigInt(x), BigInt(y), operatorAddress as `0x${string}`],
        });

        addNotification(
          "success",
          "Delegation Revoked!",
          `Successfully revoked delegation for ${operatorAddress.slice(
            0,
            6
          )}...${operatorAddress.slice(-4)}`,
          hash
        );

        // Refresh delegation data
        setTimeout(() => {
          checkPixelDelegationCount(x, y);
          // Also refresh batch data if in batch mode
          if (drawnPixels.size > 0) {
            const pixelKeys = Array.from(drawnPixels.keys());
            checkBatchDelegationData(pixelKeys);
          }
        }, 2000);
      } catch (error) {
        console.error("Error revoking delegation:", error);
        addNotification(
          "error",
          "Revoke Failed",
          "Failed to revoke delegation"
        );
      } finally {
        setRevokingAddress(null);
      }
    },
    [
      writeContractAsync,
      address,
      addNotification,
      checkPixelDelegationCount,
      drawnPixels,
      checkBatchDelegationData,
    ]
  );

  const revokeAllDelegations = useCallback(
    async (x: number, y: number, addresses: string[]) => {
      if (!writeContractAsync || !address || addresses.length === 0) return;

      try {
        setIsRevokingApproval(true);
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "batchRevokePixelMulti",
          args: [[BigInt(x)], [BigInt(y)], addresses as `0x${string}`[]],
        });

        addNotification(
          "success",
          "All Delegations Revoked!",
          `Successfully revoked all ${addresses.length} delegations`,
          hash
        );

        // Refresh delegation data
        setTimeout(() => {
          checkPixelDelegationCount(x, y);
          // Also refresh batch data if in batch mode
          if (drawnPixels.size > 0) {
            const pixelKeys = Array.from(drawnPixels.keys());
            checkBatchDelegationData(pixelKeys);
          }
        }, 2000);
      } catch (error) {
        console.error("Error revoking all delegations:", error);
        addNotification(
          "error",
          "Revoke All Failed",
          "Failed to revoke all delegations"
        );
      } finally {
        setIsRevokingApproval(false);
      }
    },
    [
      writeContractAsync,
      address,
      addNotification,
      checkPixelDelegationCount,
      drawnPixels,
      checkBatchDelegationData,
    ]
  );

  // New revoke functions for selective address revocation
  const batchRevokePixelsMultiSingleTx = async (
    pixels: Array<[number, number]>,
    fromAddresses: string[]
  ) => {
    if (!isConnected || !address) {
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    if (fromAddresses.length === 0) {
      addNotification(
        "error",
        "No Addresses",
        "Please enter at least one address to revoke"
      );
      return;
    }

    // Validate all addresses
    for (const addr of fromAddresses) {
      if (!addr || addr.length !== 42 || !addr.startsWith("0x")) {
        addNotification("error", "Invalid Address", `Invalid address: ${addr}`);
        return;
      }
    }

    if (pixels.length === 0) {
      addNotification(
        "error",
        "No Pixels",
        "Please select pixels to revoke approvals from"
      );
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification(
          "error",
          "Not Owner",
          `You do not own pixel (${x}, ${y})`
        );
        return;
      }
    }

    setIsRevoking(true);

    try {
      const xCoords = pixels.map(([x]) => BigInt(x));
      const yCoords = pixels.map(([, y]) => BigInt(y));

      // Try the batch revoke function for multiple addresses
      try {
        const operators = fromAddresses.map((addr) => addr as `0x${string}`);

        addNotification(
          "info",
          "Single Transaction Multi-Revocation",
          `Revoking ${pixels.length} pixels from ${fromAddresses.length} addresses in one transaction...`
        );

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "batchRevokePixelMulti",
          args: [xCoords, yCoords, operators],
        });

        setPendingTxHash(hash);
        setPendingTxType("revocation");
        setPendingBatchSize(pixels.length * fromAddresses.length);

        addNotification(
          "success",
          "Multi-Revocation Submitted",
          `Single transaction: ${pixels.length} pixels revoked from ${fromAddresses.length} addresses`,
          hash
        );
      } catch (contractError) {
        console.log(
          "Batch revoke function not available, falling back to multiple transactions:",
          contractError
        );

        // Fallback to multiple transactions using standard revoke
        addNotification(
          "info",
          "Multi-Revocation Fallback",
          `Using multiple transactions for ${fromAddresses.length} addresses...`
        );

        let lastHash: `0x${string}` | undefined;

        for (let i = 0; i < fromAddresses.length; i++) {
          const hash = await writeContractAsync({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: PXNFT_ABI,
            functionName: "batchRevokePixelMulti",
            args: [xCoords, yCoords, [fromAddresses[i] as `0x${string}`]],
          });

          lastHash = hash;
          addNotification(
            "info",
            `Revocation ${i + 1}/${fromAddresses.length}`,
            `Revoked all approvals for selected pixels (ERC721 limitation)`,
            hash
          );
          break;
        }

        if (lastHash) {
          setPendingTxHash(lastHash);
          setPendingTxType("revocation");
          setPendingBatchSize(pixels.length);
        }
      }
    } catch (error: Error | unknown) {
      console.error("Error multi-revoking:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to revoke pixel approvals";
      addNotification("error", "Multi-Revocation Failed", errorMessage);
    } finally {
      setIsRevoking(false);
    }
  };

  const batchRevokePixelsSingleAddress = async (
    pixels: Array<[number, number]>,
    fromAddress: string
  ) => {
    if (!isConnected || !address) {
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    if (
      !fromAddress ||
      fromAddress.length !== 42 ||
      !fromAddress.startsWith("0x")
    ) {
      addNotification(
        "error",
        "Invalid Address",
        "Please enter a valid address to revoke"
      );
      return;
    }

    if (pixels.length === 0) {
      addNotification(
        "error",
        "No Pixels",
        "Please select pixels to revoke approvals from"
      );
      return;
    }

    // Check ownership of all pixels
    for (const [x, y] of pixels) {
      const pixelOwner = getPixelOwner(x, y);
      if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
        addNotification(
          "error",
          "Not Owner",
          `You do not own pixel (${x}, ${y})`
        );
        return;
      }
    }

    setIsRevoking(true);

    try {
      const xCoords = pixels.map(([x]) => BigInt(x));
      const yCoords = pixels.map(([, y]) => BigInt(y));

      // Try the custom multi-approval revoke function first
      try {
        addNotification(
          "info",
          "Revoking Approvals",
          `Revoking ${pixels.length} pixels from ${fromAddress.slice(
            0,
            6
          )}...${fromAddress.slice(-4)}`
        );

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "batchRevokePixelMulti",
          args: [xCoords, yCoords, [fromAddress as `0x${string}`]],
        });

        setPendingTxHash(hash);
        setPendingTxType("revocation");
        setPendingBatchSize(pixels.length);

        addNotification(
          "success",
          "Revocation Submitted",
          `Revoked ${pixels.length} pixels from ${fromAddress.slice(
            0,
            6
          )}...${fromAddress.slice(-4)}`,
          hash
        );
      } catch (contractError) {
        console.log(
          "Custom revoke function not available, using standard revoke:",
          contractError
        );

        // Fallback to custom multi-approval revoke (revokes from selected addresses)
        if (revokeAddresses.length === 0) {
          addNotification(
            "error",
            "No Addresses Selected",
            "Please specify which addresses to revoke from in revoke mode"
          );
          return;
        }

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "batchRevokePixelMulti",
          args: [xCoords, yCoords, revokeAddresses as `0x${string}`[]],
        });

        setPendingTxHash(hash);
        setPendingTxType("revocation");
        setPendingBatchSize(pixels.length);

        addNotification(
          "success",
          "Revocation Submitted",
          `Revoked all approvals for ${pixels.length} pixels (ERC721 standard)`,
          hash
        );
      }
    } catch (error: Error | unknown) {
      console.error("Error revoking:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to revoke pixel approvals";
      addNotification("error", "Revocation Failed", errorMessage);
    } finally {
      setIsRevoking(false);
    }
  };

  const revokePixelFromAddress = async (
    x: number,
    y: number,
    fromAddress: string
  ) => {
    if (!isConnected || !address) {
      addNotification(
        "error",
        "Not Connected",
        "Please connect your wallet first"
      );
      return;
    }

    if (
      !fromAddress ||
      fromAddress.length !== 42 ||
      !fromAddress.startsWith("0x")
    ) {
      addNotification(
        "error",
        "Invalid Address",
        "Please enter a valid address to revoke"
      );
      return;
    }

    const pixelOwner = getPixelOwner(x, y);
    if (!pixelOwner || pixelOwner.toLowerCase() !== address.toLowerCase()) {
      addNotification(
        "error",
        "Not Owner",
        `You do not own pixel (${x}, ${y})`
      );
      return;
    }

    setIsRevoking(true);

    try {
      try {
        addNotification(
          "info",
          "Revoking Approval",
          `Revoking pixel (${x}, ${y}) from ${fromAddress.slice(
            0,
            6
          )}...${fromAddress.slice(-4)}`
        );

        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: PXNFT_ABI,
          functionName: "revokePixelMulti",
          args: [BigInt(x), BigInt(y), fromAddress as `0x${string}`],
        });

        setPendingTxHash(hash);
        setPendingTxType("revocation");
        setPendingBatchSize(1);

        addNotification(
          "success",
          "Revocation Submitted",
          `Revoked pixel (${x}, ${y}) from ${fromAddress.slice(
            0,
            6
          )}...${fromAddress.slice(-4)}`,
          hash
        );
      } catch (contractError) {
        console.log(
          "Custom revoke function not available, using standard revoke:",
          contractError
        );
      }
    } catch (error: Error | unknown) {
      console.error("Error revoking:", error);
      const errorMessage = (error as Error)?.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : "Failed to revoke pixel approval";
      addNotification("error", "Revocation Failed", errorMessage);
    } finally {
      setIsRevoking(false);
    }
  };

  // Check pixel approval when pixel is selected
  useEffect(() => {
    if (selectedPixel && isConnected && address) {
      const [x, y] = selectedPixel;
      const pixelKey = `${x}-${y}`;

      // Only check if we haven't already checked this pixel AND the pixel is minted
      if (lastCheckedApprovalPixel.current !== pixelKey && isPixelMinted(x, y)) {
        checkPixelApproval(x, y);
        lastCheckedApprovalPixel.current = pixelKey;
      } else if (!isPixelMinted(x, y)) {
        // Clear approvals for unminted pixels
        setPixelApprovedAddresses([]);
        lastCheckedApprovalPixel.current = pixelKey;
      }
    } else {
      setPixelApprovedAddresses([]);
      lastCheckedApprovalPixel.current = null;
    }
  }, [selectedPixel, isConnected, address, checkPixelApproval, isPixelMinted]);

  // Check delegation count for any selected pixel (regardless of ownership)
  useEffect(() => {
    if (selectedPixel) {
      const [x, y] = selectedPixel;
      const pixelKey = `${x}-${y}`;

      // Only check if we haven't already checked this pixel
      if (lastCheckedDelegationPixel.current !== pixelKey) {
        checkPixelDelegationCount(x, y);
        lastCheckedDelegationPixel.current = pixelKey;
      }
    } else {
      setPixelDelegationCount(0);
      setPixelDelegatedAddresses([]);
      lastCheckedDelegationPixel.current = null;
    }
    // Close delegation popup when pixel changes
    setShowDelegationPopup(false);
  }, [selectedPixel, checkPixelDelegationCount]);

  // Effect to check batch delegation data when pixels are selected in delegation/revoke modes OR draw mode
  useEffect(() => {
    if (
      (isDelegateMode || isRevokeMode || isDrawMode) &&
      drawnPixels.size > 0
    ) {
      const pixelKeys = Array.from(drawnPixels.keys());
      checkBatchDelegationData(pixelKeys);
    } else {
      setBatchDelegationData({ totalDelegations: 0, pixelData: [] });
    }
    setShowBatchDelegationPopup(false);
  }, [
    isDelegateMode,
    isRevokeMode,
    isDrawMode,
    drawnPixels,
    checkBatchDelegationData,
  ]);

  // Handle escape key for delegation popup
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showBatchDelegationPopup) {
          setShowBatchDelegationPopup(false);
          setExpandedPixel(null);
        } else if (showDelegationPopup) {
          setShowDelegationPopup(false);
        }
      }
    };

    if (showDelegationPopup || showBatchDelegationPopup) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [showDelegationPopup, showBatchDelegationPopup]);

  const isPixelPending = (x: number, y: number) => {
    const key = `${x}-${y}`;
    return pendingMints.has(key) || pendingUpdates.has(key);
  };

  // Calculate zoom percentage for display
  const zoomPercentage = Math.round(
    ((MAX_VIEWPORT_SIZE - viewportSize) /
      (MAX_VIEWPORT_SIZE - MIN_VIEWPORT_SIZE)) *
      100
  );

  const handleGoToPosition = () => {
    const x = parseInt(positionX);
    const y = parseInt(positionY);

    // Validate input
    if (
      isNaN(x) ||
      isNaN(y) ||
      x < 0 ||
      y < 0 ||
      x >= CANVAS_WIDTH ||
      y >= CANVAS_HEIGHT
    ) {
      alert(
        `Please enter valid coordinates (0-${CANVAS_WIDTH - 1}, 0-${
          CANVAS_HEIGHT - 1
        })`
      );
      return;
    }

    // Calculate new viewport position to center the target pixel
    const newViewportX = Math.max(
      0,
      Math.min(CANVAS_WIDTH - viewportSize, x - Math.floor(viewportSize / 2))
    );
    const newViewportY = Math.max(
      0,
      Math.min(CANVAS_HEIGHT - viewportSize, y - Math.floor(viewportSize / 2))
    );

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
    setPositionX("");
    setPositionY("");
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
        {/* Header */}
        <Header
          CANVAS_WIDTH={CANVAS_WIDTH}
          CANVAS_HEIGHT={CANVAS_HEIGHT}
          MIN_VIEWPORT_SIZE={MIN_VIEWPORT_SIZE}
          MAX_VIEWPORT_SIZE={MAX_VIEWPORT_SIZE}
          showPositionInput={showPositionInput}
          setShowPositionInput={setShowPositionInput}
          positionX={positionX}
          positionY={positionY}
          setPositionX={setPositionX}
          setPositionY={setPositionY}
          handleGoToPosition={handleGoToPosition}
          isDrawMode={isDrawMode}
          toggleDrawMode={toggleDrawMode}
          isAreaSelectMode={isAreaSelectMode}
          setIsAreaSelectMode={setIsAreaSelectMode}
          isDelegateMode={isDelegateMode}
          setIsDelegateMode={setIsDelegateMode}
          isRevokeMode={isRevokeMode}
          setIsRevokeMode={setIsRevokeMode}
          setIsDrawMode={setIsDrawMode}
          setSelectedPixel={setSelectedPixel}
          setDrawnPixels={setDrawnPixels}
          setShowDelegateInput={setShowDelegateInput}
          setShowRevokeInput={setShowRevokeInput}
          setSelectedArea={setSelectedArea}
          setAreaSelectionStart={setAreaSelectionStart}
          setIsAreaDragging={setIsAreaDragging}
          delegateAddress={delegateAddress}
          setDelegateAddress={setDelegateAddress}
          delegateAddresses={delegateAddresses}
          setDelegateAddresses={setDelegateAddresses}
          isMultiAddressMode={isMultiAddressMode}
          setIsMultiAddressMode={setIsMultiAddressMode}
          isBatchDelegate={isBatchDelegate}
          setIsBatchDelegate={setIsBatchDelegate}
          setDelegateSelectedArea={setDelegateSelectedArea}
          setDelegateAreaStart={setDelegateAreaStart}
          setIsDelegateAreaDragging={setIsDelegateAreaDragging}
          showDelegateInput={showDelegateInput}
          isDelegating={isDelegating}
          revokeAddress={revokeAddress}
          setRevokeAddress={setRevokeAddress}
          revokeAddresses={revokeAddresses}
          setRevokeAddresses={setRevokeAddresses}
          isRevokeMultiAddressMode={isRevokeMultiAddressMode}
          setIsRevokeMultiAddressMode={setIsRevokeMultiAddressMode}
          isBatchRevoke={isBatchRevoke}
          setIsBatchRevoke={setIsBatchRevoke}
          setRevokeSelectedArea={setRevokeSelectedArea}
          setRevokeAreaStart={setRevokeAreaStart}
          setIsRevokeAreaDragging={setIsRevokeAreaDragging}
          showRevokeInput={showRevokeInput}
          isRevoking={isRevoking}
          drawnPixels={drawnPixels}
          isBatchMinting={isBatchMinting}
          isBatchUpdating={isBatchUpdating}
          batchMintPixels={batchMintPixels}
          batchUpdatePixels={batchUpdatePixels}
          clearDrawing={clearDrawing}
          isPixelMinted={isPixelMinted}
          isPixelPending={isPixelPending}
          canUpdatePixel={canUpdatePixel}
          selectedPixel={selectedPixel}
          batchDelegatePixels={batchDelegatePixels}
          batchDelegatePixelsMultiSingleTx={batchDelegatePixelsMultiSingleTx}
          delegatePixel={delegatePixel}
          batchRevokePixelsSingleAddress={batchRevokePixelsSingleAddress}
          batchRevokePixelsMultiSingleTx={batchRevokePixelsMultiSingleTx}
          revokePixelFromAddress={revokePixelFromAddress}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          viewportSize={viewportSize}
          zoomPercentage={zoomPercentage}
          setIsLoadingChunks={setIsLoadingChunks}
          loadVisiblePixels={loadVisiblePixels}
          isLoadingChunks={isLoadingChunks}
          isLoading={isLoading}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          isConnected={isConnected}
          addNotification={addNotification}
        />

        {/* Full Screen Canvas - No container, direct grid */}
        <div
          className="absolute inset-0 bg-gray-100 select-none"
          style={{
            cursor: isDraggingCanvas ? "grabbing" : "default",
            touchAction: "none", // Prevent default touch behaviors
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
                    width: `${
                      (loadingProgress.current / loadingProgress.total) * 100
                    }%`,
                  }}
                ></div>
              </div>
              <div className="text-center text-gray-300">
                (
                {Math.round(
                  (loadingProgress.current / loadingProgress.total) * 100
                )}
                %)
              </div>
            </div>
          )}

          {/* Direct pixel grid - fills entire screen */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                padding: screenSize.width < 768 ? "8px" : "16px",
                minHeight: "0", // Allow flex shrinking
              }}
            >
              <div
                className="grid bg-gray-200"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(
                    viewportSize,
                    CANVAS_WIDTH - viewportX
                  )}, 1fr)`,
                  gridTemplateRows: `repeat(${Math.min(
                    viewportSize,
                    CANVAS_HEIGHT - viewportY
                  )}, 1fr)`,
                  gap: "1px",
                  padding: "1px",
                  // Dynamic sizing based on zoom level
                  width:
                    viewportSize >= MAX_VIEWPORT_SIZE
                      ? // Full canvas view - use smaller dimension to fit square
                        screenSize.width < 768
                        ? "min(calc(100vw - 16px), calc(100vh - 16px))"
                        : showSidebar
                        ? "min(calc(100vw - 340px), calc(100vh - 32px))"
                        : "min(calc(100vw - 32px), calc(100vh - 32px))"
                      : // Zoomed in view - fill available space
                      screenSize.width < 768
                      ? "calc(100vw - 16px)"
                      : showSidebar
                      ? "calc(100vw - 340px)"
                      : "calc(100vw - 32px)",
                  height:
                    viewportSize >= MAX_VIEWPORT_SIZE
                      ? // Full canvas view - use smaller dimension to fit square
                        screenSize.width < 768
                        ? "min(calc(100vw - 16px), calc(100vh - 16px))"
                        : showSidebar
                        ? "min(calc(100vw - 340px), calc(100vh - 32px))"
                        : "min(calc(100vw - 32px), calc(100vh - 32px))"
                      : // Zoomed in view - fill available space
                      screenSize.width < 768
                      ? "calc(100vh - 16px)"
                      : "calc(100vh - 32px)",
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              >
                {memoizedPixelGrid.map(({ globalX, globalY }) => {
                  const isSelected =
                    selectedPixel?.[0] === globalX &&
                    selectedPixel?.[1] === globalY;
                  const isHighlighted =
                    highlightedPixel?.[0] === globalX &&
                    highlightedPixel?.[1] === globalY;
                  const isMinted = isPixelMinted(globalX, globalY);
                  const isPending = isPixelPending(globalX, globalY);
                  const pixelColor = getPixelColor(globalX, globalY);
                  const isDrawn =
                    isDrawMode && drawnPixels.has(`${globalX}-${globalY}`);

                  // Check if pixel is in selected area (composition)
                  const isInSelectedArea =
                    selectedArea &&
                    globalX >= selectedArea.startX &&
                    globalX <= selectedArea.endX &&
                    globalY >= selectedArea.startY &&
                    globalY <= selectedArea.endY;

                  // Check if pixel is owned by user in the selected area (composition)
                  const isOwnedInArea =
                    isInSelectedArea &&
                    ownedPixelsInArea.includes(getTokenId(globalX, globalY));

                  // Check if pixel is in delegation area selection
                  const isInDelegateArea =
                    delegateSelectedArea &&
                    globalX >= delegateSelectedArea.startX &&
                    globalX <= delegateSelectedArea.endX &&
                    globalY >= delegateSelectedArea.startY &&
                    globalY <= delegateSelectedArea.endY;

                  // Check if pixel is owned and selected for delegation
                  const isOwnedForDelegation =
                    isInDelegateArea && canUpdatePixel(globalX, globalY);

                  // Check if pixel is in revoke area selection
                  const isInRevokeArea =
                    revokeSelectedArea &&
                    globalX >= revokeSelectedArea.startX &&
                    globalX <= revokeSelectedArea.endX &&
                    globalY >= revokeSelectedArea.startY &&
                    globalY <= revokeSelectedArea.endY;

                  // Check if pixel is owned and can be revoked
                  const isOwnedForRevoke =
                    isInRevokeArea && canUpdatePixel(globalX, globalY);

                  // Determine border style based on state
                  let borderStyle = "none";
                  if (isHighlighted) {
                    borderStyle = "2px solid #f59e0b";
                  } else if (isSelected) {
                    borderStyle = "2px solid #3b82f6";
                  } else if (isOwnedForRevoke) {
                    borderStyle = "2px solid #dc2626"; // Red for owned pixels in revoke area
                  } else if (isInRevokeArea) {
                    borderStyle = "2px solid #f87171"; // Light red for revoke area selection
                  } else if (isOwnedForDelegation) {
                    borderStyle = "2px solid #4F46E5"; // Blue for owned pixels in delegation area
                  } else if (isInDelegateArea) {
                    borderStyle = "2px solid #6B7280"; // Gray for delegation area selection
                  } else if (isOwnedInArea) {
                    borderStyle = "2px solid #10b981"; // Green for owned pixels in area
                  } else if (isInSelectedArea) {
                    borderStyle = "2px solid #a855f7"; // Purple for area selection
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
                        ${
                          isOwnedForRevoke
                            ? "ring-2 ring-red-600"
                            : isInRevokeArea
                            ? "ring-2 ring-red-300"
                            : isOwnedForDelegation
                            ? "ring-2 ring-blue-500"
                            : isInDelegateArea
                            ? "ring-2 ring-gray-400"
                            : ""
                        }
                        ${
                          isOwnedInArea
                            ? "ring-2 ring-green-400"
                            : isInSelectedArea
                            ? "ring-2 ring-purple-400"
                            : ""
                        }
                      `}
                      style={{
                        backgroundColor: pixelColor,
                        border: borderStyle,
                        aspectRatio: "1 / 1", // Force each pixel to be square
                        boxShadow: isHighlighted
                          ? "0 0 10px rgba(245, 158, 11, 0.8)"
                          : "none",
                      }}
                      title={`Pixel (${globalX}, ${globalY}) ${
                        isMinted ? "- Minted" : "- Available"
                      }${isPending ? " - Pending" : ""}${
                        isDrawn ? " - Selected for minting" : ""
                      }${isHighlighted ? " - Found!" : ""}`}
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
            ({viewportX}, {viewportY}) | {viewportSize}×{viewportSize} |{" "}
            {Object.keys(pixelData).length} minted
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
      <Sidebar
        showSidebar={showSidebar}
        sidebarPosition={sidebarPosition}
        isDraggingSidebar={isDraggingSidebar}
        totalMinted={totalMinted}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        colorPalette={colorPalette}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        customHexColor={customHexColor}
        setCustomHexColor={setCustomHexColor}
        showHexInput={showHexInput}
        setShowHexInput={setShowHexInput}
        applyHexColor={applyHexColor}
        handleHexKeyPress={handleHexKeyPress}
        isAreaSelectMode={isAreaSelectMode}
        selectedArea={selectedArea}
        compositionInfo={compositionInfo}
        isConnected={isConnected}
        isComposing={isComposing}
        composePixels={composePixels}
        setSelectedArea={setSelectedArea}
        setAreaSelectionStart={setAreaSelectionStart}
        setIsAreaDragging={setIsAreaDragging}
        selectedPixel={selectedPixel}
        isDrawMode={isDrawMode}
        drawnPixels={drawnPixels}
        pixelData={pixelData}
        getPixelOwner={getPixelOwner}
        isLoadingPixelDelegations={isLoadingPixelDelegations}
        pixelDelegationCount={pixelDelegationCount}
        pixelDelegatedAddresses={pixelDelegatedAddresses}
        setShowDelegationPopup={setShowDelegationPopup}
        isDelegateMode={isDelegateMode}
        isRevokeMode={isRevokeMode}
        isLoadingBatchDelegations={isLoadingBatchDelegations}
        batchDelegationData={batchDelegationData}
        setShowBatchDelegationPopup={setShowBatchDelegationPopup}
        isPixelMinted={isPixelMinted}
        isPixelPending={isPixelPending}
        canUpdatePixel={canUpdatePixel}
        getTokenId={getTokenId}
        mintPixel={mintPixel}
        updatePixel={updatePixel}
        isMinting={isMinting}
        isBatchMinting={isBatchMinting}
        isBatchUpdating={isBatchUpdating}
        batchMintPixels={batchMintPixels}
        batchUpdatePixels={batchUpdatePixels}
        batchRevokeApprovals={batchRevokeApprovals}
        clearDrawing={clearDrawing}
        toggleDrawMode={toggleDrawMode}
        isCheckingAuth={isCheckingAuth}
        authResults={authResults}
        batchFeeInfo={batchFeeInfo}
        pixelAuthStatus={pixelAuthStatus}
        isCheckingFee={isCheckingFee}
        hasExemption={hasExemption}
        feeRequired={feeRequired}
        isRevokingApproval={isRevokingApproval}
        setShowSidebar={setShowSidebar}
        handleSidebarDragStart={handleSidebarDragStart}
        handleSidebarTouchStart={handleSidebarTouchStart}
      />

      {/* Notification Container section */}
      <div
        className={`fixed ${
          isDelegateMode ? "bottom-4 right-4" : "top-20 right-4"
        } z-50 space-y-2 pointer-events-none`}
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              w-80 pointer-events-auto
              bg-white rounded-lg shadow-lg border-l-4 p-3
              transform transition-all duration-300 ease-in-out
              ${
                notification.type === "success"
                  ? "border-green-500"
                  : notification.type === "error"
                  ? "border-red-500"
                  : "border-blue-500"
              }
              animate-slide-in-right
            `}
            style={{
              animation: "slideInRight 0.3s ease-out",
            }}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === "success" && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                {notification.type === "error" && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✕</span>
                  </div>
                )}
                {notification.type === "info" && (
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
                {/* Explorer link for success notifications with txHash */}
                {notification.type === "success" && notification.txHash && (
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

      <IndividualDelegationPopup
        show={showDelegationPopup}
        onClose={() => setShowDelegationPopup(false)}
        selectedPixel={selectedPixel}
        pixelDelegatedAddresses={pixelDelegatedAddresses}
        isRevokingApproval={isRevokingApproval}
        revokingAddress={revokingAddress}
        address={address}
        getPixelOwner={getPixelOwner}
        copyToClipboard={copyToClipboard}
        revokeSingleDelegation={revokeSingleDelegation}
        revokeAllDelegations={revokeAllDelegations}
      />

      <BatchDelegationPopup
        show={showBatchDelegationPopup}
        onClose={() => setShowBatchDelegationPopup(false)}
        batchDelegationData={batchDelegationData}
        expandedPixel={expandedPixel}
        setExpandedPixel={setExpandedPixel}
        isRevokingApproval={isRevokingApproval}
        revokingAddress={revokingAddress}
        address={address}
        getPixelOwner={getPixelOwner}
        copyToClipboard={copyToClipboard}
        revokeSingleDelegation={revokeSingleDelegation}
        revokeAllDelegations={revokeAllDelegations}
      />

      <CopyNotification
        show={copyNotification.show}
        address={copyNotification.address}
      />
    </div>
  );
}
