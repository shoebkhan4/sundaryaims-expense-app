import React from 'react';
import { Plus, Mail, FileText, CheckCircle2, History, Sparkles } from 'lucide-react';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenOutlookModal: () => void;
  onOpenHistoryDrawer: () => void;
  onOpenPdfPreview: () => void;
  totalExpensesCount: number;
  grandTotal: number;
  isOutlookConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenOutlookModal,
  onOpenHistoryDrawer,
  onOpenPdfPreview,
  totalExpensesCount,
  grandTotal,
  isOutlookConnected
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Branding & Company Info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-lg border border-blue-400/30">
            AIMS
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-100 tracking-wide">HADAF AL AIMS TRADING CO.</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                F2 Form
              </span>
            </div>
            <p className="text-xs text-slate-400">Sundry Expense Manager & Outlook Dispatcher</p>
          </div>
        </div>

        {/* Center/Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">

          {/* Running Total Badge */}
          <div className="hidden md:flex flex-col text-right pr-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Grand Total</span>
            <span className="text-sm font-bold text-emerald-400">SAR {grandTotal.toFixed(2)}</span>
          </div>

          {/* History Button (Last 2-3 months) */}
          <button
            onClick={onOpenHistoryDrawer}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700/60"
            title="Inspect past 2-3 months submitted expense emails"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Sent History (2-3 mo)</span>
          </button>

          {/* PDF Preview Button */}
          <button
            onClick={onOpenPdfPreview}
            disabled={totalExpensesCount === 0}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Preview PDF</span>
          </button>

          {/* Send via Outlook Button */}
          <button
            onClick={onOpenOutlookModal}
            disabled={totalExpensesCount === 0}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            <span>Send Outlook</span>
          </button>

          {/* Add Expense Modal Trigger */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>

        </div>

      </div>
    </header>
  );
};
