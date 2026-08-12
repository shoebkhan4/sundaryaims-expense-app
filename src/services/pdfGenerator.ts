import jsPDF from 'jspdf';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import { AIMS_LOGO_BASE64, SHOEB_SIGNATURE_BASE64, LEELA_SIGNATURE_BASE64 } from '../assets/images';

export async function generateF2SummaryPdf(
  headerInfo: CompanyHeaderInfo,
  expenses: ExpenseItem[]
): Promise<{ pdfBlob: Blob; fileName: string; base64: string }> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const grandTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const formattedDate = formatDateForFileName(headerInfo.dateSubmitted);
  const fileName = `Shoeb_SUNDRY EXPENSES_ ${formattedDate}_SAR ${Math.round(grandTotal)}.pdf`;

  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const margin = 10;
  let y = 10;

  // -------------------------------------------------------------
  // 1. EXACT FORM HEADER & LOGOS (AIMS Cyan #00A3E0 & Yellow #FFC20E)
  // -------------------------------------------------------------
  
  // Left: Original AIMS Cyan/Blue Logo
  try {
    doc.addImage(AIMS_LOGO_BASE64, 'JPEG', margin + 2, y, 32, 14);
  } catch (e) {
    console.error('Error rendering AIMS logo:', e);
  }

  // Right: Title Banners (Cyan #00A3E0 & Yellow #FFC20E)
  const bannerX = margin + 100;
  const bannerW = pageWidth - margin - bannerX;

  // Top Cyan Banner
  doc.setFillColor(0, 163, 224); // #00A3E0 Cyan
  doc.rect(bannerX, y, bannerW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('HADAF AL AIMS TRADING CO.', bannerX + bannerW / 2, y + 5, { align: 'center' });

  // Bottom Yellow Banner
  doc.setFillColor(255, 194, 14); // #FFC20E Yellow
  doc.rect(bannerX, y + 7, bannerW, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('F2 FORM (SAUDI RIYALS)', bannerX + bannerW / 2, y + 11.5, { align: 'center' });

  y += 16;

  // -------------------------------------------------------------
  // 2. FORM METADATA GRID (Requirement 5: First Name cell is EMPTY)
  // -------------------------------------------------------------
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  // Row 1
  doc.rect(margin, y, 130, 5);
  doc.text('Family Name', margin + 2, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', margin + 30, y + 3.8);

  doc.rect(margin + 130, y, 30, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Badge No.', margin + 132, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.badgeNo || 'xx', margin + 155, y + 3.8);

  doc.rect(margin + 160, y, 40, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 162, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.dateSubmitted || '11-Apr-26', margin + 185, y + 3.8);

  y += 5;

  // Row 2
  doc.rect(margin, y, 130, 5);
  doc.rect(margin + 130, y, 30, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Place/ Site', margin + 162, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.placeSite || 'KSA', margin + 185, y + 3.8);

  doc.rect(margin + 160, y, 40, 5);

  y += 5;

  // Row 3: FIRST NAME CELL KEPT EMPTY (Requirement 5)
  doc.rect(margin, y, 130, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('First Name', margin + 2, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text('', margin + 30, y + 3.8); // EMPTY as requested

  doc.rect(margin + 130, y, 30, 5);
  doc.setFont('helvetica', 'normal');
  doc.text('xx', margin + 132, y + 3.8);

  doc.rect(margin + 160, y, 40, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Currency', margin + 162, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.currency || 'SAR', margin + 185, y + 3.8);

  y += 5;

  // Row 4
  doc.rect(margin, y, pageWidth - margin * 2, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Expense type', margin + 2, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.expenseTypeSummary || 'Sundry expenses March 2026', margin + 30, y + 3.8);

  y += 7;

  // -------------------------------------------------------------
  // 3. TABLE HEADERS
  // -------------------------------------------------------------
  const columns = [
    { header: 'Date of\nExpense', width: 22 },
    { header: 'Description', width: 93 },
    { header: 'Job no.', width: 20 },
    { header: 'Electricity water\nfuel', width: 24 },
    { header: 'Site Office\nsmall repair', width: 22 },
    { header: 'Spot rental\nequpt', width: 22 },
    { header: 'Site Tools\nequpt', width: 22 },
    { header: 'Sundry\nConsumable', width: 20 },
    { header: 'Account Code', width: 18 },
    { header: 'Fin.Entity', width: 14 }
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);

  let currentX = margin;
  columns.forEach(col => {
    doc.rect(currentX, y, col.width, 10);
    const lines = col.header.split('\n');
    if (lines.length === 1) {
      doc.text(lines[0], currentX + col.width / 2, y + 6, { align: 'center' });
    } else {
      doc.text(lines[0], currentX + col.width / 2, y + 4, { align: 'center' });
      doc.text(lines[1], currentX + col.width / 2, y + 7.5, { align: 'center' });
    }
    currentX += col.width;
  });

  y += 10;

  // -------------------------------------------------------------
  // 4. TABLE ROWS (Requirement 4: Category Grouping or Individual Rows)
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  // Group items by category if consolidateCategories is enabled or by default
  const processedRows = headerInfo.consolidateCategories
    ? groupExpensesByCategory(expenses)
    : expenses.map(e => ({
        dateRange: e.date,
        description: e.description,
        jobNo: e.jobNo,
        category: mapToF2Category(e.category),
        amount: e.amount
      }));

  const categorySums: Record<string, number> = {
    'Electricity water fuel': 0,
    'Site Office small repair': 0,
    'Spot rental equpt': 0,
    'Site Tools equpt': 0,
    'Sundry Consumable': 0
  };

  const totalGridRows = 18;

  for (let r = 0; r < totalGridRows; r++) {
    const rowData = processedRows[r];

    let rx = margin;
    columns.forEach(col => {
      doc.rect(rx, y, col.width, 4.5);
      rx += col.width;
    });

    if (rowData) {
      if (categorySums[rowData.category] !== undefined) {
        categorySums[rowData.category] += rowData.amount;
      } else {
        categorySums['Sundry Consumable'] += rowData.amount;
      }

      let cx = margin;
      // Date Range Column
      const dateText = rowData.dateRange.length > 18 ? rowData.dateRange.substring(0, 16) + '...' : rowData.dateRange;
      doc.text(dateText || '', cx + 1.5, y + 3.3);
      cx += columns[0].width;

      // Description Column (Point-wise listed descriptions)
      const descText = rowData.description.length > 65 ? rowData.description.substring(0, 63) + '...' : rowData.description;
      doc.text(descText, cx + 1.5, y + 3.3);
      cx += columns[1].width;

      // Job no
      doc.text(rowData.jobNo || '', cx + 1.5, y + 3.3);
      cx += columns[2].width;

      // Category Amounts
      const isFuel = rowData.category === 'Electricity water fuel';
      if (isFuel) doc.text(rowData.amount.toFixed(2), cx + columns[3].width - 1.5, y + 3.3, { align: 'right' });
      cx += columns[3].width;

      const isRepair = rowData.category === 'Site Office small repair';
      if (isRepair) doc.text(rowData.amount.toFixed(2), cx + columns[4].width - 1.5, y + 3.3, { align: 'right' });
      cx += columns[4].width;

      const isRental = rowData.category === 'Spot rental equpt';
      if (isRental) doc.text(rowData.amount.toFixed(2), cx + columns[5].width - 1.5, y + 3.3, { align: 'right' });
      cx += columns[5].width;

      const isTools = rowData.category === 'Site Tools equpt';
      if (isTools) doc.text(rowData.amount.toFixed(2), cx + columns[6].width - 1.5, y + 3.3, { align: 'right' });
      cx += columns[6].width;

      const isConsumable = rowData.category === 'Sundry Consumable';
      if (isConsumable) doc.text(rowData.amount.toFixed(2), cx + columns[7].width - 1.5, y + 3.3, { align: 'right' });
      cx += columns[7].width;

      // Account code
      cx += columns[8].width;

      // Fin.Entity Total column
      doc.text(rowData.amount.toFixed(2), cx + columns[9].width - 1.5, y + 3.3, { align: 'right' });
    }

    y += 4.5;
  }

  // -------------------------------------------------------------
  // 5. SUMMARY & FOR FINANCE USE ONLY BOX
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  const midX = margin + columns[0].width + columns[1].width + columns[2].width;
  doc.rect(midX, y, 78, 5);
  doc.text('For Finance Use Only', midX + 39, y + 3.5, { align: 'center' });

  const rightX = midX + 78;
  doc.rect(rightX, y, 34, 5);
  doc.text('Grand Total', rightX + 2, y + 3.5);

  doc.rect(rightX + 34, y, 30, 5);
  doc.text(grandTotal.toFixed(2), rightX + 58, y + 3.5, { align: 'right' });

  y += 5;

  // Row 2: Advance from Company
  doc.rect(midX, y, 78, 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Account Code', midX + 2, y + 3.2);

  doc.rect(rightX, y, 34, 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Advance from Company', rightX + 2, y + 3.2);

  doc.rect(rightX + 34, y, 30, 4.5);
  doc.text((headerInfo.advanceFromCompany || 0).toFixed(2), rightX + 58, y + 3.2, { align: 'right' });

  y += 4.5;

  // Row 3: Bank Balance / previous bal
  doc.rect(midX, y, 78, 4.5);
  doc.text('Date', midX + 2, y + 3.2);

  doc.rect(rightX, y, 34, 4.5);
  doc.text('Bank Balance  / previous bal', rightX + 2, y + 3.2);

  doc.rect(rightX + 34, y, 30, 4.5);
  doc.text((headerInfo.previousBalance || 0).toFixed(2), rightX + 58, y + 3.2, { align: 'right' });

  y += 4.5;

  // Row 4: No. of attachments / Cash in hand
  doc.rect(midX, y, 78, 4.5);
  doc.text('No. of attachments', midX + 2, y + 3.2);

  doc.rect(rightX, y, 34, 4.5);
  doc.text('Cash in hand', rightX + 2, y + 3.2);

  doc.rect(rightX + 34, y, 30, 4.5);
  doc.text((headerInfo.cashInHand || 0).toFixed(2), rightX + 58, y + 3.2, { align: 'right' });

  y += 7;

  // -------------------------------------------------------------
  // 6. EXACT SIGNATURES SECTION (SHOEB SIGNATURE & LEELA SIGNATURE)
  // -------------------------------------------------------------
  const sigColW = (pageWidth - margin * 2) / 3; // ~92.3mm each

  // Box 1: Employee (Shoeb Ali Khan + Original Blue Shoeb Signature Overlay)
  doc.rect(margin, y, sigColW, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Name:', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', margin + 25, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 2, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.dateSubmitted || '11-Apr-26', margin + 25, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Signature:', margin + 2, y + 12);

  // Render Original Blue Shoeb Hand Signature Overlay
  try {
    doc.addImage(SHOEB_SIGNATURE_BASE64, 'PNG', margin + 22, y + 4.5, 26, 8.5);
  } catch (e) {
    console.error('Error rendering Shoeb signature:', e);
  }

  // Box 2: Approver (Leela Venkat + Original Blue Leela Signature Overlay)
  const appX = margin + sigColW;
  doc.rect(appX, y, sigColW, 14);
  doc.setFont('helvetica', 'bold');
  doc.text("Approver's Name:", appX + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.approverName || 'Leela Venkat', appX + 32, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', appX + 2, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.dateSubmitted || '11-Apr-26', appX + 32, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Signature:', appX + 2, y + 12);

  // Render Original Blue Leela Hand Signature Overlay
  try {
    doc.addImage(LEELA_SIGNATURE_BASE64, 'PNG', appX + 30, y + 4.5, 26, 8.5);
  } catch (e) {
    console.error('Error rendering Leela signature:', e);
  }

  // Box 3: Cost Controller
  const ccX = appX + sigColW;
  doc.rect(ccX, y, sigColW, 14);
  doc.setFont('helvetica', 'bold');
  doc.text('Cost Controller:', ccX + 2, y + 4);

  doc.text('Date:', ccX + 2, y + 8);
  doc.text('Signature:', ccX + 2, y + 12);

  // Output PDF
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  const base64 = doc.output('datauristring').split(',')[1];

  return {
    pdfBlob,
    fileName,
    base64
  };
}

/**
 * Maps new granular site categories (e.g. Site Food, Project Material, etc.) to F2 Form table columns
 */
function mapToF2Category(cat: string): string {
  if (cat === 'Electricity water fuel') return 'Electricity water fuel';
  if (cat === 'Site Office small repair') return 'Site Office small repair';
  if (cat === 'Spot rental equpt') return 'Spot rental equpt';
  if (cat === 'Site Tools equpt' || cat === 'Online Parts Purchased (Project)') return 'Site Tools equpt';
  return 'Sundry Consumable'; // Site Food, Project Material, Sundry Consumable, Other
}

/**
 * Group expenses by category with POINT-WISE descriptions and date range (Requirement 4)
 */
function groupExpensesByCategory(expenses: ExpenseItem[]): { dateRange: string; description: string; jobNo: string; category: string; amount: number }[] {
  const groups: Record<string, ExpenseItem[]> = {};

  expenses.forEach(item => {
    const f2Cat = mapToF2Category(item.category);
    if (!groups[f2Cat]) groups[f2Cat] = [];
    groups[f2Cat].push(item);
  });

  const result = [];

  for (const [cat, items] of Object.entries(groups)) {
    if (items.length === 0) continue;

    // Date range from earliest to latest
    const dates = items.map(i => i.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const dateRange = minDate === maxDate ? minDate : `${minDate} to ${maxDate}`;

    // Point-wise description (no + sign) e.g. "1. Site Fuel (6 Visit); 2. Petrol Fill-up"
    const descriptionsPointWise = items.map((i, idx) => `${idx + 1}. ${i.description}`).join('; ');

    // Unique Job numbers
    const jobNos = Array.from(new Set(items.map(i => i.jobNo).filter(j => j && j !== '-'))).join(', ') || '-';

    // Sum total
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);

    result.push({
      dateRange,
      description: descriptionsPointWise,
      jobNo: jobNos,
      category: cat,
      amount: totalAmount
    });
  }

  return result;
}

/**
 * Order bill sheets the same way the categories appear in the entry form.
 */
const BILL_CATEGORY_ORDER: string[] = [
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

/** Most bills that still stay readable on one A4 sheet. */
const BILLS_PER_SHEET = 9;

interface BillGroup {
  category: string;
  items: ExpenseItem[];
  total: number;
  dateRange: string;
}

/** Groups every expense under its own category, in form order. */
function groupBillsForAttachmentSheets(expenses: ExpenseItem[]): BillGroup[] {
  const buckets = new Map<string, ExpenseItem[]>();

  expenses.forEach((item) => {
    const key = item.category || 'Other';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  });

  const ordered = Array.from(buckets.keys()).sort((a, b) => {
    const ia = BILL_CATEGORY_ORDER.indexOf(a);
    const ib = BILL_CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? BILL_CATEGORY_ORDER.length : ia) - (ib === -1 ? BILL_CATEGORY_ORDER.length : ib);
  });

  return ordered.map((category) => {
    const items = (buckets.get(category) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const dates = items.map((i) => i.date).filter(Boolean).sort();
    const dateRange =
      dates.length === 0 ? '-' : dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;

    return {
      category,
      items,
      total: items.reduce((sum, i) => sum + i.amount, 0),
      dateRange
    };
  });
}

/** Grid that keeps the bills as large as possible for the count on the sheet. */
function gridForBillCount(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 1, rows: 2 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 2, rows: 3 };
  return { cols: 3, rows: 3 };
}

function chunkBills<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Draws one bill inside its grid cell, preserving the receipt's aspect ratio. */
function drawBillCell(
  doc: jsPDF,
  item: ExpenseItem,
  billNumber: number,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const captionH = 8;

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);

  // Caption strip: which bill, when, job number and amount.
  doc.setFillColor(238, 242, 246);
  doc.rect(x, y, w, captionH, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${billNumber}`, x + 2, y + 5.4);
  doc.setFont('helvetica', 'normal');

  const jobLabel = item.jobNo && item.jobNo !== '-' ? `  Job ${item.jobNo}` : '';
  const meta = `${item.date}${jobLabel}`;
  doc.text(meta, x + 8, y + 5.4);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 120, 170);
  doc.text(`SAR ${item.amount.toFixed(2)}`, x + w - 2, y + 5.4, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Description, trimmed to the cell width.
  const areaX = x + 2;
  const areaY = y + captionH + 5;
  const areaW = w - 4;
  const areaH = h - captionH - 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  const description = doc.splitTextToSize(item.description || '', areaW)[0] || '';
  doc.text(description, areaX, y + captionH + 3.6);
  doc.setTextColor(0, 0, 0);

  if (!item.receiptImage) {
    // Never substitute a stock receipt for a bill that was never attached.
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.rect(areaX, areaY, areaW, areaH, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('No bill image attached', areaX + areaW / 2, areaY + areaH / 2 - 1, { align: 'center' });
    if (item.receiptFileName) {
      doc.setFontSize(7);
      const name = doc.splitTextToSize(item.receiptFileName, areaW - 4)[0] || '';
      doc.text(name, areaX + areaW / 2, areaY + areaH / 2 + 4, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
    return;
  }

  try {
    const props = doc.getImageProperties(item.receiptImage);
    const format = (props.fileType || 'JPEG').toUpperCase() === 'PNG' ? 'PNG' : 'JPEG';
    const scale = Math.min(areaW / props.width, areaH / props.height);
    const drawW = props.width * scale;
    const drawH = props.height * scale;

    doc.addImage(
      item.receiptImage,
      format,
      areaX + (areaW - drawW) / 2,
      areaY + (areaH - drawH) / 2,
      drawW,
      drawH,
      undefined,
      'FAST'
    );
  } catch (err) {
    console.error('Error adding bill image:', err);
    doc.setFontSize(8);
    doc.setTextColor(190, 80, 80);
    doc.text('Bill image could not be rendered', areaX + areaW / 2, areaY + areaH / 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
}

/**
 * Generates the Compiled Bills PDF: every bill of a category is consolidated
 * onto a single sheet (fuel bills together, food bills together, and so on),
 * spilling onto extra sheets of the same category only past nine bills.
 */
/** One consolidated attachment sheet, surfaced so the UI can state what the PDF holds. */
export interface BillSheetSummary {
  category: string;
  bills: number;
  total: number;
}

export async function generateCompiledBillsPdf(
  headerInfo: CompanyHeaderInfo,
  expenses: ExpenseItem[]
): Promise<{ pdfBlob: Blob; fileName: string; base64: string; sheets: BillSheetSummary[] }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const formattedDate = formatDateForFileName(headerInfo.dateSubmitted);
  const fileName = `Shoeb_SUNDRY EXPENSES_ ${formattedDate}_Compiled_Bills.pdf`;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageWidth - margin * 2;

  const groups = groupBillsForAttachmentSheets(expenses);
  const sheetSummaries: BillSheetSummary[] = [];
  let sheetNo = 0;

  groups.forEach((group) => {
    const sheets = chunkBills(group.items, BILLS_PER_SHEET);

    sheets.forEach((sheetItems, sheetIdx) => {
      if (sheetNo > 0) doc.addPage();
      sheetNo++;
      sheetSummaries.push({
        category: group.category,
        bills: sheetItems.length,
        total: sheetItems.reduce((sum, i) => sum + i.amount, 0)
      });

      // Category banner
      doc.setFillColor(0, 163, 224);
      doc.rect(margin, 10, contentW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);

      const sheetSuffix = sheets.length > 1 ? ` (SHEET ${sheetIdx + 1} OF ${sheets.length})` : '';
      doc.text(
        `${group.category.toUpperCase()} - ${group.items.length} BILL${group.items.length === 1 ? '' : 'S'}${sheetSuffix}`,
        pageWidth / 2,
        16.5,
        { align: 'center' }
      );

      // Category summary strip
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, 20, contentW, 7, 'F');
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Period: ${group.dateRange}`, margin + 2, 24.8);
      doc.text('HADAF AL AIMS TRADING CO.', pageWidth / 2, 24.8, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 120, 170);
      doc.text(`Category Total: SAR ${group.total.toFixed(2)}`, pageWidth - margin - 2, 24.8, { align: 'right' });
      doc.setTextColor(0, 0, 0);

      // Bill grid
      const areaX = margin;
      const areaY = 30;
      const areaW = contentW;
      const areaH = pageHeight - areaY - 12;

      const { cols, rows } = gridForBillCount(sheetItems.length);
      const gap = 4;
      const cellW = (areaW - gap * (cols - 1)) / cols;
      const cellH = (areaH - gap * (rows - 1)) / rows;

      sheetItems.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawBillCell(
          doc,
          item,
          sheetIdx * BILLS_PER_SHEET + i + 1,
          areaX + col * (cellW + gap),
          areaY + row * (cellH + gap),
          cellW,
          cellH
        );
      });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text(`Compiled bill attachments - ${headerInfo.dateSubmitted}`, margin, pageHeight - 5);
      doc.text(`Sheet ${sheetNo}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    });
  });

  if (sheetNo === 0) {
    doc.setFillColor(0, 163, 224);
    doc.rect(margin, 10, contentW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('COMPILED BILL ATTACHMENTS', pageWidth / 2, 16.5, { align: 'center' });
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No expense items have been added to this report yet.', pageWidth / 2, 40, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  const base64 = doc.output('datauristring').split(',')[1];

  return {
    pdfBlob,
    fileName,
    base64,
    sheets: sheetSummaries
  };
}

function formatDateForFileName(dateStr?: string): string {
  if (!dateStr) return '27- June 26';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const shortYear = String(year).slice(-2);
    return `${day}- ${month} ${shortYear}`;
  } catch {
    return '27- June 26';
  }
}
