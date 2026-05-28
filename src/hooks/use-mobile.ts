"use client";
import { useState, useEffect } from "react";
const MOBILE_BREAKPOINT = 768;
let cachedIsMobile: boolean | null = null;
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(() => {
        if (cachedIsMobile !== null)
            return cachedIsMobile;
        if (typeof window === "undefined")
            return false;
        return window.innerWidth < MOBILE_BREAKPOINT;
    });
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const handler = (e: MediaQueryListEvent) => {
            cachedIsMobile = e.matches;
            setIsMobile(e.matches);
        };
        cachedIsMobile = mql.matches;
        setIsMobile(mql.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, []);
    return isMobile;
}
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === "undefined")
            return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });
    useEffect(() => {
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        setReduced(mql.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, []);
    return reduced;
}
export function usePageVisible(): boolean {
    const [visible, setVisible] = useState(() => {
        if (typeof document === "undefined")
            return true;
        return !document.hidden;
    });
    useEffect(() => {
        const handler = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", handler);
        return () => document.removeEventListener("visibilitychange", handler);
    }, []);
    return visible;
}
