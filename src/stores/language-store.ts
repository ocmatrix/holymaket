import { create } from "zustand";
import { translations, getTranslation } from "../lib/translations";
export type LanguageCode = "zh-TW" | "en" | "vi" | "th" | "hi";
export interface Language {
    code: LanguageCode;
    label: string;
    flag: string;
    fontFamily: string;
}
export const languages: Language[] = [
    {
        code: "zh-TW",
        label: "繁體",
        flag: "🇹🇼",
        fontFamily: "var(--font-noto-sans-tc), sans-serif"
    },
    {
        code: "en",
        label: "English",
        flag: "🇺🇸",
        fontFamily: "var(--font-inter), sans-serif"
    },
    {
        code: "vi",
        label: "Tiếng Việt",
        flag: "🇻🇳",
        fontFamily: "var(--font-roboto), sans-serif"
    },
    {
        code: "th",
        label: "ไทย",
        flag: "🇹🇭",
        fontFamily: "var(--font-noto-sans-thai), sans-serif"
    },
    {
        code: "hi",
        label: "हिन्दी",
        flag: "🇮🇳",
        fontFamily: "var(--font-noto-sans-devanagari), sans-serif"
    }
];
interface LanguageStore {
    currentLanguage: LanguageCode;
    t: any;
    isHydrated: boolean;
    setLanguage: (code: LanguageCode) => void;
    hydrate: () => void;
}
const DEFAULT_LANGUAGE: LanguageCode = "en";
export const useLanguageStore = create<LanguageStore>((set) => ({
    currentLanguage: DEFAULT_LANGUAGE,
    t: getTranslation(DEFAULT_LANGUAGE),
    isHydrated: false,
    setLanguage: (code: LanguageCode) => {
        set({
            currentLanguage: code,
            t: getTranslation(code)
        });
        if (typeof window !== "undefined") {
            localStorage.setItem("language-storage", code);
        }
    },
    hydrate: () => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("language-storage");
            if (saved && ["zh-TW", "en", "vi", "th", "hi"].includes(saved)) {
                set({
                    currentLanguage: saved as LanguageCode,
                    t: getTranslation(saved as LanguageCode),
                    isHydrated: true
                });
            }
            else {
                set({ isHydrated: true });
            }
        }
    },
}));
