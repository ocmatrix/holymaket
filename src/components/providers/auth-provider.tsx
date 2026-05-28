"use client";
import { useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
export function AuthProvider({ children }: {
    children: React.ReactNode;
}) {
    const { status, user } = useAuth();
    useEffect(() => {
    }, [status, user]);
    return <>{children}</>;
}
