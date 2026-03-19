'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmState {
  open: boolean;
  message: string;
  onConfirm: () => void;
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'error' | 'success';
}

interface AdminUIContextValue {
  confirm: (message: string, onConfirm: () => void) => void;
  toast: (message: string, type?: 'error' | 'success') => void;
}

const AdminUIContext = createContext<AdminUIContextValue | null>(null);

export function useAdminUI() {
  const ctx = useContext(AdminUIContext);
  if (!ctx) throw new Error('useAdminUI must be used within AdminUIProvider');
  return ctx;
}

export function AdminUIProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmState>({ open: false, message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ visible: false, message: '', type: 'error' });

  const confirm = useCallback((message: string, onConfirm: () => void) => {
    setDialog({ open: true, message, onConfirm });
  }, []);

  const toast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastState({ visible: true, message, type });
    setTimeout(() => setToastState(s => ({ ...s, visible: false })), 4000);
  }, []);

  return (
    <AdminUIContext.Provider value={{ confirm, toast }}>
      {children}

      {/* ConfirmDialog */}
      {dialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDialog(d => ({ ...d, open: false }))} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-gray-700 mt-2">{dialog.message}</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDialog(d => ({ ...d, open: false }))}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => { dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastState.visible && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 duration-200 max-w-sm ${
          toastState.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          <span className="flex-1">{toastState.message}</span>
          <button onClick={() => setToastState(s => ({ ...s, visible: false }))} className="opacity-70 hover:opacity-100 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </AdminUIContext.Provider>
  );
}
