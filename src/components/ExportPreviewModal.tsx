import React, { useState } from 'react';
import { Download, Share2, Copy, Check, X, FileText, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../theme';
import { exportFile, copyToClipboard } from '../exportUtils';

export interface ExportPreviewModalProps {
  isOpen: boolean;
  title: string;
  fileName: string;
  content: string;
  mimeType?: string;
  itemCount?: number;
  onClose: () => void;
}

export default function ExportPreviewModal({
  isOpen,
  title,
  fileName,
  content,
  mimeType = 'application/json;charset=utf-8;',
  itemCount,
  onClose
}: ExportPreviewModalProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const sizeKb = (new Blob([content]).size / 1024).toFixed(1);

  const handleTriggerExport = async () => {
    const res = await exportFile({
      fileName,
      content,
      mimeType,
      title
    });
    setExportNotice(res.message);
    setTimeout(() => setExportNotice(null), 5000);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setExportNotice(`✓ Copied ${fileName} content (${sizeKb} KB) to clipboard!`);
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-xl ${theme.bgCard} border ${theme.borderMain} rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${theme.borderMuted}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${theme.bgAccent} ${theme.textAccent} border ${theme.borderAccent}`}>
              <FileText size={22} />
            </div>
            <div>
              <h3 className={`font-bold ${theme.textTitle} text-base font-display`}>
                {title}
              </h3>
              <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                {fileName} • {sizeKb} KB {itemCount !== undefined ? `(${itemCount} items)` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl ${theme.bgCardElevated} ${theme.textMuted} hover:${theme.textTitle} hover:${theme.bgCardHover} transition`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Banner if any */}
        {exportNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Preview Content Area */}
        <div className="flex-1 min-h-[160px] max-h-[300px] flex flex-col space-y-1.5">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
            <span>File Content Preview</span>
            <span>UTF-8 Plain Text</span>
          </div>
          <div className={`flex-1 p-3.5 rounded-2xl ${theme.bgInput} border ${theme.borderMuted} font-mono text-[11px] leading-relaxed overflow-auto select-all text-slate-700 dark:text-slate-300 whitespace-pre`}>
            {content.slice(0, 10000)}
            {content.length > 10000 && '\n... [Remaining content truncated in preview]'}
          </div>
        </div>

        {/* Actions Row */}
        <div className={`flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t ${theme.borderMuted}`}>
          <button
            type="button"
            onClick={handleCopy}
            className={`py-2.5 px-4 rounded-xl border ${theme.borderMain} ${theme.bgCardElevated} hover:${theme.bgCardHover} text-xs font-bold transition flex items-center gap-2 ${theme.textMain}`}
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerExport}
              className={`py-2.5 px-5 rounded-xl ${theme.btnPrimary} text-xs font-bold transition shadow-sm flex items-center gap-2`}
            >
              <Download size={14} />
              Save / Share File
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
