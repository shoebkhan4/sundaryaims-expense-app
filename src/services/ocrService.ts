import { createWorker } from 'tesseract.js';
import { ExpenseCategory } from '../types/expense';

export interface OcrResult {
  amount?: number;
  date?: string;
  vendor?: string;
  category?: ExpenseCategory;
  currencyHint?: 'SAR' | 'USD';
  rawText: string;
  confidence: number;
}

/**
 * Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard digits (0123456789)
 */
function normalizeArabicNumerals(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, w => String(arabicDigits.indexOf(w)));
}

export async function scanReceiptImage(imageSrc: string | File): Promise<OcrResult> {
  try {
    const imageUrl = typeof imageSrc === 'string' ? imageSrc : URL.createObjectURL(imageSrc);
    
    // Initialize Tesseract worker with English + Arabic support
    let text = '';
    let confidence = 0;

    try {
      const worker = await createWorker('eng+ara');
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      text = data.text || '';
      confidence = data.confidence || 0;
    } catch {
      // Fallback to eng worker if eng+ara takes long or fails
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      text = data.text || '';
      confidence = data.confidence || 0;
    }

    const normalizedText = normalizeArabicNumerals(text);

    // Detect currency hint
    const isUsd = normalizedText.includes('$') || normalizedText.toLowerCase().includes('usd') || normalizedText.toLowerCase().includes('dollar');
    const currencyHint: 'SAR' | 'USD' = isUsd ? 'USD' : 'SAR';

    const parsedAmount = extractTotalAmount(normalizedText);
    const parsedCategory = autoDetectCategory(normalizedText);
    const parsedDate = extractDate(normalizedText);
    const parsedVendor = extractVendor(normalizedText);

    return {
      amount: parsedAmount,
      date: parsedDate,
      vendor: parsedVendor,
      category: parsedCategory,
      currencyHint,
      rawText: text,
      confidence
    };
  } catch (err) {
    console.error('OCR Processing error:', err);
    return {
      rawText: 'OCR processing failed or image unreadable.',
      confidence: 0,
      currencyHint: 'SAR'
    };
  }
}

/**
 * Extracts numeric totals handling both Arabic (المجموع, المبلغ, إجمالي, ر.س) and English (TOTAL, SAR, etc.)
 */
function extractTotalAmount(text: string): number | undefined {
  const lines = text.split('\n');
  
  // English & Arabic Total keywords
  const totalRegex = /(?:TOTAL|GRAND TOTAL|NET|AMOUNT|SAR|SR|RIYAL|SUM|المجموع|المبلغ|إجمالي|الاجمالي|الصافي|صافي|ر\.س|ريال)\s*[:=]?\s*([A-Z]*\s*)?([\d,]+\.?\d*)/i;
  
  // Search from bottom up as totals are usually near bottom of receipts
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(totalRegex);
    if (match && match[2]) {
      const val = parseFloat(match[2].replace(',', ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Fallback: search any number with decimal places or largest valid number
  const numbers = text.match(/\b\d{1,5}(?:\.\d{1,2})\b/g);
  if (numbers && numbers.length > 0) {
    const floatVals = numbers.map(n => parseFloat(n)).filter(v => !isNaN(v) && v > 0 && v < 100000);
    if (floatVals.length > 0) {
      return Math.max(...floatVals);
    }
  }

  return undefined;
}

/**
 * Auto-suggest expense category based on English & Arabic receipt keywords
 */
function autoDetectCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  
  // Fuel & Utilities (وقود / بنزين / محطة / كهرباء / ماء / ديزل)
  if (
    lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol') || lower.includes('water') || lower.includes('electricity') || lower.includes('fgp') ||
    lower.includes('وقود') || lower.includes('بنزين') || lower.includes('محطة') || lower.includes('كهرباء') || lower.includes('ماء') || lower.includes('ديزل')
  ) {
    return 'Electricity water fuel';
  }

  // Site Food (طعام / مطعم / وجبة / سوبرماركت / تموينات)
  if (
    lower.includes('food') || lower.includes('meal') || lower.includes('restaurant') || lower.includes('cafe') || lower.includes('grocery') ||
    lower.includes('طعام') || lower.includes('مطعم') || lower.includes('وجبة') || lower.includes('سوبرماركت') || lower.includes('تموينات') || lower.includes('بقال')
  ) {
    return 'Site Food';
  }

  // Project Material & Online Parts
  if (lower.includes('material') || lower.includes('parts') || lower.includes('aliexpress') || lower.includes('amazon') || lower.includes('قطع') || lower.includes('مواد')) {
    return lower.includes('online') || lower.includes('aliexpress') || lower.includes('amazon') ? 'Online Parts Purchased (Project)' : 'Project Material';
  }

  // Office Repair (صيانة / تصليح / إلاح / ورشة)
  if (
    lower.includes('repair') || lower.includes('maintenance') || lower.includes('fix') || lower.includes('plumbing') ||
    lower.includes('صيانة') || lower.includes('تصليح') || lower.includes('إصلاح') || lower.includes('ورشة')
  ) {
    return 'Site Office small repair';
  }

  // Spot rental (تأجير / إيجار / رافعة)
  if (
    lower.includes('rental') || lower.includes('spot') || lower.includes('rent') || lower.includes('crane') || lower.includes('vehicle') ||
    lower.includes('تأجير') || lower.includes('إيجار') || lower.includes('رافعة')
  ) {
    return 'Spot rental equpt';
  }

  // Site Tools (أدوات / عد ه / كيبل)
  if (
    lower.includes('tool') || lower.includes('hardware') || lower.includes('cable') || lower.includes('drill') || lower.includes('equipment') ||
    lower.includes('أدوات') || lower.includes('عدة') || lower.includes('كيبل')
  ) {
    return 'Site Tools equpt';
  }

  return 'Sundry Consumable';
}

function extractDate(text: string): string | undefined {
  const dateRegex = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/;
  const match = text.match(dateRegex);
  if (match) {
    try {
      const d = new Date(match[0]);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

function extractVendor(text: string): string | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  if (lines.length > 0) {
    return lines[0].substring(0, 40);
  }
  return undefined;
}
