"use client";
import React, { ErrorInfo, ReactNode } from "react";
interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
}
export class MainErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: Error): State {
        const errorMsg = error.message?.toLowerCase() || "";
        const isMetaMaskError = errorMsg.includes("metamask") ||
            errorMsg.includes("injected") ||
            errorMsg.includes("provider") ||
            errorMsg.includes("walletconnect");
        if (isMetaMaskError) {
            return { hasError: false };
        }
        console.error("MainErrorBoundary caught an error:", error);
        return { hasError: true };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.debug("Error Info:", errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (<div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center">
          <h2 className="mb-4 text-xl font-bold text-white">Something went wrong</h2>
          <button className="rounded bg-white px-4 py-2 text-black" onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>);
        }
        return this.props.children;
    }
}
