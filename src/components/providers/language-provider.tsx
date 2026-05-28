"use client";
import { useEffect, useState } from "react";
import { useLanguageStore, languages, type LanguageCode } from "../../stores/language-store";
export function LanguageProvider({ children }: {
    children: React.ReactNode;
}) {
    const { currentLanguage, setLanguage } = useLanguageStore();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const saved = localStorage.getItem("language-storage") as LanguageCode;
        if (saved && languages.some(l => l.code === saved)) {
            setLanguage(saved);
        }
        setMounted(true);
    }, [setLanguage]);
    useEffect(() => {
        if (!mounted)
            return;
        const langConfig = languages.find(l => l.code === currentLanguage) || languages[1];
        document.documentElement.lang = currentLanguage;
        document.documentElement.style.setProperty("--current-font", langConfig.fontFamily);
    }, [currentLanguage, mounted]);
    if (!mounted)
        return <>{children}</>;
    return <>{children}</>;
}
