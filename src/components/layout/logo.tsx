"use client";
import React from "react";
export function SuperoctopLogo({ className = "h-10 w-10" }: {
    className?: string;
}) {
    return (<div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      
      <img src="/image.gif" alt="SuperOctop Logo" className="w-full h-full object-contain mix-blend-screen" style={{
            filter: 'brightness(1.1) contrast(1.1) drop-shadow(0 0 15px rgba(0,242,255,0.4))',
        }}/>
    </div>);
}
