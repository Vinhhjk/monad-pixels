import { useCallback } from 'react';

interface UseDelegationFunctionsProps {
  address: string | null;
  addNotification: (type: "success" | "error" | "info", title: string, message: string, txHash?: string) => void;
  setRevokingAddress: (address: string | null) => void;
  setIsRevokingApproval: (isRevoking: boolean) => void;
  checkPixelDelegationCount: (x: number, y: number) => void;
  checkBatchDelegationData: (pixelKeys?: string[]) => void;
  writeContractAsync: (args: Record<string, unknown>) => Promise<string>;
  CONTRACT_ADDRESS: string;
  PXNFT_ABI: readonly unknown[];
}

export function useDelegationFunctions({
  address,
  addNotification,
  setRevokingAddress,
  setIsRevokingApproval,
  checkPixelDelegationCount,
  checkBatchDelegationData,
  writeContractAsync,
  CONTRACT_ADDRESS,
  PXNFT_ABI,
}: UseDelegationFunctionsProps) {
  
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
          checkBatchDelegationData();
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
      checkBatchDelegationData,
      setRevokingAddress,
      CONTRACT_ADDRESS,
      PXNFT_ABI,
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
          checkBatchDelegationData();
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
      checkBatchDelegationData,
      setIsRevokingApproval,
      CONTRACT_ADDRESS,
      PXNFT_ABI,
    ]
  );

  return {
    revokeSingleDelegation,
    revokeAllDelegations,
  };
}
