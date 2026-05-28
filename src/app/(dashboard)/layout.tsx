"use client";
import { ReactNode } from "react";
import { Sidebar } from "../../components/layout/sidebar";
import { Notification } from "../../components/layout/notification";
export default function DashboardLayout({ children }: {
    children: ReactNode;
}) {
    return (<div className="flex min-h-screen bg-transparent">
      <Notification />
      
      <Sidebar />
      
      
      <main className="flex-1 transition-all duration-300 ml-0 lg:ml-72 min-w-0 relative overflow-x-hidden">
        {children}
      </main>
    </div>);
}
