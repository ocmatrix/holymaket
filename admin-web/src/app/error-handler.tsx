"use client";
import { useEffect } from "react";
function isMetaMaskError(message: string, source?: string): boolean {
    const metaMaskKeywords = [
        "MetaMask",
        "metamask",
        "ethereum",
        "连接MetaMask",
        "连接 MetaMask",
        "MetaMask connection",
        "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn",
    ];
    const lowerMessage = message.toLowerCase();
    const hasKeyword = metaMaskKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()) ||
        source?.includes(keyword));
    return hasKeyword;
}
export function ErrorHandler() {
    useEffect(() => {
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = typeof reason === "string"
                ? reason
                : reason?.message || reason?.toString() || "";
            if (isMetaMaskError(message)) {
                console.warn("Ignoring MetaMask extension error:", message);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        };
        const handleError = (event: ErrorEvent) => {
            const { message, filename, error } = event;
            const errorMessage = message || error?.message || "";
            const source = filename || error?.stack || "";
            if (isMetaMaskError(errorMessage, source)) {
                console.warn("Ignoring MetaMask extension error:", errorMessage);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        };
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            const message = args.map(arg => typeof arg === "string" ? arg : JSON.stringify(arg)).join(" ");
            if (isMetaMaskError(message)) {
                return;
            }
            originalConsoleError.apply(console, args);
        };
        window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
        window.addEventListener("error", handleError, true);
        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
            window.removeEventListener("error", handleError, true);
            console.error = originalConsoleError;
        };
    }, []);
    return null;
}
