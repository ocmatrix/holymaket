import { create } from 'zustand';
export type NotificationType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
interface UIState {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
    notification: {
        message: string;
        type: NotificationType;
        visible: boolean;
    } | null;
    showNotification: (message: string, type?: NotificationType) => void;
    hideNotification: () => void;
}
export const useUIStore = create<UIState>((set) => ({
    sidebarOpen: false,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    notification: null,
    showNotification: (message, type = 'INFO') => {
        set({ notification: { message, type, visible: true } });
    },
    hideNotification: () => set({ notification: null }),
}));
