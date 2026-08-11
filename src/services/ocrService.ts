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
 * Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) and Persian numerals to standard digits (0123456789)
 */
function normalizeArabicNumerals(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(arabicDigits[i], 'g'), String(i));
    res = res.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }
  return res;
}

export async function scanReceiptImage(imageSrc: string | File): Promise<OcrResult> {
  try {
    const imageUrl = typeof imageSrc === 'string' ? imageSrc : URL.createObjectURL(imageSrc);
    
    let text = '';
    let confidence = 0;

    try {
      const worker = await createWorker('eng+ara');
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      text = data.text || '';
      confidence = data.confidence || 0;
    } catch {
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

    const parsedAmount = extractArabicSarTotalAmount(normalizedText);
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
 * Robust extraction of SAR amounts from Saudi Arabic & English receipts
 */
function extractArabicSarTotalAmount(text: string): number | undefined {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. High-priority Arabic & English Total Patterns
  const totalKeywordsRegex = /(?:المجموع\s*الإجمالي|المجموع\s*الكلي|المجموع|الإجمالي|المبلغ\s*المستحق|إجمالي\s*الفاتورة|إجمالي\s*المبلغ|المبلغ|صافي|الصافي|TOTAL|GRAND\s*TOTAL|NET\s*AMOUNT|AMOUNT|SAR|SR|RIYAL|ر\.س|ريال)/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (totalKeywordsRegex.test(line)) {
      // Find all numbers with decimals or integers in this line or nearby lines
      const nums = line.match(/\b\d+(?:[\.,]\d{1,2})?\b/g);
      if (nums && nums.length > 0) {
        // Parse numbers from line
        const parsed = nums.map(n => parseFloat(n.replace(',', '.'))).filter(v => !isNaN(v) && v > 0 && v < 500000);
        if (parsed.length > 0) {
          // Return the largest number found on total line
          return Math.max(...parsed);
        }
      }
    }
  }

  // 2. Search numbers attached to "ر.س" or "SAR" or "ريال" anywhere in text
  const currencyMatch = text.match(/(?:ر\.س|ريال|SAR|SR)\s*[:=]?\s*(\d+(?:[\.,]\d{1,2})?)|(\d+(?:[\.,]\d{1,2})?)\s*(?:ر\.s|ريال|SAR|SR)/i);
  if (currencyMatch) {
    const valStr = currencyMatch[1] || currencyMatch[2];
    if (valStr) {
      const val = parseFloat(valStr.replace(',', '.'));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // 3. Fallback: Find largest valid monetary decimal number in receipt
  const numbers = text.match(/\b\d{1,5}[\.,]\d{2}\b/g);
  if (numbers && numbers.length > 0) {
    const floatVals = numbers.map(n => parseFloat(n.replace(',', '.'))).filter(v => !isNaN(v) && v > 0 && v < 200000);
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
  
  if (
    lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol') || lower.includes('water') || lower.includes('electricity') || lower.includes('fgp') ||
    lower.includes('وقود') || lower.includes('بنزين') || lower.includes('محطة') || lower.includes('كهرباء') || lower.includes('ماء') || lower.includes('ديزل')
  ) {
    return 'Electricity water fuel';
  }

  if (
    lower.includes('food') || lower.includes('meal') || lower.includes('restaurant') || lower.includes('cafe') || lower.includes('grocery') ||
    lower.includes('طعام') || lower.includes('مطعم') || lower.includes('وجبة') || lower.includes('سوبرماركت') || lower.includes('تموينات') || lower.includes('بقال')
  ) {
    return 'Site Food';
  }

  if (lower.includes('material') || lower.includes('parts') || lower.includes('aliexpress') || lower.includes('amazon') || lower.includes('قطع') || lower.includes('مواد')) {
    return lower.includes('online') || lower.includes('aliexpress') || lower.includes('amazon') ? 'Online Parts Purchased (Project)' : 'Project Material';
  }

  if (
    lower.includes('repair') || lower.includes('maintenance') || lower.includes('fix') || lower.includes('plumbing') ||
    lower.includes('صيانة') || lower.includes('تصليح') || lower.includes('إصلاح') || lower.includes('ورشة')
  ) {
    return 'Site Office small repair';
  }

  if (
    lower.includes('rental') || lower.includes('spot') || lower.includes('rent') || lower.includes('crane') || lower.includes('vehicle') ||
    lower.includes('تأجير') || lower.includes('إيجار') || lower.includes('رافعة')
  ) {
    return 'Spot rental equpt';
  }

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
