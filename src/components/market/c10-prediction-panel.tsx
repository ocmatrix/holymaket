"use client";

interface C10PredictionPanelProps {
    market?: {
        id: string;
        title?: string | null;
        category?: string | null;
        status?: string | null;
    } | null;
}

export function C10PredictionPanel({ market }: C10PredictionPanelProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#111] p-5 space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">
                Index outlook
            </h3>
            <p className="text-xs text-white/45 leading-relaxed">
                {market?.id
                    ? "This block referenced a removed panel. Use the main trading panel and chart for C10 / Gold."
                    : "No active market for this category."}
            </p>
        </div>
    );
}
