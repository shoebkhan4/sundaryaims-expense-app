import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Sparkles, AlertCircle, Check, RefreshCw, FileText, DollarSign, Calculator, RotateCw, Contrast, Crop, Sliders } from 'lucide-react';
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

/**
 * Enhanced Mobile Document Scanner Canvas Filter:
 * Converts shadowy mobile photo into a crisp, high-contrast scanned document
 */
function applyDocumentScanFilter(dataUrl: string, applyScanFilter = true, rotationDeg = 0): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
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
      const isRotated90 = (rotationDeg / 90) % 2 !== 0;
      canvas.width = isRotated90 ? h : w;
      canvas.height = isRotated90 ? w : h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      if (applyScanFilter) {
        // Document Contrast & Sharpness Enhancement
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];

          // Grayscale luminance
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // High-contrast Document B&W filter thresholding
          if (gray > 165) {
            gray = 255; // Clean paper background
          } else if (gray < 90) {
            gray = 0;   // Crisp dark text
          } else {
            gray = (gray - 90) * (255 / (165 - 90)); // Midtone curve
          }

          d[i] = gray;
          d[i + 1] = gray;
          d[i + 2] = gray;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.8));
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
  
  // Currency mode (SAR by default - no USD conversion shown unless USD is selected)
  const [originalCurrency, setOriginalCurrency] = useState<'SAR' | 'USD'>(initialValues?.originalCurrency || 'SAR');
  const [usdAmount, setUsdAmount] = useState<string>(initialValues?.originalAmount ? String(initialValues.originalAmount) : '');
  const [conversionRate, setConversionRate] = useState<string>(initialValues?.conversionRate ? String(initialValues.conversionRate) : '3.75');
  const [sarAmount, setSarAmount] = useState<string>(initialValues?.amount ? String(initialValues.amount) : '');

  // Document Scanner image states
  const [rawUploadedImage, setRawUploadedImage] = useState<string | undefined>(initialValues?.receiptImage);
  const [receiptImage, setReceiptImage] = useState<string | undefined>(initialValues?.receiptImage);
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>(initialValues?.receiptFileName);
  const [isPdfFile, setIsPdfFile] = useState<boolean>(initialValues?.receiptFileName?.endsWith('.pdf') || false);

  // Scanner controls
  const [isScanFilterActive, setIsScanFilterActive] = useState<boolean>(true);
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState<number | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto calculate SAR amount ONLY when in USD mode
  useEffect(() => {
    if (originalCurrency === 'USD') {
      const uAmt = parseFloat(usdAmount);
      const cRate = parseFloat(conversionRate);
      if (!isNaN(uAmt) && !isNaN(cRate) && uAmt > 0 && cRate > 0) {
        setSarAmount((uAmt * cRate).toFixed(2));
      }
    }
  }, [usdAmount, conversionRate, originalCurrency]);

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
      const amtMatch = fname.match(/(?:SAR|USD|\$|Amount|_)\s*(\d+(?:\.\d+)?)/i);
      if (amtMatch && amtMatch[1]) {
        const pAmt = parseFloat(amtMatch[1]);
        if (fname.includes('$') || fname.toLowerCase().includes('usd')) {
          setOriginalCurrency('USD');
          setUsdAmount(String(pAmt));
          setSarAmount((pAmt * 3.75).toFixed(2));
        } else {
          setOriginalCurrency('SAR');
          setOcrDetectedAmount(pAmt);
          setSarAmount(String(pAmt));
        }
      }
      setIsScanning(false);
    } else {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawDataUrl = event.target?.result as string;
        setRawUploadedImage(rawDataUrl);

        // Apply Document Scanner Filter (High Contrast B&W Document Filter)
        const scannedDataUrl = await applyDocumentScanFilter(rawDataUrl, true, 0);
        setReceiptImage(scannedDataUrl);

        // Run OCR with Arabic & English support
        setIsScanning(true);
        const ocrResult = await scanReceiptImage(scannedDataUrl);
        setIsScanning(false);

        if (ocrResult.rawText) setRawOcrText(ocrResult.rawText);

        // Auto currency hint detection (Defaults to SAR unless USD is explicitly detected)
        if (ocrResult.currencyHint === 'USD') {
          setOriginalCurrency('USD');
          if (ocrResult.amount !== undefined) {
            setUsdAmount(String(ocrResult.amount));
            setSarAmount((ocrResult.amount * 3.75).toFixed(2));
          }
        } else {
          setOriginalCurrency('SAR'); // SAR by default
          if (ocrResult.amount !== undefined) {
            setOcrDetectedAmount(ocrResult.amount);
            setSarAmount(String(ocrResult.amount));
          }
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

  // Re-apply rotation or scanner filter on uploaded image
  const handleToggleScanFilter = async (filterOn: boolean, rot: number) => {
    if (!rawUploadedImage) return;
    setIsScanFilterActive(filterOn);
    setRotationDeg(rot);
    const updated = await applyDocumentScanFilter(rawUploadedImage, filterOn, rot);
    setReceiptImage(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !sarAmount) return;

    const finalSarAmount = parseFloat(sarAmount);
    if (isNaN(finalSarAmount) || finalSarAmount <= 0) return;

    const pUsdAmount = parseFloat(usdAmount);
    const pConvRate = parseFloat(conversionRate);

    onSaveExpense({
      date,
      description,
      jobNo,
      category,
      amount: finalSarAmount,
      originalCurrency,
      originalAmount: originalCurrency === 'USD' ? (isNaN(pUsdAmount) ? undefined : pUsdAmount) : undefined,
      conversionRate: originalCurrency === 'USD' ? (isNaN(pConvRate) ? 3.75 : pConvRate) : undefined,
      receiptImage,
      receiptFileName,
      rawOcrText
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto transform transition-all">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              {initialValues ? 'Edit Expense Item' : 'Add New Expense Item'}
            </h2>
            <p className="text-xs text-slate-400">Scan bill photo (Arabic/English) or PDF receipt</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* DOCUMENT SCANNER UPLOAD ZONE */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Bill / Receipt Document Scanner
              </label>

              {/* Document Scan Filter & Rotation Controls */}
              {receiptImage && !isPdfFile && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleToggleScanFilter(!isScanFilterActive, rotationDeg)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 transition ${
                      isScanFilterActive
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Toggle B&W Document Scanner Contrast Filter"
                  >
                    <Contrast className="w-3 h-3" />
                    <span>Scan Filter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleScanFilter(isScanFilterActive, (rotationDeg + 90) % 360)}
                    className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition"
                    title="Rotate Photo 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

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
                className="border-2 border-dashed border-slate-700 hover:border-[#00A3E0] rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-[#00A3E0]/10 group-hover:bg-[#00A3E0]/20 text-[#00A3E0] flex items-center justify-center mb-2 transition">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-200">Scan Bill Photo or Upload PDF Receipt</span>
                <span className="text-[11px] text-slate-400 mt-1">Auto-detects Arabic (المجموع/ر.س) & English totals</span>
              </div>
            ) : (
              <div className="relative rounded-xl border border-slate-700 bg-slate-850 overflow-hidden p-3 flex items-center space-x-3">
                {isPdfFile ? (
                  <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-rose-400 shrink-0">
                    <FileText className="w-5 h-5" />
                    <span className="text-[8px] font-bold mt-0.5">PDF</span>
                  </div>
                ) : receiptImage ? (
                  <img
                    src={receiptImage}
                    alt="Receipt Scanned Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{receiptFileName || 'Scanned Document'}</span>
                    {isScanning && (
                      <span className="inline-flex items-center text-[10px] text-cyan-400 animate-pulse font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin mr-1" /> Scanning...
                      </span>
                    )}
                  </div>

                  {ocrDetectedAmount !== null && !isScanning && (
                    <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Detected Amount: SAR {ocrDetectedAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 text-xs text-cyan-400 hover:underline inline-block font-medium"
                  >
                    Replace Photo / Document
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRawUploadedImage(undefined);
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date of Expense <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>

            {/* Job No. */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Job No. / Project <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 12918 or 14983"
                value={jobNo}
                onChange={(e) => setJobNo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Site Food, Site Fuel, Project Material, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          {/* Expense Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Expense Category Column <span className="text-rose-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* CLEAN AMOUNT INPUT (SAR by default - No USD conversion clutter unless USD is selected) */}
          {originalCurrency === 'SAR' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-200">
                  Amount in SAR (Saudi Riyals) <span className="text-rose-400">*</span>
                </label>
                
                {/* Toggle to switch to USD ONLY if needed */}
                <button
                  type="button"
                  onClick={() => setOriginalCurrency('USD')}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Is this bill in USD ($)?</span>
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-black text-sm">SAR</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={sarAmount}
                  onChange={(e) => setSarAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-14 pr-3 py-2.5 text-base font-black text-emerald-400 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          ) : (
            /* USD CONVERSION BOX - Displayed ONLY when USD currency is selected */
            <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  USD ($) Bill Currency Conversion
                </label>

                <button
                  type="button"
                  onClick={() => setOriginalCurrency('SAR')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Switch back to SAR
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* USD Bill Amount */}
                <div>
                  <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                    USD Bill Amount ($) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-amber-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="53.33"
                      value={usdAmount}
                      onChange={(e) => setUsdAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg pl-8 pr-3 py-1.5 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Conversion Rate */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Conversion Rate (SAR/USD)
                  </label>
                  <div className="relative">
                    <Calculator className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      step="0.0001"
                      required
                      placeholder="3.75"
                      value={conversionRate}
                      onChange={(e) => setConversionRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Calculated SAR Equivalent */}
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-emerald-500/30">
                <span className="text-xs text-slate-300 font-medium">Calculated Equivalent in SAR:</span>
                <span className="text-sm font-black text-emerald-400">
                  SAR {sarAmount || '0.00'}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
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
