import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Check, RefreshCw, FileText, DollarSign, Calculator, Crop, ScanLine, Image as ImageIcon } from 'lucide-react';
import { ExpenseCategory, ExpenseItem } from '../types/expense';
import { scanReceiptImage } from '../services/ocrService';
import { autoScanImage, EnhanceMode, Quad } from '../services/documentScanner';
import { CameraScannerModal } from './CameraScannerModal';
import { DocumentCropEditor } from './DocumentCropEditor';

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
  
  // Currency mode (SAR by default)
  const [originalCurrency, setOriginalCurrency] = useState<'SAR' | 'USD'>(initialValues?.originalCurrency || 'SAR');
  const [usdAmount, setUsdAmount] = useState<string>(initialValues?.originalAmount ? String(initialValues.originalAmount) : '');
  const [conversionRate, setConversionRate] = useState<string>(initialValues?.conversionRate ? String(initialValues.conversionRate) : '3.75');
  const [sarAmount, setSarAmount] = useState<string>(initialValues?.amount ? String(initialValues.amount) : '');

  // Document Scanner image states
  const [rawUploadedImage, setRawUploadedImage] = useState<string | undefined>(initialValues?.receiptImage);
  const [receiptImage, setReceiptImage] = useState<string | undefined>(initialValues?.receiptImage);
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>(initialValues?.receiptFileName);
  const [isPdfFile, setIsPdfFile] = useState<boolean>(initialValues?.receiptFileName?.endsWith('.pdf') || false);

  // Scanner geometry / look, kept so the crop can be re-opened and re-applied
  const [scanQuad, setScanQuad] = useState<Quad | null>(null);
  const [scanMode, setScanMode] = useState<EnhanceMode>('color');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [edgesDetected, setEdgesDetected] = useState(false);

  // Scanner surfaces
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState<number | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  /** Other totals found on the bill, offered as one-tap corrections. */
  const [amountOptions, setAmountOptions] = useState<number[]>([]);
  const [showOcrText, setShowOcrText] = useState(false);

  // Fallback camera input (used when getUserMedia is unavailable) + gallery picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /**
   * Load the row being edited every time the dialog opens.
   *
   * useState initialisers only run on the component's first mount, and this
   * dialog stays mounted between openings (it renders null while closed). So
   * without this the fields kept whatever was last typed and every "edit"
   * showed the previously entered expense instead of the chosen row.
   */
  useEffect(() => {
    if (!isOpen) return;

    setDate(initialValues?.date || new Date().toISOString().split('T')[0]);
    setDescription(initialValues?.description || '');
    setJobNo(initialValues?.jobNo || '12918');
    setCategory(initialValues?.category || 'Electricity water fuel');

    setOriginalCurrency(initialValues?.originalCurrency || 'SAR');
    setUsdAmount(initialValues?.originalAmount ? String(initialValues.originalAmount) : '');
    setConversionRate(initialValues?.conversionRate ? String(initialValues.conversionRate) : '3.75');
    setSarAmount(initialValues?.amount ? String(initialValues.amount) : '');

    setRawUploadedImage(initialValues?.receiptImage);
    setReceiptImage(initialValues?.receiptImage);
    setReceiptFileName(initialValues?.receiptFileName);
    setIsPdfFile(initialValues?.receiptFileName?.toLowerCase().endsWith('.pdf') || false);

    setScanQuad(null);
    setScanMode('color');
    setRotationDeg(0);
    setEdgesDetected(false);

    setIsCameraOpen(false);
    setCropSource(null);
    setIsScanning(false);
    setIsProcessingImage(false);
    setOcrDetectedAmount(null);
    setRawOcrText(initialValues?.rawOcrText || '');
    setAmountOptions([]);
    setShowOcrText(false);
    // Keyed on the row's identity so switching rows reloads the fields.
  }, [isOpen, initialValues?.id]);

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

  /** Reads OCR fields off an already scanned (deskewed + enhanced) image. */
  const runOcr = async (ocrImage: string) => {
    setIsScanning(true);
    try {
      const ocrResult = await scanReceiptImage(ocrImage);

      if (ocrResult.rawText) setRawOcrText(ocrResult.rawText);
      setAmountOptions(ocrResult.amountOptions ?? []);

      if (ocrResult.currencyHint === 'USD') {
        setOriginalCurrency('USD');
        if (ocrResult.amount !== undefined) {
          setUsdAmount(String(ocrResult.amount));
          setSarAmount((ocrResult.amount * 3.75).toFixed(2));
        }
      } else {
        setOriginalCurrency('SAR'); // Default SAR
        if (ocrResult.amount !== undefined) {
          setOcrDetectedAmount(ocrResult.amount);
          setSarAmount(String(ocrResult.amount));
        }
      }

      if (ocrResult.date) setDate(ocrResult.date);
      if (ocrResult.vendor && !description) setDescription(ocrResult.vendor);
      if (ocrResult.category) setCategory(ocrResult.category);
    } finally {
      setIsScanning(false);
    }
  };

  /** Camera frame confirmed in the crop editor, or a re-crop of an existing scan. */
  const handleCropConfirmed = async (result: {
    dataUrl: string;
    ocrDataUrl: string;
    quad: Quad;
    mode: EnhanceMode;
    rotation: number;
  }) => {
    setRawUploadedImage(cropSource ?? rawUploadedImage);
    setReceiptImage(result.dataUrl);
    setScanQuad(result.quad);
    setScanMode(result.mode);
    setRotationDeg(result.rotation);
    setEdgesDetected(true);
    setIsPdfFile(false);
    if (!receiptFileName) {
      setReceiptFileName(`scan-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.jpg`);
    }
    setCropSource(null);
    await runOcr(result.ocrDataUrl);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-picking the same file (change does not fire otherwise).
    e.target.value = '';
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
        setRotationDeg(0);
        setIsProcessingImage(true);

        try {
          // Detect the page boundary, perspective-correct it, then enhance.
          const scan = await autoScanImage(rawDataUrl, { mode: scanMode });
          setReceiptImage(scan.dataUrl);
          setScanQuad(scan.quad);
          setEdgesDetected(scan.detected);
          setIsProcessingImage(false);

          // Run OCR with Arabic (ر.س / المجموع / ٠-٩) & English support
          await runOcr(scan.ocrDataUrl);
        } catch {
          // Keep the original photo usable even if processing failed.
          setReceiptImage(rawDataUrl);
          setScanQuad(null);
          setEdgesDetected(false);
          setIsProcessingImage(false);
          await runOcr(rawDataUrl);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const openCropEditor = () => {
    if (!rawUploadedImage) return;
    setCropSource(rawUploadedImage);
  };

  const clearAttachment = () => {
    setRawUploadedImage(undefined);
    setReceiptImage(undefined);
    setReceiptFileName(undefined);
    setIsPdfFile(false);
    setOcrDetectedAmount(null);
    setRawOcrText('');
    setAmountOptions([]);
    setShowOcrText(false);
    setScanQuad(null);
    setRotationDeg(0);
    setEdgesDetected(false);
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Bill / Receipt Attachment
              </label>

              {/* Re-open the crop / enhancement editor for the current scan */}
              {receiptImage && !isPdfFile && rawUploadedImage && (
                <button
                  type="button"
                  onClick={openCropEditor}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-cyan-500/20 border-cyan-500/40 text-cyan-300 flex items-center gap-1 transition hover:bg-cyan-500/30"
                  title="Adjust crop corners, rotation and scan filter"
                >
                  <Crop className="w-3 h-3" />
                  <span>Adjust Crop</span>
                </button>
              )}
            </div>

            {/* Fallback camera input, used only when live capture is unavailable */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Hidden Input Ref 2: Mobile Photo Gallery / Files Upload */}
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!receiptImage && !receiptFileName ? (
              <div className="grid grid-cols-2 gap-3">
                
                {/* 1. Live Document Scanner */}
                <div
                  onClick={() => setIsCameraOpen(true)}
                  className="border-2 border-dashed border-slate-700 hover:border-[#00A3E0] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#00A3E0]/10 group-hover:bg-[#00A3E0]/20 text-[#00A3E0] flex items-center justify-center mb-1.5 transition">
                    <ScanLine className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Scan Bill</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Auto edge detect &amp; crop</span>
                </div>

                {/* 2. File / Gallery Upload Trigger */}
                <div
                  onClick={() => galleryInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 transition">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Choose File / PDF</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Photos & PDF Bills</span>
                </div>

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
                    {(isScanning || isProcessingImage) && (
                      <span className="inline-flex items-center text-[10px] text-cyan-400 animate-pulse font-medium shrink-0">
                        <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                        {isProcessingImage ? 'Cropping...' : 'Reading...'}
                      </span>
                    )}
                  </div>

                  {!isPdfFile && !isProcessingImage && edgesDetected && (
                    <div className="mt-0.5 flex items-center space-x-1 text-[10px] text-cyan-300/90 font-medium">
                      <Crop className="w-3 h-3" />
                      <span>Edges detected &amp; deskewed</span>
                    </div>
                  )}

                  {ocrDetectedAmount !== null && !isScanning && (
                    <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Detected Amount: SAR {ocrDetectedAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 mt-1 text-xs flex-wrap gap-y-1">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="text-cyan-400 hover:underline font-medium"
                    >
                      Rescan
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      Gallery File
                    </button>
                    {rawOcrText && (
                      <>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => setShowOcrText((v) => !v)}
                          className="text-slate-400 hover:text-slate-200 hover:underline font-medium"
                        >
                          {showOcrText ? 'Hide text' : 'Scanned text'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearAttachment}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* What the OCR actually read — the fastest way to see why a value looks wrong */}
            {showOcrText && rawOcrText && (
              <pre
                dir="auto"
                className="mt-2 max-h-40 overflow-auto rounded-xl bg-slate-950 border border-slate-800 p-3 text-[10px] leading-relaxed text-slate-400 whitespace-pre-wrap break-words"
              >
                {rawOcrText}
              </pre>
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

          {/* CLEAN AMOUNT INPUT (SAR by default) */}
          {originalCurrency === 'SAR' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-200">
                  Amount in SAR (Saudi Riyals) <span className="text-rose-400">*</span>
                </label>
                
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

              {/* OCR picked one total; the other figures on the bill are one tap away. */}
              {amountOptions.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Wrong amount? Other figures on this bill
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {amountOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSarAmount(option.toFixed(2))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          sarAmount === option.toFixed(2)
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-500/60 hover:text-cyan-300'
                        }`}
                      >
                        {option.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* USD CONVERSION BOX */
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

      {/* Live camera document scanner */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(frameDataUrl, quad) => {
          setIsCameraOpen(false);
          setRawUploadedImage(frameDataUrl);
          setScanQuad(quad);
          setRotationDeg(0);
          setCropSource(frameDataUrl);
        }}
        onFallbackToFilePicker={() => {
          setIsCameraOpen(false);
          // Native camera app, then the same detect/deskew pipeline runs on the photo.
          cameraInputRef.current?.click();
        }}
      />

      {/* Crop + enhancement review step */}
      {cropSource && (
        <DocumentCropEditor
          isOpen={Boolean(cropSource)}
          sourceImage={cropSource}
          initialQuad={scanQuad}
          initialMode={scanMode}
          initialRotation={rotationDeg}
          onCancel={() => {
            setCropSource(null);
            // Nothing captured yet means "Retake" should reopen the camera.
            if (!receiptImage) setIsCameraOpen(true);
          }}
          onConfirm={handleCropConfirmed}
        />
      )}
    </div>
  );
};
