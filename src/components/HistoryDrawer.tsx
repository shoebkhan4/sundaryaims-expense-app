import React from 'react';
import { X, History, FileText, Calendar, Check, ArrowRight, FolderOpen, Tag } from 'lucide-react';
import { PAST_2026_REPORTS, PastReportRecord } from '../services/outlookService';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPastReport: (header: CompanyHeaderInfo, items: ExpenseItem[]) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onLoadPastReport
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Submitted Expense Reports (2026)
            </h2>
            <p className="text-xs text-slate-400">View and inspect your submitted F2 reports for this year</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Showing 4 submitted reports for 2026</span>
            <span className="font-semibold text-blue-400">Company F2 Records</span>
          </div>

          {PAST_2026_REPORTS.map((report) => (
            <div
              key={report.id}
              className="bg-slate-850 border border-slate-800 hover:border-blue-500/50 rounded-xl p-4 transition shadow-lg space-y-3 group"
            >
              
              {/* Report Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                    {report.dateSubmitted}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100">{report.periodTitle}</h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">Total SAR</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    SAR {report.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items List Breakdown */}
              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 space-y-1.5 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Report Line Items ({report.items.length})
                </span>

                {report.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-0">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-200">{item.description}</span>
                      <span className="text-[10px] text-slate-400 block">Job #{item.jobNo} &bull; {item.category}</span>
                    </div>
                    <span className="font-bold text-slate-200 shrink-0">SAR {item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* PDF Filename & Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px] truncate max-w-[240px]">
                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{report.pdfFileName}</span>
                </div>

                <button
                  onClick={() => {
                    onLoadPastReport(report.headerInfo, report.items);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Load Report</span>
                </button>
              </div>

            </div>
          ))}

        </div>

      </div>
    </div>
  );
};
