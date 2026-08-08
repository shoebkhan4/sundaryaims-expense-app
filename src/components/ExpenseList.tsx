import React, { useState } from 'react';
import { Trash2, Edit2, FileText, Image as ImageIcon, Calendar, Briefcase, Tag, Maximize2, X } from 'lucide-react';
import { ExpenseItem } from '../types/expense';

interface ExpenseListProps {
  expenses: ExpenseItem[];
  onEditExpense: (item: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  onOpenAddModal: () => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  onEditExpense,
  onDeleteExpense,
  onOpenAddModal
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center my-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">No Expense Items Added Yet</h3>
        <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
          Click the button below to add your first expense row, upload your receipt photo, and let OCR scan the amount.
        </p>
        <button
          onClick={onOpenAddModal}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition transform hover:scale-105 active:scale-95"
        >
          + Add First Expense
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Responsive List / Cards Grid */}
      <div className="grid grid-cols-1 gap-3">
        {expenses.map((item, idx) => (
          <div
            key={item.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
          >
            
            {/* Left: Thumbnail & Main Info */}
            <div className="flex items-center space-x-3.5 min-w-0 flex-1">
              
              {/* Receipt Image Thumbnail */}
              {item.receiptImage ? (
                <div
                  onClick={() => setSelectedImage(item.receiptImage || null)}
                  className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 shrink-0 cursor-pointer group/img"
                  title="Click to view full receipt image"
                >
                  <img
                    src={item.receiptImage}
                    alt={item.description}
                    className="w-full h-full object-cover group-hover/img:scale-110 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700/50 flex flex-col items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[9px] mt-0.5 font-medium">No Bill</span>
                </div>
              )}

              {/* Item Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                    #{idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100 truncate">
                    {item.description}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {item.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    Job #{item.jobNo}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Tag className="w-3 h-3 mr-1" />
                    {item.category}
                  </span>
                </div>
              </div>

            </div>

            {/* Right: Amount & Actions */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Amount</span>
                <span className="text-base font-bold text-emerald-400">
                  SAR {item.amount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onEditExpense(item)}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition"
                  title="Edit Expense"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteExpense(item.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  title="Delete Expense"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        ))}
      </div>

      {/* FULL-SCREEN RECEIPT IMAGE MODAL */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full Receipt"
              className="max-h-[85vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}

    </div>
  );
};
