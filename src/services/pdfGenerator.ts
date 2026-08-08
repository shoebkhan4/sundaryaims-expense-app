import jsPDF from 'jspdf';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';

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

  // Formatting date string for filename e.g. "27- June 26" or "08- Aug 2026"
  const formattedDate = formatDateForFileName(headerInfo.dateSubmitted);
  const fileName = `Shoeb_SUNDRY EXPENSES_ ${formattedDate}_SAR ${Math.round(grandTotal)}.pdf`;

  // --- STYLING CONSTANTS ---
  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const margin = 12;
  let y = 14;

  // 1. HEADER TITLE BANNER
  doc.setFillColor(15, 44, 89); // Deep Navy #0F2C59
  doc.rect(margin, y, pageWidth - margin * 2, 14, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HADAF AL AIMS TRADING CO.', pageWidth / 2, y + 6, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AIMS - F2 FORM (SAUDI RIYALS)', pageWidth / 2, y + 11, { align: 'center' });

  y += 18;

  // 2. EMPLOYEE & FORM METADATA BOX
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, pageWidth - margin * 2, 22, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.text('Family Name:', margin + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', margin + 25, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Badge No.:', margin + 85, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.badgeNo || 'xx', margin + 105, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 180, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.dateSubmitted || new Date().toISOString().split('T')[0], margin + 192, y + 5);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.text('Place / Site:', margin + 3, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.placeSite || 'KSA', margin + 25, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Title / Role:', margin + 85, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('Director BU', margin + 105, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Currency:', margin + 180, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.currency || 'SAR', margin + 198, y + 10);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Type:', margin + 3, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.expenseTypeSummary || 'Sundry Expenses', margin + 25, y + 16);

  y += 26;

  // 3. TABLE HEADERS
  const columns = [
    { header: 'Date', width: 22 },
    { header: 'Description', width: 75 },
    { header: 'Job No.', width: 22 },
    { header: 'Fuel / Water', width: 26 },
    { header: 'Office Repair', width: 26 },
    { header: 'Spot Rental', width: 25 },
    { header: 'Tools & Equpt', width: 26 },
    { header: 'Consumables', width: 25 },
    { header: 'Total (SAR)', width: 20 }
  ];

  doc.setFillColor(15, 44, 89);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  let currentX = margin;
  columns.forEach(col => {
    doc.text(col.header, currentX + col.width / 2, y + 5.5, { align: 'center' });
    currentX += col.width;
  });

  y += 8;

  // 4. TABLE ROWS
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  const categorySums: Record<string, number> = {
    'Electricity water fuel': 0,
    'Site Office small repair': 0,
    'Spot rental equpt': 0,
    'Site Tools equpt': 0,
    'Sundry Consumable': 0
  };

  expenses.forEach((item, idx) => {
    // Row background toggle
    if (idx % 2 === 1) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    // Track category sums
    if (categorySums[item.category] !== undefined) {
      categorySums[item.category] += item.amount;
    } else {
      categorySums['Sundry Consumable'] += item.amount;
    }

    let rx = margin;

    // Date
    doc.text(item.date || '-', rx + 2, y + 4.5);
    rx += columns[0].width;

    // Description (truncate if long)
    const descText = item.description.length > 45 ? item.description.substring(0, 43) + '...' : item.description;
    doc.text(descText, rx + 2, y + 4.5);
    rx += columns[1].width;

    // Job No
    doc.text(item.jobNo || '-', rx + 2, y + 4.5);
    rx += columns[2].width;

    // Category Amounts
    const isFuel = item.category === 'Electricity water fuel';
    const isRepair = item.category === 'Site Office small repair';
    const isRental = item.category === 'Spot rental equpt';
    const isTools = item.category === 'Site Tools equpt';
    const isConsumable = item.category === 'Sundry Consumable' || item.category === 'Other';

    doc.text(isFuel ? item.amount.toFixed(2) : '-', rx + columns[3].width / 2, y + 4.5, { align: 'center' });
    rx += columns[3].width;

    doc.text(isRepair ? item.amount.toFixed(2) : '-', rx + columns[4].width / 2, y + 4.5, { align: 'center' });
    rx += columns[4].width;

    doc.text(isRental ? item.amount.toFixed(2) : '-', rx + columns[5].width / 2, y + 4.5, { align: 'center' });
    rx += columns[5].width;

    doc.text(isTools ? item.amount.toFixed(2) : '-', rx + columns[6].width / 2, y + 4.5, { align: 'center' });
    rx += columns[6].width;

    doc.text(isConsumable ? item.amount.toFixed(2) : '-', rx + columns[7].width / 2, y + 4.5, { align: 'center' });
    rx += columns[7].width;

    // Total Amount
    doc.setFont('helvetica', 'bold');
    doc.text(item.amount.toFixed(2), rx + columns[8].width - 2, y + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    y += 7;
  });

  // 5. TOTALS ROW
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL / SUB-TOTALS', margin + 5, y + 5.5);

  let tx = margin + columns[0].width + columns[1].width + columns[2].width;
  doc.text(categorySums['Electricity water fuel'].toFixed(2), tx + columns[3].width / 2, y + 5.5, { align: 'center' });
  tx += columns[3].width;

  doc.text(categorySums['Site Office small repair'].toFixed(2), tx + columns[4].width / 2, y + 5.5, { align: 'center' });
  tx += columns[4].width;

  doc.text(categorySums['Spot rental equpt'].toFixed(2), tx + columns[5].width / 2, y + 5.5, { align: 'center' });
  tx += columns[5].width;

  doc.text(categorySums['Site Tools equpt'].toFixed(2), tx + columns[6].width / 2, y + 5.5, { align: 'center' });
  tx += columns[6].width;

  doc.text(categorySums['Sundry Consumable'].toFixed(2), tx + columns[7].width / 2, y + 5.5, { align: 'center' });
  tx += columns[7].width;

  doc.setTextColor(15, 44, 89);
  doc.setFontSize(8.5);
  doc.text(`SAR ${grandTotal.toFixed(2)}`, tx + columns[8].width - 2, y + 5.5, { align: 'right' });

  y += 14;

  // 6. SUMMARY & SIGNATURE BLOCK
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  
  // Left Box: Financial Summary
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, 100, 28, 'FD');
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', margin + 3, y + 6);
  doc.text(`SAR ${grandTotal.toFixed(2)}`, margin + 55, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.text('Advance from Company:', margin + 3, y + 12);
  doc.text(`SAR ${headerInfo.advanceFromCompany || '0.00'}`, margin + 55, y + 12);

  doc.text('Bank Balance / Prev. Bal:', margin + 3, y + 18);
  doc.text(`SAR ${headerInfo.previousBalance || '0.00'}`, margin + 55, y + 18);

  doc.text('No. of attachments:', margin + 3, y + 24);
  const attachmentCount = expenses.filter(e => e.receiptImage).length;
  doc.text(`${attachmentCount} Bills`, margin + 55, y + 24);

  // Right Box: Signatures
  const sigX = margin + 110;
  const sigWidth = pageWidth - margin - sigX;
  doc.rect(sigX, y, sigWidth, 28, 'FD');

  const colW = sigWidth / 3;

  // Employee Signature
  doc.setFont('helvetica', 'bold');
  doc.text('Submitted By:', sigX + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', sigX + 3, y + 12);
  doc.text(`Date: ${headerInfo.dateSubmitted}`, sigX + 3, y + 18);
  doc.text('Signature: ____________', sigX + 3, y + 24);

  // Approver Signature
  doc.setFont('helvetica', 'bold');
  doc.text('Approved By:', sigX + colW + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.approverName || 'Leela Venkat', sigX + colW + 3, y + 12);
  doc.text(`Date: ${headerInfo.dateSubmitted}`, sigX + colW + 3, y + 18);
  doc.text('Signature: ____________', sigX + colW + 3, y + 24);

  // Cost Controller
  doc.setFont('helvetica', 'bold');
  doc.text('Cost Controller:', sigX + colW * 2 + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('Finance Dept', sigX + colW * 2 + 3, y + 12);
  doc.text('Date: ____________', sigX + colW * 2 + 3, y + 18);
  doc.text('Signature: ____________', sigX + colW * 2 + 3, y + 24);

  // Generate output blob and base64
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
 * Generates the Compiled Bills PDF containing all uploaded receipt images
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

  const itemsWithReceipts = expenses.filter(e => e.receiptImage);

  if (itemsWithReceipts.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('No Bill Images Attached', 105, 40, { align: 'center' });
  } else {
    for (let i = 0; i < itemsWithReceipts.length; i++) {
      const item = itemsWithReceipts[i];
      if (i > 0) doc.addPage();

      // Page Header
      doc.setFillColor(15, 44, 89);
      doc.rect(10, 10, 190, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`ATTACHED RECEIPT #${i + 1} - ${item.description.toUpperCase()}`, 105, 18, { align: 'center' });

      // Receipt Metadata Banner
      doc.setFillColor(241, 245, 249);
      doc.rect(10, 24, 190, 16, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.text(`Date: ${item.date}`, 15, 30);
      doc.text(`Job No: ${item.jobNo}`, 70, 30);
      doc.text(`Category: ${item.category}`, 125, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(`Amount: SAR ${item.amount.toFixed(2)}`, 15, 36);

      // Embed Image
      if (item.receiptImage) {
        try {
          doc.addImage(item.receiptImage, 'JPEG', 15, 45, 180, 220, undefined, 'FAST');
        } catch (err) {
          console.error('Error adding image to PDF:', err);
          doc.setTextColor(220, 38, 38);
          doc.text('Unable to render image preview in PDF', 105, 80, { align: 'center' });
        }
      }
    }
  }

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
  if (!dateStr) return '08- Aug 2026';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}- ${month} ${year}`;
  } catch {
    return '08- Aug 2026';
  }
}
