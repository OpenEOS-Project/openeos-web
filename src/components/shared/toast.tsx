'use client';

import { create } from 'zustand';

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastItem['kind'], message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative toast API for mutation callbacks: toast.success(t('devices.detail.saved')) */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
};

/** Mounted once in AppShell — renders the active toasts bottom-right. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role="status" onClick={() => dismiss(t.id)}>
          <span className="toast__dot" />
          {t.message}
        </div>
      ))}
    </div>
  );
}
