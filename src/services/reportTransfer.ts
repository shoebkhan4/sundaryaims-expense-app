import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import { hydrateReceiptImages } from './expenseStorage';

/* ------------------------------------------------------------------ *
 * Temporary: moving the current report to the AIMS Expense Portal
 *
 * Browsers keep each website's saved data apart, so the portal at
 * expenses.aimsserver.com cannot read what this app saved. This writes the
 * report — header, rows and bill images — into one file the portal's
 * "Import a report" reads. Remove once the report has been moved.
 * ------------------------------------------------------------------ */

export const TRANSFER_KIND = 'aims-expense-report';

export interface TransferFile {
  kind: typeof TRANSFER_KIND;
  version: 1;
  exportedAt: string;
  headerInfo: CompanyHeaderInfo;
  titleManual: boolean;
  /** Rows with their bill images as data URLs. */
  expenses: ExpenseItem[];
}

export async function buildTransferFile(
  headerInfo: CompanyHeaderInfo,
  expenses: ExpenseItem[],
  titleManual: boolean
): Promise<TransferFile> {
  return {
    kind: TRANSFER_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    headerInfo,
    titleManual,
    // The images may still be loading from IndexedDB; read any that are missing.
    expenses: await hydrateReceiptImages(expenses)
  };
}

/** Saves the file to the device (Downloads, or Files on an iPhone). */
export async function downloadTransferFile(headerInfo: CompanyHeaderInfo, expenses: ExpenseItem[], titleManual: boolean): Promise<string> {
  const file = await buildTransferFile(headerInfo, expenses, titleManual);
  const date = (headerInfo.dateSubmitted || file.exportedAt.slice(0, 10)).replace(/[^\d-]/g, '');
  const name = `AIMS report ${date} (${expenses.length} items).json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return name;
}
