import React, { useState, useEffect } from 'react';
import { X, History, FileText, Calendar, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { OutlookSubmission } from '../types/expense';
import { fetchSentExpenseEmails } from '../services/outlookService';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose }) => {
  const [submissions, setSubmissions] = useState<OutlookSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchSentExpenseEmails().then((res) => {
        setSubmissions(res);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden">
        
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Outlook Sent History (Last 2-3 Months)
            </h2>
            <p className="text-xs text-slate-400">Prefilled F2 Form submissions sent to company email</p>
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-xs text-slate-400">Querying Outlook Sent Items (Last 90 Days)...</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No recent expense emails found in Sent Items.
            </div>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition shadow space-y-2"
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-xs font-bold text-slate-200 leading-snug">{sub.subject}</h4>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {new Date(sub.sentDateTime).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sent to: {sub.recipients.join(', ')}</span>
                </div>

                {sub.pdfAttachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Submitted PDFs</span>
                    {sub.pdfAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-blue-400 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                        <span className="truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-2">{(att.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
