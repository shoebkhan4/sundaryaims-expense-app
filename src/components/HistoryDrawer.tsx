import React from 'react';
import { X, History, FileText, FolderOpen, Trash2, Paperclip } from 'lucide-react';
import { PAST_2026_REPORTS } from '../services/outlookService';
import { ArchivedReport, loadArchivedReport } from '../services/reportArchive';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPastReport: (header: CompanyHeaderInfo, items: ExpenseItem[]) => void;
  /** Reports filed from this app, newest first. */
  archived: ArchivedReport[];
  onDeleteArchived: (id: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onLoadPastReport,
  archived,
  onDeleteArchived
}) => {
  if (!isOpen) return null;

  const openArchived = async (report: ArchivedReport) => {
    // The bills live in IndexedDB, so they are fetched before the report opens.
    const items = await loadArchivedReport(report);
    onLoadPastReport(report.headerInfo, items);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Submitted Expense Reports
            </h2>
            <p className="text-xs text-slate-400">Reports you saved here, and the F2 records for 2026</p>
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

          {/* Reports filed from this app, with their bills */}
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>
              {archived.length === 0
                ? 'No reports saved yet'
                : `${archived.length} saved report${archived.length === 1 ? '' : 's'}`}
            </span>
            <span className="font-semibold text-emerald-400">Saved On This Device</span>
          </div>

          {archived.length === 0 && (
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-850 border border-slate-800 rounded-xl p-4">
              When you start a new report, you can save the current one here. Saved reports keep their rows
              and bill images, and can be reopened at any time.
            </p>
          )}

          {archived.map((report) => (
            <div
              key={report.id}
              className="bg-slate-850 border border-emerald-800/40 hover:border-emerald-500/50 rounded-xl p-4 transition shadow-lg space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                    Saved {report.savedAt}
                  </span>
                  <h4 className="text-sm font-bold text-slate-100 truncate">{report.title}</h4>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-[10px] uppercase text-slate-500 block font-semibold">Total SAR</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    SAR {report.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 space-y-1.5 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                  {report.items.length} item{report.items.length === 1 ? '' : 's'}
                  <span className="text-slate-600">•</span>
                  <Paperclip className="w-3 h-3" />
                  {report.imageItemIds.length} bill{report.imageItemIds.length === 1 ? '' : 's'}
                </span>

                {report.items.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-0">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-200">{item.description}</span>
                      <span className="text-[10px] text-slate-400 block">Job #{item.jobNo} &bull; {item.category}</span>
                    </div>
                    <span className="font-bold text-slate-200 shrink-0">SAR {item.amount.toFixed(2)}</span>
                  </div>
                ))}
                {report.items.length > 4 && (
                  <span className="text-[10px] text-slate-500 block pt-1">
                    and {report.items.length - 4} more
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onDeleteArchived(report.id)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-300 font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => void openArchived(report)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Report</span>
                </button>
              </div>
            </div>
          ))}

          {/* The 2026 submissions taken from the mail thread, for reference */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-4 pb-2 border-b border-slate-800">
            <span>Earlier submissions, from the email thread</span>
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
