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
  const formattedDate = formatDateForFileName(headerInfo.dateSubmitted);
  const fileName = `Shoeb_SUNDRY EXPENSES_ ${formattedDate}_SAR ${Math.round(grandTotal)}.pdf`;

  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const margin = 12;
  let y = 12;

  // -------------------------------------------------------------
  // 1. TOP BANNER & AIMS LOGO
  // -------------------------------------------------------------
  doc.setFillColor(15, 44, 89); // Deep Navy #0F2C59
  doc.rect(margin, y, pageWidth - margin * 2, 16, 'F');
  
  // AIMS Logo Badge on Left
  doc.setFillColor(212, 175, 55); // Gold Accent #D4AF37
  doc.roundedRect(margin + 4, y + 2.5, 16, 11, 2, 2, 'F');
  doc.setTextColor(15, 44, 89);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AIMS', margin + 12, y + 9.5, { align: 'center' });

  // Company Name & Form Title Center Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('HADAF AL AIMS TRADING CO.', pageWidth / 2 + 5, y + 6.5, { align: 'center' });
  
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('AIMS - F2 FORM (SAUDI RIYALS)', pageWidth / 2 + 5, y + 12.5, { align: 'center' });

  y += 20;

  // -------------------------------------------------------------
  // 2. EMPLOYEE & FORM METADATA BOX
  // -------------------------------------------------------------
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225); // Light Gray
  doc.setFillColor(248, 250, 252); // White-slate #F8FAFC
  doc.rect(margin, y, pageWidth - margin * 2, 22, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.text('Family Name:', margin + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', margin + 26, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Badge No.:', margin + 95, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.badgeNo || 'xx', margin + 115, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 190, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.dateSubmitted || '2026-06-27', margin + 202, y + 5.5);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.text('Place / Site:', margin + 4, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.placeSite || 'KSA', margin + 26, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Title / Role:', margin + 95, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text('Director BU', margin + 115, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('Currency:', margin + 190, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.currency || 'SAR', margin + 208, y + 11);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.text('Expense Type:', margin + 4, y + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.text(headerInfo.expenseTypeSummary || 'Sundry expenses April, May, June 2026', margin + 26, y + 16.5);

  y += 26;

  // -------------------------------------------------------------
  // 3. TABLE HEADERS
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 4. TABLE ROWS
  // -------------------------------------------------------------
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
    if (idx % 2 === 1) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, pageWidth - margin, y + 7);

    if (categorySums[item.category] !== undefined) {
      categorySums[item.category] += item.amount;
    } else {
      categorySums['Sundry Consumable'] += item.amount;
    }

    let rx = margin;

    // Date
    doc.text(item.date || '-', rx + 2, y + 4.5);
    rx += columns[0].width;

    // Description
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

  // -------------------------------------------------------------
  // 5. TOTALS ROW
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 6. SUMMARY & SIGNATURE BLOCK (FIXED WHITE BACKGROUND)
  // -------------------------------------------------------------
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225);
  
  // Left Box: Financial Summary (White Background)
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, 100, 30, 'FD');
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', margin + 4, y + 7);
  doc.text(`SAR ${grandTotal.toFixed(2)}`, margin + 55, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.text('Advance from Company:', margin + 4, y + 13);
  doc.text(`SAR ${(headerInfo.advanceFromCompany || 0).toFixed(2)}`, margin + 55, y + 13);

  doc.text('Bank Balance / Prev. Bal:', margin + 4, y + 19);
  doc.text(`SAR ${(headerInfo.previousBalance || 0).toFixed(2)}`, margin + 55, y + 19);

  doc.text('No. of attachments:', margin + 4, y + 25);
  const attachmentCount = expenses.length;
  doc.text(`${attachmentCount} Bills`, margin + 55, y + 25);

  // Right Box: SIGNATURES BLOCK (White Background)
  const sigX = margin + 106;
  const sigWidth = pageWidth - margin - sigX;

  doc.setFillColor(255, 255, 255);
  doc.rect(sigX, y, sigWidth, 30, 'FD');

  const colW = sigWidth / 3;

  // Column 1: Submitted By (Employee)
  doc.setTextColor(15, 44, 89);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SUBMITTED BY:', sigX + 4, y + 6.5);
  
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(headerInfo.employeeName || 'Shoeb Ali Khan', sigX + 4, y + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${headerInfo.dateSubmitted}`, sigX + 4, y + 18);
  doc.text('Signature: ________________', sigX + 4, y + 25);

  // Divider Line 1
  doc.setDrawColor(226, 232, 240);
  doc.line(sigX + colW, y + 2, sigX + colW, y + 28);

  // Column 2: Approved By (Approver)
  doc.setTextColor(15, 44, 89);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('APPROVED BY:', sigX + colW + 4, y + 6.5);
  
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(headerInfo.approverName || 'Leela Venkat', sigX + colW + 4, y + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Date: ${headerInfo.dateSubmitted}`, sigX + colW + 4, y + 18);
  doc.text('Signature: ________________', sigX + colW + 4, y + 25);

  // Divider Line 2
  doc.line(sigX + colW * 2, y + 2, sigX + colW * 2, y + 28);

  // Column 3: Cost Controller (Finance)
  doc.setTextColor(15, 44, 89);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('COST CONTROLLER:', sigX + colW * 2 + 4, y + 6.5);
  
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Finance Dept.', sigX + colW * 2 + 4, y + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Date: ____________', sigX + colW * 2 + 4, y + 18);
  doc.text('Signature: ________________', sigX + colW * 2 + 4, y + 25);

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
 * Generates the Compiled Bills PDF containing all uploaded receipt images (with fallback canvas generator for sample receipts)
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

    // Page Header Banner
    doc.setFillColor(15, 44, 89);
    doc.rect(10, 10, 190, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`ATTACHED BILL RECEIPT #${idx + 1} - ${item.description.toUpperCase()}`, 105, 17.5, { align: 'center' });

    // Item Metadata Box
    doc.setLineWidth(0.3);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 24, 190, 18, 'FD');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Date of Expense:`, 15, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(item.date, 42, 30);

    doc.setFont('helvetica', 'bold');
    doc.text(`Job No:`, 80, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(item.jobNo, 95, 30);

    doc.setFont('helvetica', 'bold');
    doc.text(`Category:`, 130, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(item.category, 147, 30);

    doc.setFont('helvetica', 'bold');
    doc.text(`Amount:`, 15, 37);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 44, 89);
    doc.text(`SAR ${item.amount.toFixed(2)}`, 30, 37);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(`Company:`, 80, 37);
    doc.setFont('helvetica', 'normal');
    doc.text('HADAF AL AIMS TRADING CO.', 97, 37);

    // Embed Image or Render Styled Receipt Card
    const imageSrc = item.receiptImage || generateReceiptCardCanvas(item);

    try {
      doc.addImage(imageSrc, 'JPEG', 15, 46, 180, 225, undefined, 'FAST');
    } catch (err) {
      console.error('Error embedding receipt image in PDF:', err);
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 46, 180, 120, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(10);
      doc.text('Bill Receipt Graphic Document Attached', 105, 100, { align: 'center' });
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

/**
 * Creates a clean receipt card graphic canvas for bill compilation when image is loaded
 */
function generateReceiptCardCanvas(item: ExpenseItem): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 800, 1000);

  // Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 760, 960);

  // Receipt Header
  ctx.fillStyle = '#0f2c59';
  ctx.fillRect(40, 40, 720, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HADAF AL AIMS TRADING CO.', 400, 90);
  ctx.font = '20px sans-serif';
  ctx.fillText('OFFICIAL BILL RECEIPT VOUCHER', 400, 130);

  // Details Box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 200, 720, 720);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(40, 200, 720, 720);

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';

  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Receipt Details:', 70, 260);

  ctx.font = '20px sans-serif';
  ctx.fillText(`Description: ${item.description}`, 70, 320);
  ctx.fillText(`Date of Expense: ${item.date}`, 70, 380);
  ctx.fillText(`Job Number: ${item.jobNo}`, 70, 440);
  ctx.fillText(`Expense Category: ${item.category}`, 70, 500);

  // Total Box
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(70, 560, 660, 140);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(70, 560, 660, 140);

  ctx.fillStyle = '#0f2c59';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Total SAR Amount Paid:', 100, 620);

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(`SAR ${item.amount.toFixed(2)}`, 100, 675);

  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 18px sans-serif';
  ctx.fillText('Verified for HADAF AL AIMS TRADING CO. F2 Expense Submission', 70, 840);

  return canvas.toDataURL('image/jpeg', 0.9);
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
