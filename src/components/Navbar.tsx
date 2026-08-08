import React from 'react';
import { Plus, Mail, FileText, History, RotateCcw } from 'lucide-react';
import { AIMS_LOGO_BASE64 } from '../assets/images';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenOutlookModal: () => void;
  onOpenHistoryDrawer: () => void;
  onOpenPdfPreview: () => void;
  onStartNewReport: () => void;
  totalExpensesCount: number;
  grandTotal: number;
  isOutlookConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenOutlookModal,
  onOpenHistoryDrawer,
  onOpenPdfPreview,
  onStartNewReport,
  totalExpensesCount,
  grandTotal
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-cyan-900/40 shadow-xl">
      
      {/* Top Yellow & Cyan AIMS Accent Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#00A3E0] via-cyan-400 to-[#FFC20E]" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5">
        
        {/* Main Row */}
        <div className="flex items-center justify-between gap-2">
          
          {/* Left: Official AIMS Logo & Company Title */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="bg-white p-1 rounded-lg shadow-md border border-cyan-400/30 flex items-center justify-center shrink-0">
              <img
                src={AIMS_LOGO_BASE64}
                alt="HADAF AL AIMS TRADING CO. Logo"
                className="h-7 sm:h-8 w-auto object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h1 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">HADAF AL AIMS</h1>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-[#FFC20E] text-slate-950 shrink-0">
                  F2 FORM
                </span>
              </div>
              <p className="text-[10px] text-cyan-300/80 font-medium truncate hidden sm:block">Sundry Expense Manager & Outlook Dispatcher</p>
            </div>
          </div>

          {/* Right Primary Action on Mobile */}
          <div className="flex items-center space-x-2 shrink-0">
            
            {/* Running Total Badge (Desktop) */}
            <div className="hidden lg:flex flex-col text-right pr-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Grand Total</span>
              <span className="text-sm font-black text-emerald-400">SAR {grandTotal.toFixed(2)}</span>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center space-x-2">
              <button
                onClick={onStartNewReport}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold transition border border-amber-500/30 shadow-md"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFC20E]" />
                <span>New Blank Report</span>
              </button>

              <button
                onClick={onOpenHistoryDrawer}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition border border-slate-700/60 shadow-md"
              >
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sent History</span>
              </button>

              <button
                onClick={onOpenPdfPreview}
                disabled={totalExpensesCount === 0}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold transition border border-cyan-500/40 disabled:opacity-50 shadow-md"
              >
                <FileText className="w-3.5 h-3.5 text-[#00A3E0]" />
                <span>Preview PDF</span>
              </button>

              <button
                onClick={onOpenOutlookModal}
                disabled={totalExpensesCount === 0}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A3E0] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send Outlook</span>
              </button>
            </div>

            {/* Primary Green "+ Add Expense" Button (Mobile & Desktop) */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center space-x-1.5 px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </button>

          </div>

        </div>

        {/* Mobile Horizontal Sub-Navbar Actions (iPhone optimized) */}
        <div className="flex sm:hidden items-center justify-between gap-1.5 pt-2 border-t border-slate-900/80 overflow-x-auto no-scrollbar">
          
          <button
            onClick={onStartNewReport}
            className="flex items-center justify-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-[11px] font-semibold border border-amber-500/30 shrink-0"
          >
            <RotateCcw className="w-3 h-3 text-[#FFC20E]" />
            <span>New Report</span>
          </button>

          <button
            onClick={onOpenHistoryDrawer}
            className="flex items-center justify-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 text-slate-200 text-[11px] font-semibold border border-slate-800 shrink-0"
          >
            <History className="w-3 h-3 text-cyan-400" />
            <span>History</span>
          </button>

          <button
            onClick={onOpenPdfPreview}
            disabled={totalExpensesCount === 0}
            className="flex items-center justify-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 text-cyan-300 text-[11px] font-semibold border border-cyan-500/40 disabled:opacity-40 shrink-0"
          >
            <FileText className="w-3 h-3 text-[#00A3E0]" />
            <span>PDF Preview</span>
          </button>

          <button
            onClick={onOpenOutlookModal}
            disabled={totalExpensesCount === 0}
            className="flex items-center justify-center space-x-1 px-3 py-1 rounded-lg bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white text-[11px] font-bold shadow-md disabled:opacity-40 shrink-0"
          >
            <Mail className="w-3 h-3" />
            <span>Send</span>
          </button>

        </div>

      </div>
    </header>
  );
};
