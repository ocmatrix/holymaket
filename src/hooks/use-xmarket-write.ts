"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi } from "viem";
import { binaryPredictionMarketAbi } from "@/lib/contract-abis";

export function useXMarketWrite() {
    const {
        data: hash,
        error: writeError,
        isPending: isWritePending,
        writeContract,
        reset
    } = useWriteContract();

    const {
        isLoading: isConfirming,
        isSuccess,
        error: receiptError
    } = useWaitForTransactionReceipt({
        hash,
    });

    const error = writeError || receiptError;
    const isPending = isWritePending || isConfirming;

    const approveUsdt = (usdtAddress: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
        writeContract({
            address: usdtAddress,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, amount],
        });
    };

    const buy = (marketAddress: `0x${string}`, amount: bigint, minSharesOut: bigint, isYes: boolean) => {
        writeContract({
            address: marketAddress,
            abi: binaryPredictionMarketAbi,
            functionName: isYes ? "buyYes" : "buyNo",
            args: [amount, minSharesOut],
        });
    };

    const sell = (marketAddress: `0x${string}`, sharesIn: bigint, minCollateralOut: bigint, isYes: boolean) => {
        writeContract({
            address: marketAddress,
            abi: binaryPredictionMarketAbi,
            functionName: isYes ? "sellYes" : "sellNo",
            args: [sharesIn, minCollateralOut],
        });
    };

    const claim = (marketAddress: `0x${string}`) => {
        writeContract({
            address: marketAddress,
            abi: binaryPredictionMarketAbi,
            functionName: "claim",
        });
    };

    return {
        hash,
        isPending,
        isSuccess,
        error,
        approveUsdt,
        buy,
        sell,
        claim,
        reset
    };
}
