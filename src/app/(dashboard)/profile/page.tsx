"use client";
import dynamic from "next/dynamic";
const ProfilePageContent = dynamic(() => import("./profile-content"), {
    ssr: false,
    loading: () => (<div className="relative min-h-screen bg-transparent text-white overflow-hidden" suppressHydrationWarning>
      <div className="relative max-w-6xl mx-auto px-4 py-8 lg:py-12" suppressHydrationWarning>
        <div className="flex flex-col items-center justify-center py-32 gap-6" suppressHydrationWarning>
          <div className="w-16 h-16 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin"/>
        </div>
      </div>
    </div>),
});
export default function ProfilePage() {
    return <ProfilePageContent />;
}
