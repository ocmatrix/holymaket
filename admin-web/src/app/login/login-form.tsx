"use client";
import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function LoginFormInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/";
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/super-admin-api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "Login failed");
                setLoading(false);
                return;
            }
            router.push(redirectTo);
            router.refresh();
        }
        catch (err: any) {
            setError(err.message || "Network error");
            setLoading(false);
        }
    };
    return (<form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      {error && (<div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
          {error}
        </div>)}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Username
          </label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all" placeholder="Enter username"/>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Password
          </label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all" placeholder="Enter password"/>
        </div>
      </div>

      <button type="submit" disabled={loading || !username || !password} className="w-full mt-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        {loading ? "Authenticating..." : "Sign In"}
      </button>

      <p className="text-center text-[10px] text-white/20 mt-6">
        Protected by Prophot Security
      </p>
    </form>);
}
export default function LoginForm() {
    return (<Suspense fallback={<div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center text-white/40">
        Loading...
      </div>}>
      <LoginFormInner />
    </Suspense>);
}
