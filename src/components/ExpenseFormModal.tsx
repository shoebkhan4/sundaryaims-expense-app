import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Sparkles, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { ExpenseCategory, ExpenseItem } from '../types/expense';
import { scanReceiptImage } from '../services/ocrService';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  initialValues?: ExpenseItem | null;
}

const CATEGORIES: ExpenseCategory[] = [
  'Electricity water fuel',
  'Site Office small repair',
  'Spot rental equpt',
  'Site Tools equpt',
  'Sundry Consumable',
  'Other'
];

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  initialValues
}) => {
  const [date, setDate] = useState(initialValues?.date || new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(initialValues?.description || '');
  const [jobNo, setJobNo] = useState(initialValues?.jobNo || '12918');
  const [category, setCategory] = useState<ExpenseCategory>(initialValues?.category || 'Electricity water fuel');
  const [amount, setAmount] = useState<string>(initialValues?.amount ? String(initialValues.amount) : '');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(initialValues?.receiptImage);
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>(initialValues?.receiptFileName);
  
  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState<number | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFileName(file.name);
    
    // Read file as Base64 data URL
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setReceiptImage(dataUrl);

      // Trigger OCR scanner
      setIsScanning(true);
      const ocrResult = await scanReceiptImage(dataUrl);
      setIsScanning(false);

      if (ocrResult.rawText) setRawOcrText(ocrResult.rawText);
      if (ocrResult.confidence) setOcrConfidence(ocrResult.confidence);

      if (ocrResult.amount !== undefined) {
        setOcrDetectedAmount(ocrResult.amount);
        setAmount(String(ocrResult.amount));
      }

      if (ocrResult.date) {
        setDate(ocrResult.date);
      }

      if (ocrResult.vendor && !description) {
        setDescription(ocrResult.vendor);
      }

      if (ocrResult.category) {
        setCategory(ocrResult.category);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    onSaveExpense({
      date,
      description,
      jobNo,
      category,
      amount: parsedAmount,
      receiptImage,
      receiptFileName,
      rawOcrText
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 transform transition-all">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              {initialValues ? 'Edit Expense Item' : 'Add New Expense Item'}
            </h2>
            <p className="text-xs text-slate-400">Fill in details or upload receipt photo for auto-scanning</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* RECEIPT IMAGE UPLOAD & OCR SCANNER ZONE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Bill / Receipt Image (Camera Upload)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {!receiptImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2 transition">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-200">Take Photo or Upload Receipt</span>
                <span className="text-xs text-slate-400 mt-1">OCR auto-extracts amount & suggested category</span>
              </div>
            ) : (
              <div className="relative rounded-xl border border-slate-700 bg-slate-850 overflow-hidden p-3 flex items-center space-x-3">
                <img
                  src={receiptImage}
                  alt="Receipt Preview"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{receiptFileName || 'Receipt Image'}</span>
                    {isScanning && (
                      <span className="inline-flex items-center text-[10px] text-blue-400 animate-pulse font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin mr-1" /> Scanning...
                      </span>
                    )}
                  </div>

                  {ocrDetectedAmount !== null && !isScanning && (
                    <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>OCR Detected Amount: SAR {ocrDetectedAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 text-xs text-blue-400 hover:underline inline-block"
                  >
                    Replace Image
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReceiptImage(undefined);
                    setReceiptFileName(undefined);
                    setOcrDetectedAmount(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* BASIC INFO FIELDS */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date of Expense */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Date of Expense <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Job No. */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Job No. / Project <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 12918 or 14983"
                value={jobNo}
                onChange={(e) => setJobNo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Site Fuel - FGP (6 Visit) or AI Subscription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Expense Category */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Expense Category Column <span className="text-rose-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Amount (SAR) + OCR Manual Correction */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Amount (SAR) <span className="text-rose-400">*</span>
              </label>
              {ocrDetectedAmount !== null && (
                <span className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Correct value below if OCR misread
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">SAR</span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-14 pr-3 py-2 text-base font-bold text-emerald-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Expense</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
