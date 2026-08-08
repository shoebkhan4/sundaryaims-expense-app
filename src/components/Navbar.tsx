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
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-cyan-900/40 shadow-xl shadow-cyan-950/20">
      
      {/* Top Yellow & Cyan AIMS Accent Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#00A3E0] via-cyan-400 to-[#FFC20E]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Official AIMS Logo & Company Title */}
        <div className="flex items-center space-x-3.5">
          {/* Actual AIMS Official Logo Image */}
          <div className="bg-white p-1.5 rounded-xl shadow-md border border-cyan-400/30 flex items-center justify-center shrink-0">
            <img
              src={AIMS_LOGO_BASE64}
              alt="HADAF AL AIMS TRADING CO. Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-white tracking-wide">HADAF AL AIMS TRADING CO.</h1>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-[#FFC20E] text-slate-950 shadow-sm">
                F2 FORM
              </span>
            </div>
            <p className="text-xs text-cyan-300/80 font-medium">Sundry Expense Manager & Outlook Dispatcher</p>
          </div>
        </div>

        {/* Center/Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">

          {/* Running Total Badge */}
          <div className="hidden md:flex flex-col text-right pr-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Grand Total</span>
            <span className="text-sm font-black text-emerald-400">SAR {grandTotal.toFixed(2)}</span>
          </div>

          {/* Start New Blank Report Button */}
          <button
            onClick={onStartNewReport}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold transition border border-amber-500/30 shadow-md"
            title="Clear items and start a new blank expense report"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#FFC20E]" />
            <span className="hidden sm:inline">New Blank Report</span>
          </button>

          {/* History Button (2026 Submissions) */}
          <button
            onClick={onOpenHistoryDrawer}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition border border-slate-700/60 shadow-md"
            title="Inspect past submitted expense reports"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Sent History</span>
          </button>

          {/* PDF Preview Button */}
          <button
            onClick={onOpenPdfPreview}
            disabled={totalExpensesCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold transition border border-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <FileText className="w-3.5 h-3.5 text-[#00A3E0]" />
            <span className="hidden sm:inline">Preview PDF</span>
          </button>

          {/* Send via Outlook Button */}
          <button
            onClick={onOpenOutlookModal}
            disabled={totalExpensesCount === 0}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A3E0] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Outlook</span>
          </button>

          {/* Add Expense Modal Trigger */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>

        </div>

      </div>
    </header>
  );
};
