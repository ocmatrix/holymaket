"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ErrorBoundary } from "./error-boundary";
import { SocketProvider } from "./socket-provider";
export default function Providers({ children }: {
    children: React.ReactNode;
}) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }));
    useEffect(() => {
        const originalError = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            if (typeof message === "string" && (message.includes("MetaMask") ||
                message.includes("ethereum") ||
                message.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn")) ||
                (source && typeof source === "string" && source.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn"))) {
                console.warn("Ignoring MetaMask extension error:", message);
                return true;
            }
            if (originalError) {
                return originalError(message, source, lineno, colno, error);
            }
            return false;
        };
        return () => {
            window.onerror = originalError;
        };
    }, []);
    return (<ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>);
}
