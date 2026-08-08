import { createWorker } from 'tesseract.js';
import { ExpenseCategory } from '../types/expense';

export interface OcrResult {
  amount?: number;
  date?: string;
  vendor?: string;
  category?: ExpenseCategory;
  rawText: string;
  confidence: number;
}

export async function scanReceiptImage(imageSrc: string | File): Promise<OcrResult> {
  try {
    const imageUrl = typeof imageSrc === 'string' ? imageSrc : URL.createObjectURL(imageSrc);
    
    // Initialize Tesseract worker
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(imageUrl);
    await worker.terminate();

    const text = data.text || '';
    const confidence = data.confidence || 0;

    const parsedAmount = extractTotalAmount(text);
    const parsedCategory = autoDetectCategory(text);
    const parsedDate = extractDate(text);
    const parsedVendor = extractVendor(text);

    return {
      amount: parsedAmount,
      date: parsedDate,
      vendor: parsedVendor,
      category: parsedCategory,
      rawText: text,
      confidence
    };
  } catch (err) {
    console.error('OCR Processing error:', err);
    return {
      rawText: 'OCR processing failed or image unreadable.',
      confidence: 0
    };
  }
}

/**
 * Extracts numeric totals (SAR, SR, TOTAL, GRAND TOTAL, etc.)
 */
function extractTotalAmount(text: string): number | undefined {
  const lines = text.split('\n');
  const totalRegex = /(?:TOTAL|GRAND TOTAL|NET|AMOUNT|SAR|SR|RIYAL|SUM)\s*[:=]?\s*([A-Z]*\s*)?([\d,]+\.?\d*)/i;
  
  // Search from bottom up as totals are usually near bottom of receipts
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const match = line.match(totalRegex);
    if (match && match[2]) {
      const val = parseFloat(match[2].replace(',', ''));
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Fallback: search any number with decimal places or largest number
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
 * Auto-suggest expense category based on receipt keywords
 */
function autoDetectCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  
  if (lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol') || lower.includes('water') || lower.includes('electricity') || lower.includes('fgp')) {
    return 'Electricity water fuel';
  }
  if (lower.includes('repair') || lower.includes('maintenance') || lower.includes('fix') || lower.includes('plumbing')) {
    return 'Site Office small repair';
  }
  if (lower.includes('rental') || lower.includes('spot') || lower.includes('rent') || lower.includes('crane') || lower.includes('vehicle')) {
    return 'Spot rental equpt';
  }
  if (lower.includes('tool') || lower.includes('hardware') || lower.includes('cable') || lower.includes('drill') || lower.includes('equipment')) {
    return 'Site Tools equpt';
  }
  if (lower.includes('food') || lower.includes('meal') || lower.includes('restaurant') || lower.includes('cafe') || lower.includes('grocery') || lower.includes('paper') || lower.includes('consumable')) {
    return 'Sundry Consumable';
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
    // Top non-empty line is usually shop/vendor name
    return lines[0].substring(0, 40);
  }
  return undefined;
}
