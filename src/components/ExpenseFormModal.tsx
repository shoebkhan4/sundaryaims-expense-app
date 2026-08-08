import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Sparkles, AlertCircle, Check, RefreshCw, FileText } from 'lucide-react';
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
  'Site Food',
  'Project Material',
  'Online Parts Purchased (Project)',
  'Site Office small repair',
  'Spot rental equpt',
  'Site Tools equpt',
  'Sundry Consumable',
  'Other'
];

function compressImage(dataUrl: string, maxDim = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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
  const [isPdfFile, setIsPdfFile] = useState<boolean>(initialValues?.receiptFileName?.endsWith('.pdf') || false);

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState<number | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFileName(file.name);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdfFile(isPdf);

    if (isPdf) {
      setIsScanning(true);
      const fname = file.name;
      const amtMatch = fname.match(/(?:SAR|Amount|_)\s*(\d+(?:\.\d+)?)/i);
      if (amtMatch && amtMatch[1]) {
        const pAmt = parseFloat(amtMatch[1]);
        setOcrDetectedAmount(pAmt);
        setAmount(String(pAmt));
      }
      setIsScanning(false);
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawDataUrl = event.target?.result as string;
        const compressedDataUrl = await compressImage(rawDataUrl, 900);
        setReceiptImage(compressedDataUrl);

        setIsScanning(true);
        const ocrResult = await scanReceiptImage(compressedDataUrl);
        setIsScanning(false);

        if (ocrResult.rawText) setRawOcrText(ocrResult.rawText);

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
    }
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
            <p className="text-xs text-slate-400">Upload receipt image or PDF bill for auto-scanning</p>
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

          {/* RECEIPT FILE UPLOAD & OCR SCANNER ZONE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Bill / Receipt Attachment (Image or PDF)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!receiptImage && !receiptFileName ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2 transition">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-slate-200">Take Photo, Upload Image or PDF Bill</span>
                <span className="text-xs text-slate-400 mt-1">Supports JPG, PNG, WEBP & PDF invoices</span>
              </div>
            ) : (
              <div className="relative rounded-xl border border-slate-700 bg-slate-850 overflow-hidden p-3 flex items-center space-x-3">
                {isPdfFile ? (
                  <div className="w-14 h-14 rounded-lg bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-rose-400 shrink-0">
                    <FileText className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-0.5">PDF</span>
                  </div>
                ) : receiptImage ? (
                  <img
                    src={receiptImage}
                    alt="Receipt Preview"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{receiptFileName || 'Bill Attachment'}</span>
                    {isScanning && (
                      <span className="inline-flex items-center text-[10px] text-cyan-400 animate-pulse font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin mr-1" /> Scanning...
                      </span>
                    )}
                  </div>

                  {ocrDetectedAmount !== null && !isScanning && (
                    <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extracted Amount: SAR {ocrDetectedAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 text-xs text-cyan-400 hover:underline inline-block"
                  >
                    Replace File
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReceiptImage(undefined);
                    setReceiptFileName(undefined);
                    setIsPdfFile(false);
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
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
              placeholder="e.g. Site Food, Project Material, Site Fuel, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
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
                  Verify value below
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-14 pr-3 py-2 text-base font-bold text-emerald-400 focus:outline-none focus:border-cyan-500"
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
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-600/30 transition flex items-center gap-2"
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
