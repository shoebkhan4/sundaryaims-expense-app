import { createWorker } from 'tesseract.js';
import { ExpenseCategory } from '../types/expense';

export interface OcrResult {
  amount?: number;
  /** Other monetary values found on the bill, best first, for one-tap correction. */
  amountOptions?: number[];
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

/**
 * Turns receipt text into form fields. Shared by image OCR and by PDF text
 * extraction, so a PDF bill is read the same way a photographed one is.
 */
export function parseReceiptText(text: string, confidence = 0): OcrResult {
  const normalizedText = normalizeArabicNumerals(text);

  const isUsd =
    normalizedText.includes('$') ||
    normalizedText.toLowerCase().includes('usd') ||
    normalizedText.toLowerCase().includes('dollar');
  const currencyHint: 'SAR' | 'USD' = isUsd ? 'USD' : 'SAR';

  const candidates = extractAmountCandidates(normalizedText);
  const parsedAmount = extractArabicSarTotalAmount(normalizedText);

  return {
    amount: parsedAmount,
    amountOptions: candidates
      .filter((c) => c.value !== parsedAmount && (c.value % 1 !== 0 || c.score >= 40))
      .sort((a, b) => b.value - a.value)
      .map((c) => c.value)
      .slice(0, 5),
    date: extractDate(normalizedText),
    vendor: extractVendor(normalizedText),
    category: autoDetectCategory(normalizedText),
    currencyHint,
    rawText: text,
    confidence
  };
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

    return parseReceiptText(text, confidence);

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
 * A monetary value found on the bill, with why it was picked.
 * Surfaced in the UI so a wrong guess is one tap away from being corrected.
 */
export interface AmountCandidate {
  value: number;
  score: number;
  label: string;
}

/* Lines that never hold the payable total. Checked before anything else, so a
 * VAT or unit-price line cannot win just because it also says "شامل الضريبة". */
const NON_TOTAL_LINE =
  /(?:غير\s*شامل|قبل\s*الضريبة|الخصم|التقريب|القيمة\s*المضافة|الكمية|لتر|السعر|سعر\s*الوحدة|المضخة|\bVAT\b|\bTAX\b|SUB\s*-?\s*TOTAL|UNIT\s*PRICE|\bQTY\b|QUANTITY|\bLITER|\bLTR\b|\bCHANGE\b|CASH\s*BACK|APPROVAL|AUTH\s*CODE|\bRRN\b|\bNCRB\b|TERMINAL|MERCHANT|\bBATCH\b|\bTRACE\b|\bAID\b|CONTACTLESS|CUSTOMER\s*COPY|RETAIN\s*RECEIPT|THANK\s*YOU)/i;

/** Strongest wording for "the amount actually payable". */
const TIER_TOTAL_STRONG =
  /(?:المبلغ\s*شامل|شامل\s*الضريبة|الإجمالي\s*شامل|الاجمالي\s*شامل|المجموع\s*الكلي|المجموع\s*الإجمالي|إجمالي\s*الفاتورة|إجمالي\s*المبلغ|المبلغ\s*الإجمالي|GRAND\s*TOTAL|TOTAL\s*(?:AMOUNT|INCL|DUE|PAID)|AMOUNT\s*DUE|PURCHASE\s*AMOUNT|NET\s*AMOUNT|TOTAL\s*SAR|مبلغ\s*الشراء|قيمة\s*الشراء)/i;

/** Ordinary total wording. */
const TIER_TOTAL =
  /(?:الإجمالي|الاجمالي|المجموع|الصافي|صافي|المبلغ\s*المستحق|\bTOTAL\b|\bNET\b|\bDUE\b|\bPAID\b)/i;

/** Merely currency context — weak on its own. */
const TIER_CURRENCY = /(?:المبلغ|\bAMOUNT\b|ر\.?\s*س|ريال|\bSAR\b|\bSR\b|\bRIYALS?\b|\bSR\.|﷼)/i;

/**
 * Blanks out digit runs that are never money: dates, times, percentages,
 * card masks, VAT/CR/phone numbers and invoice ids.
 */
function maskNonMonetaryDigits(line: string): string {
  return line
    .replace(/\b\d{1,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')
    .replace(/[*#]{2,}/g, ' ')
    .replace(/\b\d[\d,]{6,}\b/g, ' ');
}

const NUMBER_TOKEN = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+[.,]\d{1,3}|\d+/g;

/**
 * A currency mark sitting against a number.
 *
 * Tesseract has no glyph for the Saudi Riyal symbol, so on a mada/Visa slip
 * "SAR 70.00" comes back as "#70" — the symbol degrades to #, £, ¥ or similar.
 * Those stand-ins are the only remaining evidence that the number is money, so
 * they are treated as currency context rather than punctuation.
 */
const CURRENCY_MARK = /[﷼#£¥₹€$]|ر\.?\s*س|\bSAR\b|\bSR\b|ريال|\bRIYALS?\b/i;

interface ParsedNumber {
  value: number;
  decimals: number;
  /** A currency symbol sits immediately beside this number. */
  currencyMarked: boolean;
}

function parseNumbersOnLine(line: string): ParsedNumber[] {
  const masked = maskNonMonetaryDigits(line);
  const out: ParsedNumber[] = [];

  for (const match of masked.matchAll(NUMBER_TOKEN)) {
    const token = match[0];
    const before = masked.slice(Math.max(0, match.index - 4), match.index);
    const after = masked.slice(match.index + token.length, match.index + token.length + 6);

    // A digit glued to a letter is not money — "2k" is what OCR made of a
    // riyal amount it could not read, and reading it as 2.00 would fill the
    // form with a confident wrong total. A trailing currency word is fine.
    if (/^[A-Za-z]/.test(after) && !/^(?:sar|sr|riyals?|rs)\b/i.test(after)) continue;

    const currencyMarked = CURRENCY_MARK.test(before) || CURRENCY_MARK.test(after);
    let value: number;
    let decimals = 0;

    if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(token)) {
      // 1,234.56 — comma groups thousands
      const dot = token.indexOf('.');
      decimals = dot === -1 ? 0 : token.length - dot - 1;
      value = parseFloat(token.replace(/,/g, ''));
    } else if (/^\d+[.,]\d{1,3}$/.test(token)) {
      const sep = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
      decimals = token.length - sep - 1;
      value = parseFloat(token.replace(',', '.'));
    } else {
      value = parseInt(token, 10);
    }

    if (!isFinite(value) || value <= 0.04 || value > 200000) continue;
    out.push({ value, decimals, currencyMarked });
  }

  return out;
}

/** Value of the first number on a line matching `pattern`, if any. */
function findLabelledValue(lines: string[], pattern: RegExp): number | undefined {
  for (const line of lines) {
    if (!pattern.test(line)) continue;
    const nums = parseNumbersOnLine(line);
    if (nums.length > 0) return nums[nums.length - 1].value;
  }
  return undefined;
}

/**
 * Scores every monetary value on the bill and ranks them, so the payable
 * total wins over VAT, discounts, unit prices, quantities and reference
 * numbers. Returns the ranked list; the UI offers the runners-up as
 * one-tap corrections.
 */
export function extractAmountCandidates(text: string): AmountCandidate[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // A total that equals subtotal + VAT is almost certainly the real total.
  const subtotal = findLabelledValue(lines, /غير\s*شامل|قبل\s*الضريبة|SUB\s*-?\s*TOTAL/i);
  // Must be the VAT *amount* line: a bare "ضريبة" also appears in the header
  // ("فاتورة ضريبية") and in the unit-price line ("شامل الضريبة").
  const vat = findLabelledValue(lines, /القيمة\s*المضافة|\bVAT\b/i);
  const rounding = findLabelledValue(lines, /التقريب|ROUNDING/i) ?? 0;
  const expectedTotal =
    subtotal !== undefined && vat !== undefined ? subtotal + vat + rounding : undefined;

  const scored = new Map<number, AmountCandidate>();
  /** A total keyword with no number on its own line applies to the next line. */
  let carriedTier = 0;

  lines.forEach((line, index) => {
    const strong = TIER_TOTAL_STRONG.test(line);
    const total = TIER_TOTAL.test(line);
    const currency = TIER_CURRENCY.test(line);
    const excluded = NON_TOTAL_LINE.test(line);

    // Excluded lines still yield candidates, heavily penalised: they must never
    // win, but the user may still want to pick a subtotal or unit price by hand.
    const ownTier = excluded ? -40 : strong ? 100 : total ? 70 : currency ? 40 : 0;
    const numbers = parseNumbersOnLine(line);

    if (numbers.length === 0) {
      // Remember the label; receipts often print the value on the next line.
      carriedTier = ownTier >= 70 ? ownTier : 0;
      return;
    }

    const tier = Math.max(ownTier, carriedTier * 0.85);
    carriedTier = 0;

    numbers.forEach((num, position) => {
      // A number printed against a currency symbol is money even when the
      // receipt's own wording was lost to OCR.
      let score = num.currencyMarked && !excluded ? Math.max(tier, 55) : tier;

      // Money is written with two decimals; three means a unit price.
      if (num.decimals === 2) score += 22;
      else if (num.decimals === 3) score -= 30;
      else if (num.decimals === 0) score -= 12;

      // Totals sit near the bottom of a receipt. Kept small on unlabelled lines
      // so position alone can never look like a confident match.
      const position01 = index / Math.max(1, lines.length - 1);
      score += (tier > 0 ? 12 : 5) * position01;

      // On a labelled line the total is the last number ("TOTAL 3 items 90.00").
      if (tier > 0 && position === numbers.length - 1) score += 8;

      // Large round integers are usually reference numbers, not amounts.
      if (num.decimals === 0 && num.value >= 10000) score -= 25;

      if (expectedTotal !== undefined && Math.abs(num.value - expectedTotal) <= 0.06) {
        score += 80;
      }
      if (subtotal !== undefined && Math.abs(num.value - subtotal) <= 0.001) score -= 45;
      if (vat !== undefined && Math.abs(num.value - vat) <= 0.001) score -= 45;

      const label = strong
        ? 'total incl. VAT'
        : total
        ? 'total'
        : currency
        ? 'currency line'
        : 'on the bill';

      const existing = scored.get(num.value);
      if (!existing || existing.score < score) {
        scored.set(num.value, { value: num.value, score, label });
      }
    });
  });

  return Array.from(scored.values()).sort((a, b) => b.score - a.score);
}

/**
 * Best guess at the payable total of a Saudi Arabic or English receipt.
 */
export function extractArabicSarTotalAmount(text: string): number | undefined {
  const candidates = extractAmountCandidates(text);
  if (candidates.length === 0) return undefined;

  // Among candidates the scoring cannot separate, the larger figure is the
  // total: the smaller ones are its parts. This also settles the case where a
  // slip prints two currency-marked numbers and OCR lost both labels.
  const TIE_BAND = 10;
  const best = candidates[0];
  const tied = candidates.filter((c) => c.score >= best.score - TIE_BAND);
  const winner = tied.reduce((a, c) => (c.value > a.value ? c : a), tied[0]);

  // A negative best score means everything looked like a reference number.
  if (best.score < 0) {
    const monetary = candidates.filter((c) => c.value % 1 !== 0 && c.score > -25);
    if (monetary.length === 0) return undefined;
    return monetary.reduce((a, c) => (c.value > a.value ? c : a), monetary[0]).value;
  }

  return winner.value;
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

/**
 * Extracts a receipt date without relying on `new Date(string)`, which reads
 * ambiguous forms as US month-first (03/04/2026 -> 4 March). Saudi receipts are
 * day-first, so DD/MM is assumed unless the first field cannot be a day.
 *
 * Every candidate must also land in a plausible window around today. A smudged
 * thermal print that OCRs "12/08/26" as "12/08/06" would otherwise file the
 * expense in 2006.
 */
export function extractDate(text: string, today: Date = new Date()): string | undefined {
  const lines = text.split('\n');
  const candidates: { iso: string; score: number }[] = [];
  const order = detectDateOrder(text);

  const oldest = new Date(today.getTime());
  oldest.setFullYear(oldest.getFullYear() - 2);
  const newest = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

  const isPlausible = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return d >= new Date(oldest.toISOString().split('T')[0]) && d <= newest;
  };

  lines.forEach((line) => {
    // Receipts label the date, and usually print a time beside it.
    const labelled = /التاريخ|تاريخ|\bDATE\b/i.test(line);
    const hasTime = /\b\d{1,2}:\d{2}\b/.test(line);

    // ISO-like: 2026-08-11
    for (const m of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      const iso = buildIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (iso && isPlausible(iso)) {
        candidates.push({ iso, score: 60 + (labelled ? 20 : 0) + (hasTime ? 15 : 0) });
      }
    }

    // Written month: "11 Aug 2026", "Aug 11, 2026", "11 أغسطس 2026".
    for (const named of namedMonthDates(line, today)) {
      if (isPlausible(named)) {
        candidates.push({ iso: named, score: 70 + (labelled ? 20 : 0) + (hasTime ? 15 : 0) });
      }
    }

    // All-numeric: 11.08.2026, 12/08/26, and the month-first form.
    for (const m of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
      const first = Number(m[1]);
      const second = Number(m[2]);
      const yearRaw = m[3];

      for (const year of expandYear(yearRaw, today)) {
        // Follow the order the document itself uses; day-first otherwise,
        // which is how bills are printed here.
        let day = order === 'monthFirst' ? second : first;
        let month = order === 'monthFirst' ? first : second;
        if (day > 12 && month > 12) continue;
        if (day > 31 || (month > 12 && day <= 12)) {
          [day, month] = [month, day];
        }
        const iso = buildIsoDate(year, month, day);
        if (iso && isPlausible(iso)) {
          candidates.push({
            iso,
            score: 50 + (labelled ? 20 : 0) + (hasTime ? 15 : 0) + (yearRaw.length === 4 ? 10 : 0)
          });
          break;
        }
      }
    }
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].iso;
}

/**
 * Which way round a document writes its numeric dates.
 *
 * Bills here are day/month/year, but the same three numbers can be either
 * order, and a receipt read as month-first files an August expense in November.
 * When any date on the document is unambiguous — a first field above twelve can
 * only be a day, a second field above twelve can only be a day — that settles
 * the order for the ambiguous dates beside it. With nothing to go on, day-first
 * is assumed, which is how bills are printed here.
 */
function detectDateOrder(text: string): 'dayFirst' | 'monthFirst' {
  let dayFirst = 0;
  let monthFirst = 0;

  for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12 && second <= 12) dayFirst++;
    else if (second > 12 && first <= 12) monthFirst++;
  }

  return monthFirst > dayFirst ? 'monthFirst' : 'dayFirst';
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Arabic calendar month names as printed on Saudi invoices.
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6,
  'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10,
  'نوفمبر': 11, 'ديسمبر': 12
};

function monthFromName(raw: string): number | undefined {
  const key = raw.trim().toLowerCase();
  if (MONTH_NAMES[key] !== undefined) return MONTH_NAMES[key];
  const short = key.slice(0, 3);
  return MONTH_NAMES[short];
}

/** Dates written with the month spelled out: "11 Aug 2026", "Aug 11, 2026". */
function namedMonthDates(line: string, today: Date): string[] {
  const found: string[] = [];
  const monthWord = '[A-Za-z\\u0600-\\u06FF]{3,10}';

  // Day first: 11 Aug 2026 / 11-أغسطس-2026
  for (const m of line.matchAll(new RegExp(`\\b(\\d{1,2})\\s*[-/ ]\\s*(${monthWord})\\s*[-/, ]\\s*(\\d{2,4})\\b`, 'g'))) {
    const month = monthFromName(m[2]);
    if (!month) continue;
    for (const year of expandYear(m[3], today)) {
      const iso = buildIsoDate(year, month, Number(m[1]));
      if (iso) {
        found.push(iso);
        break;
      }
    }
  }

  // Month first: Aug 11, 2026
  for (const m of line.matchAll(new RegExp(`\\b(${monthWord})\\s+(\\d{1,2})\\s*[-/, ]\\s*(\\d{2,4})\\b`, 'g'))) {
    const month = monthFromName(m[1]);
    if (!month) continue;
    for (const year of expandYear(m[3], today)) {
      const iso = buildIsoDate(year, month, Number(m[2]));
      if (iso) {
        found.push(iso);
        break;
      }
    }
  }

  return found;
}

/** Two-digit years resolve to whichever century lands nearest today. */
function expandYear(raw: string, today: Date): number[] {
  if (raw.length === 4) return [Number(raw)];
  const yy = Number(raw);
  const century = Math.floor(today.getFullYear() / 100) * 100;
  return [century + yy, century - 100 + yy];
}

function buildIsoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  if (year < 2000 || year > 2100) return undefined;

  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return d.toISOString().split('T')[0];
}

/** Document titles and card-slip boilerplate are not the merchant's name. */
const NOT_A_VENDOR =
  /(?:فاتورة|ضريبية|مبسطة|ضريبة|TAX\s*INVOICE|SIMPLIFIED|INVOICE|RECEIPT|\bVISA\b|MASTERCARD|\bMADA\b|PURCHASE|CREDIT|DEBIT|بطاقة|APPROVED|WELCOME|THANK)/i;

/**
 * Picks the merchant line from the top of the receipt: the longest mostly
 * alphabetic line that is not a document title or a row of digits.
 */
function extractVendor(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .slice(0, 6);

  let best: string | undefined;

  for (const line of lines) {
    if (NOT_A_VENDOR.test(line)) continue;

    const letters = (line.match(/[\p{L}]/gu) || []).length;
    if (letters < 4 || letters / line.length < 0.5) continue;

    if (!best || line.length > best.length) best = line;
  }

  return best ? best.substring(0, 40) : undefined;
}
