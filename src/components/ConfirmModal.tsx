import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, CloudDownload, Info, X } from 'lucide-react';
import { useTheme } from '../theme';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  icon?: 'trash' | 'alert' | 'cloud' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  subMessage,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  icon = 'alert',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const { theme } = useTheme();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (icon === 'trash') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
          <Trash2 size={24} />
        </div>
      );
    }
    if (icon === 'cloud') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <CloudDownload size={24} />
        </div>
      );
    }
    if (icon === 'info') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
          <Info size={24} />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
        <AlertTriangle size={24} />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-md ${theme.bgCard} border ${theme.borderMain} rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative text-slate-800 dark:text-slate-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className={`absolute top-4 right-4 p-1.5 rounded-xl ${theme.bgCardElevated} ${theme.textMuted} hover:${theme.textTitle} hover:${theme.bgCardHover} transition`}
          title="Close dialog"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4">
          {renderIcon()}
          <div className="space-y-1 pr-6">
            <h3 className={`font-bold ${theme.textTitle} text-base font-display leading-tight`}>
              {title}
            </h3>
            <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
              {message}
            </p>
            {subMessage && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1">
                {subMessage}
              </p>
            )}
          </div>
        </div>

        <div className={`flex items-center justify-end gap-2.5 pt-3 border-t ${theme.borderMuted}`}>
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2.5 rounded-xl border ${theme.borderMain} ${theme.textMain} hover:${theme.bgCardHover} text-xs font-bold transition`}
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white'
                : `${theme.btnPrimary}`
            }`}
          >
            {isDestructive && <Trash2 size={13} />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
