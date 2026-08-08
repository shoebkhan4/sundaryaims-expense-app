import jsPDF from 'jspdf';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import { AIMS_LOGO_BASE64, LEELA_SIGNATURE_BASE64, SAMPLE_RECEIPT_BASE64 } from '../assets/images';

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
  // 1. EXACT FORM HEADER & LOGOS (Matching Original F2 Form PDF)
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
  // 2. FORM METADATA GRID (Exact Table Borders & Fields)
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

  // Row 3
  doc.rect(margin, y, 130, 5);
  doc.setFont('helvetica', 'bold');
  doc.text('First Name', margin + 2, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text('Direct.or BU', margin + 30, y + 3.8);

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
  // 3. TABLE HEADERS (Matching exact width & columns)
  // -------------------------------------------------------------
  const columns = [
    { header: 'Date of\nExpense', width: 22 },
    { header: 'Description', width: 105 },
    { header: 'Job no.', width: 22 },
    { header: 'Electricity water\nfuel', width: 26 },
    { header: 'Site Office\nsmall repair', width: 22 },
    { header: 'Spot rental\nequpt', width: 22 },
    { header: 'Site Tools\nequpt', width: 22 },
    { header: 'Sundry\nConsumable', width: 20 },
    { header: 'Account Code', width: 22 },
    { header: 'Fin.Entity', width: 18 }
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
  // 4. TABLE ROWS (Grid lines with 22 rows like Excel)
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const categorySums: Record<string, number> = {
    'Electricity water fuel': 0,
    'Site Office small repair': 0,
    'Spot rental equpt': 0,
    'Site Tools equpt': 0,
    'Sundry Consumable': 0
  };

  const totalGridRows = 18; // Draws empty row lines like original F2 form sheet

  for (let r = 0; r < totalGridRows; r++) {
    const item = expenses[r];

    let rx = margin;
    columns.forEach(col => {
      doc.rect(rx, y, col.width, 4.5);
      rx += col.width;
    });

    if (item) {
      if (categorySums[item.category] !== undefined) {
        categorySums[item.category] += item.amount;
      } else {
        categorySums['Sundry Consumable'] += item.amount;
      }

      let cx = margin;
      // Date
      doc.text(item.date || '', cx + 2, y + 3.3);
      cx += columns[0].width;

      // Description
      const descText = item.description.length > 70 ? item.description.substring(0, 68) + '...' : item.description;
      doc.text(descText, cx + 2, y + 3.3);
      cx += columns[1].width;

      // Job no
      doc.text(item.jobNo || '', cx + 2, y + 3.3);
      cx += columns[2].width;

      // Fuel
      const isFuel = item.category === 'Electricity water fuel';
      if (isFuel) doc.text(item.amount.toFixed(2), cx + columns[3].width - 2, y + 3.3, { align: 'right' });
      cx += columns[3].width;

      // Repair
      const isRepair = item.category === 'Site Office small repair';
      if (isRepair) doc.text(item.amount.toFixed(2), cx + columns[4].width - 2, y + 3.3, { align: 'right' });
      cx += columns[4].width;

      // Rental
      const isRental = item.category === 'Spot rental equpt';
      if (isRental) doc.text(item.amount.toFixed(2), cx + columns[5].width - 2, y + 3.3, { align: 'right' });
      cx += columns[5].width;

      // Tools
      const isTools = item.category === 'Site Tools equpt';
      if (isTools) doc.text(item.amount.toFixed(2), cx + columns[6].width - 2, y + 3.3, { align: 'right' });
      cx += columns[6].width;

      // Consumables
      const isConsumable = item.category === 'Sundry Consumable' || item.category === 'Other';
      if (isConsumable) doc.text(item.amount.toFixed(2), cx + columns[7].width - 2, y + 3.3, { align: 'right' });
      cx += columns[7].width;

      // Account code
      cx += columns[8].width;

      // Fin.Entity Total column
      doc.text(item.amount.toFixed(2), cx + columns[9].width - 2, y + 3.3, { align: 'right' });
    }

    y += 4.5;
  }

  // -------------------------------------------------------------
  // 5. SUMMARY & FOR FINANCE USE ONLY BOX
  // -------------------------------------------------------------
  // For Finance Use Only Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  const midX = margin + columns[0].width + columns[1].width + columns[2].width;
  doc.rect(midX, y, 80, 5);
  doc.text('For Finance Use Only', midX + 40, y + 3.5, { align: 'center' });

  const rightX = midX + 80;
  doc.rect(rightX, y, 40, 5);
  doc.text('Grand Total', rightX + 2, y + 3.5);

  doc.rect(rightX + 40, y, 36, 5);
  doc.text(grandTotal.toFixed(2), rightX + 74, y + 3.5, { align: 'right' });

  y += 5;

  // Row 2: Advance from Company
  doc.rect(midX, y, 80, 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Account Code', midX + 2, y + 3.2);

  doc.rect(rightX, y, 40, 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Advance from Company', rightX + 2, y + 3.2);

  doc.rect(rightX + 40, y, 36, 4.5);
  doc.text((headerInfo.advanceFromCompany || 0).toFixed(2), rightX + 74, y + 3.2, { align: 'right' });

  y += 4.5;

  // Row 3: Bank Balance / previous bal
  doc.rect(midX, y, 80, 4.5);
  doc.text('Date', midX + 2, y + 3.2);

  doc.rect(rightX, y, 40, 4.5);
  doc.text('Bank Balance  / previous bal', rightX + 2, y + 3.2);

  doc.rect(rightX + 40, y, 36, 4.5);
  doc.text((headerInfo.previousBalance || 0).toFixed(2), rightX + 74, y + 3.2, { align: 'right' });

  y += 4.5;

  // Row 4: No. of attachments / Cash in hand
  doc.rect(midX, y, 80, 4.5);
  doc.text('No. of attachments', midX + 2, y + 3.2);

  doc.rect(rightX, y, 40, 4.5);
  doc.text('Cash in hand', rightX + 2, y + 3.2);

  doc.rect(rightX + 40, y, 36, 4.5);
  doc.text((headerInfo.cashInHand || 0).toFixed(2), rightX + 74, y + 3.2, { align: 'right' });

  y += 7;

  // -------------------------------------------------------------
  // 6. EXACT SIGNATURES SECTION (With Original Blue Hand Signature)
  // -------------------------------------------------------------
  const sigColW = (pageWidth - margin * 2) / 3; // ~92mm each

  // Box 1: Employee
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

  // Box 2: Approver (With Original Blue Leela Signature Image)
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
    doc.addImage(LEELA_SIGNATURE_BASE64, 'JPEG', appX + 28, y + 5, 24, 8);
  } catch (e) {
    console.error('Error rendering signature:', e);
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
 * Generates the Compiled Bills PDF attached with original bill photos
 */
export async function generateCompiledBillsPdf(
  headerInfo: CompanyHeaderInfo,
  expenses: ExpenseItem[]
): Promise<{ pdfBlob: Blob; fileName: string; base64: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const formattedDate = formatDateForFileName(headerInfo.dateSubmitted);
  const fileName = `Shoeb_SUNDRY EXPENSES_ ${formattedDate}_Compiled_Bills.pdf`;

  expenses.forEach((item, idx) => {
    if (idx > 0) doc.addPage();

    // Page Header Banner (Cyan & Yellow matching AIMS)
    doc.setFillColor(0, 163, 224);
    doc.rect(10, 10, 190, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`ATTACHED BILL RECEIPT #${idx + 1} - ${item.description.toUpperCase()}`, 105, 16.5, { align: 'center' });

    // Item Metadata Box
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);
    doc.rect(10, 22, 190, 18, 'FD');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Date of Expense:`, 14, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(item.date, 40, 28);

    doc.setFont('helvetica', 'bold');
    doc.text(`Job No:`, 75, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(item.jobNo, 90, 28);

    doc.setFont('helvetica', 'bold');
    doc.text(`Category:`, 125, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(item.category, 142, 28);

    doc.setFont('helvetica', 'bold');
    doc.text(`Amount:`, 14, 35);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 102, 255);
    doc.text(`SAR ${item.amount.toFixed(2)}`, 28, 35);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Company:`, 75, 35);
    doc.setFont('helvetica', 'normal');
    doc.text('HADAF AL AIMS TRADING CO.', 92, 35);

    // Embed Original Bill Photo or Sample Real Bill Image
    const imageSrc = item.receiptImage || SAMPLE_RECEIPT_BASE64;

    try {
      doc.addImage(imageSrc, 'JPEG', 12, 43, 186, 240, undefined, 'FAST');
    } catch (err) {
      console.error('Error adding bill image:', err);
    }
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  const base64 = doc.output('datauristring').split(',')[1];

  return {
    pdfBlob,
    fileName,
    base64
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
