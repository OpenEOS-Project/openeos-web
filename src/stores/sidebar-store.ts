import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isFullscreen: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  isFullscreen: false,
  isMobileOpen: false,
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen, isCollapsed: fullscreen }),
  setMobileOpen: (open) => set({ isMobileOpen: open }),
  toggleMobileOpen: () => set((state) => ({ isMobileOpen: !state.isMobileOpen })),
}));
