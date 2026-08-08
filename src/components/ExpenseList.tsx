import React, { useState } from 'react';
import { ExpenseItem } from '../types/expense';
import { Edit2, Trash2, FileText, Image as ImageIcon, Calendar, Briefcase, Tag, DollarSign } from 'lucide-react';
import { SAMPLE_RECEIPT_BASE64 } from '../assets/images';

interface ExpenseListProps {
  expenses: ExpenseItem[];
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  onOpenAddModal: () => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  onEditExpense,
  onDeleteExpense,
  onOpenAddModal
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<{ title: string; imageSrc: string } | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">No Expense Items Added Yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
          Start logging your site expenses by clicking "+ Add Expense". Snap photos of receipts or upload PDF invoices for quick scanning.
        </p>
        <button
          onClick={onOpenAddModal}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition inline-flex items-center gap-2"
        >
          <span>+ Add Expense</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((item, index) => {
        const hasReceipt = Boolean(item.receiptImage || item.receiptFileName);
        const imageSrc = item.receiptImage || SAMPLE_RECEIPT_BASE64;
        const isPdf = item.receiptFileName?.toLowerCase().endsWith('.pdf');

        return (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
          >
            {/* Left: Thumbnail & Core Info */}
            <div className="flex items-center space-x-4 min-w-0">
              
              {/* Receipt Thumbnail */}
              <div
                onClick={() => {
                  if (hasReceipt && !isPdf) {
                    setSelectedReceipt({ title: item.description, imageSrc });
                  }
                }}
                className={`relative w-14 h-14 rounded-xl border border-slate-700/80 overflow-hidden shrink-0 flex items-center justify-center bg-slate-950 ${
                  hasReceipt && !isPdf ? 'cursor-pointer hover:border-cyan-500 hover:scale-105 transition' : ''
                }`}
                title={hasReceipt ? 'Click to view full bill receipt photo' : 'No bill photo uploaded'}
              >
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center text-rose-400">
                    <FileText className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-0.5">PDF</span>
                  </div>
                ) : hasReceipt ? (
                  <img
                    src={imageSrc}
                    alt={item.description}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-[9px] font-semibold mt-0.5">No Bill</span>
                  </div>
                )}
              </div>

              {/* Text Info */}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                  <h4 className="text-sm font-bold text-slate-100 truncate">{item.description}</h4>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{item.date}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>Job #{item.jobNo}</span>
                  </div>

                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
                    <Tag className="w-3 h-3" />
                    <span className="text-[11px] font-medium">{item.category}</span>
                  </div>
                </div>

                {/* Original USD Conversion Info Badge */}
                {item.originalCurrency === 'USD' && item.originalAmount && (
                  <div className="mt-1 inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <DollarSign className="w-3 h-3 text-amber-400" />
                    <span>Original: ${item.originalAmount.toFixed(2)} USD (@ {item.conversionRate || 3.75} SAR/USD)</span>
                  </div>
                )}
              </div>

            </div>

            {/* Right: Amount & Edit/Delete Actions */}
            <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
              
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Amount</span>
                <span className="text-base font-extrabold text-emerald-400">SAR {item.amount.toFixed(2)}</span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onEditExpense(item)}
                  className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                  title="Edit Expense Item"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteExpense(item.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Delete Expense Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        );
      })}

      {/* FULL RESOLUTION BILL PHOTO PREVIEW MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">{selectedReceipt.title} - Original Bill Photo</h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto py-3 flex items-center justify-center">
              <img
                src={selectedReceipt.imageSrc}
                alt="Receipt Full Resolution"
                className="max-h-[75vh] w-auto object-contain rounded-lg border border-slate-800 shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
