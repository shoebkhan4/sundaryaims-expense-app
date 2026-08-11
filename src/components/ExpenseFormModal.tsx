import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Sparkles, AlertCircle, Check, RefreshCw, FileText, DollarSign, Calculator, RotateCw, Contrast, Crop, Image as ImageIcon } from 'lucide-react';
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
 * Auto-detects receipt paper geometry boundaries (removes dark background/table)
 */
function autoCropBillGeometry(img: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, applyScanFilter: boolean) {
  const w = img.width;
  const h = img.height;
  
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Find tight bounding rectangle of receipt paper
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let count = 0;

  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Light/white receipt paper pixels
      const isReceiptPaper = (r > 120 && g > 120 && b > 120) || (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 100);
      if (isReceiptPaper) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }

  // If valid receipt geometry detected (at least 15% of image)
  const cropW = maxX - minX;
  const cropH = maxY - minY;
  const isGeometryValid = count > (w * h * 0.1) && cropW > w * 0.3 && cropH > h * 0.3;

  const startX = isGeometryValid ? Math.max(0, minX - 10) : 0;
  const startY = isGeometryValid ? Math.max(0, minY - 10) : 0;
  const finalW = isGeometryValid ? Math.min(w - startX, cropW + 20) : w;
  const finalH = isGeometryValid ? Math.min(h - startY, cropH + 20) : h;

  // Render cropped receipt geometry
  canvas.width = finalW;
  canvas.height = finalH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalW, finalH);
  ctx.drawImage(img, startX, startY, finalW, finalH, 0, 0, finalW, finalH);

  // Apply Document Scan Filter if requested
  if (applyScanFilter) {
    const croppedData = ctx.getImageData(0, 0, finalW, finalH);
    const d = croppedData.data;

    for (let i = 0; i < d.length; i += 4) {
      let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

      if (gray > 160) {
        gray = 255;
      } else if (gray < 90) {
        gray = 0;
      } else {
        gray = (gray - 90) * (255 / (160 - 90));
      }

      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(croppedData, 0, 0);
  }
}

/**
 * Mobile Document Scanner Canvas Filter with Auto Geometry Crop
 */
function processDocumentScan(dataUrl: string, applyScanFilter = true, autoCropGeometry = true, rotationDeg = 0): Promise<string> {
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
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      if (autoCropGeometry) {
        autoCropBillGeometry(img, canvas, ctx, applyScanFilter);
      } else {
        const isRotated90 = (rotationDeg / 90) % 2 !== 0;
        canvas.width = isRotated90 ? h : w;
        canvas.height = isRotated90 ? w : h;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotationDeg * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();

        if (applyScanFilter) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;

          for (let i = 0; i < d.length; i += 4) {
            let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

            if (gray > 160) {
              gray = 255;
            } else if (gray < 90) {
              gray = 0;
            } else {
              gray = (gray - 90) * (255 / (160 - 90));
            }

            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
          }
          ctx.putImageData(imgData, 0, 0);
        }
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

  // Scanner controls
  const [isScanFilterActive, setIsScanFilterActive] = useState<boolean>(true);
  const [isAutoCropActive, setIsAutoCropActive] = useState<boolean>(true);
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  // OCR states
  const [isScanning, setIsScanning] = useState(false);
  const [ocrDetectedAmount, setOcrDetectedAmount] = useState<number | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  // Separate refs for Camera vs File Gallery upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

        // Apply Document Geometry Auto Crop & High Contrast Filter
        const scannedDataUrl = await processDocumentScan(rawDataUrl, true, true, 0);
        setReceiptImage(scannedDataUrl);

        // Run OCR with Arabic (ر.س / المجموع / ٠-٩) & English support
        setIsScanning(true);
        const ocrResult = await scanReceiptImage(scannedDataUrl);
        setIsScanning(false);

        if (ocrResult.rawText) setRawOcrText(ocrResult.rawText);

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

  const handleUpdateScanSettings = async (filterOn: boolean, autoCrop: boolean, rot: number) => {
    if (!rawUploadedImage) return;
    setIsScanFilterActive(filterOn);
    setIsAutoCropActive(autoCrop);
    setRotationDeg(rot);
    const updated = await processDocumentScan(rawUploadedImage, filterOn, autoCrop, rot);
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Bill / Receipt Attachment
              </label>

              {/* Document Scanner Controls */}
              {receiptImage && !isPdfFile && (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateScanSettings(!isScanFilterActive, isAutoCropActive, rotationDeg)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 transition ${
                      isScanFilterActive
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Toggle Scan Contrast Filter"
                  >
                    <Contrast className="w-3 h-3" />
                    <span>Filter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateScanSettings(isScanFilterActive, !isAutoCropActive, rotationDeg)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 transition ${
                      isAutoCropActive
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Toggle Auto Geometry Edge Crop"
                  >
                    <Crop className="w-3 h-3" />
                    <span>Auto Geometry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateScanSettings(isScanFilterActive, isAutoCropActive, (rotationDeg + 90) % 360)}
                    className="p-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition"
                    title="Rotate Photo 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Hidden Input Ref 1: Mobile Camera Capture */}
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
                
                {/* 1. Camera Trigger */}
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-[#00A3E0] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-800/40 hover:bg-slate-800/80 transition text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#00A3E0]/10 group-hover:bg-[#00A3E0]/20 text-[#00A3E0] flex items-center justify-center mb-1.5 transition">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Take Photo</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Use Phone Camera</span>
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

                  <div className="flex items-center space-x-3 mt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-cyan-400 hover:underline font-medium"
                    >
                      Camera Photo
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      Gallery File
                    </button>
                  </div>
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
    </div>
  );
};
