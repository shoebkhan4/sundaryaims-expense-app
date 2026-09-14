import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import {
  ARCHIVE_KEY_PREFIX,
  deleteArchivedImages,
  getArchivedImages,
  hydrateReceiptImages,
  putArchivedImage
} from './expenseStorage';

/**
 * Reports that have been filed.
 *
 * Sending a report used to leave no trace in the app: History showed a fixed
 * list, so starting the next report discarded the rows and bills outright and
 * the only surviving copy was the one in the sent mail. A saved report keeps
 * its rows in localStorage and its bills in IndexedDB, under keys prefixed so
 * that clearing the current report cannot take them with it.
 */

const ARCHIVE_KEY = 'aims_report_archive';

export interface ArchivedReport {
  id: string;
  /** When it was filed, as YYYY-MM-DD. */
  savedAt: string;
  title: string;
  dateSubmitted: string;
  totalAmount: number;
  headerInfo: CompanyHeaderInfo;
  /** Rows without their images; the bills are fetched on demand. */
  items: ExpenseItem[];
  /** Ids of the rows whose bill was stored, so a load knows what to look for. */
  imageItemIds: string[];
}

const imageKey = (reportId: string, itemId: string) => `${ARCHIVE_KEY_PREFIX}${reportId}:${itemId}`;

export function loadArchivedReports(): ArchivedReport[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedReport[];
    if (!Array.isArray(parsed)) return [];
    // Newest first, so the most recent submission is the one in reach.
    return parsed.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  } catch (e) {
    console.warn('Could not read the saved reports', e);
    return [];
  }
}

function writeArchive(reports: ArchivedReport[]): boolean {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(reports));
    return true;
  } catch (e) {
    console.warn('Could not save the report', e);
    return false;
  }
}

export interface ArchiveResult {
  ok: boolean;
  report?: ArchivedReport;
  /** How many bills could not be stored, if any. */
  imagesFailed: number;
}

/**
 * Files the current report so it survives starting the next one.
 *
 * Images are pulled from IndexedDB first: the list on screen may not carry
 * them yet, and a report saved without its bills would be worth little.
 */
export async function archiveReport(
  headerInfo: CompanyHeaderInfo,
  expenses: ExpenseItem[]
): Promise<ArchiveResult> {
  if (expenses.length === 0) return { ok: false, imagesFailed: 0 };

  const withImages = await hydrateReceiptImages(expenses);
  const id = `report-${Date.now()}`;
  const savedAt = headerInfo.dateSubmitted || new Date().toISOString().split('T')[0];

  let imagesFailed = 0;
  const imageItemIds: string[] = [];

  for (const item of withImages) {
    if (!item.receiptImage) continue;
    const stored = await putArchivedImage(imageKey(id, item.id), item.receiptImage);
    if (stored) imageItemIds.push(item.id);
    else imagesFailed++;
  }

  const report: ArchivedReport = {
    id,
    savedAt,
    title: headerInfo.expenseTypeSummary || 'Sundry expenses',
    dateSubmitted: headerInfo.dateSubmitted,
    totalAmount: withImages.reduce((sum, item) => sum + item.amount, 0),
    headerInfo,
    items: withImages.map(({ receiptImage, ...rest }) => rest as ExpenseItem),
    imageItemIds
  };

  const ok = writeArchive([report, ...loadArchivedReports()]);
  if (!ok) {
    // Do not leave bills behind for a report that was never recorded.
    await deleteArchivedImages(imageItemIds.map((itemId) => imageKey(id, itemId)));
    return { ok: false, imagesFailed };
  }

  return { ok: true, report, imagesFailed };
}

/** A saved report's rows with their bills put back. */
export async function loadArchivedReport(report: ArchivedReport): Promise<ExpenseItem[]> {
  if (report.imageItemIds.length === 0) return report.items;

  const images = await getArchivedImages(report.imageItemIds.map((itemId) => imageKey(report.id, itemId)));
  return report.items.map((item) => {
    const image = images.get(imageKey(report.id, item.id));
    return image ? { ...item, receiptImage: image } : item;
  });
}

export async function deleteArchivedReport(id: string): Promise<void> {
  const all = loadArchivedReports();
  const removed = all.find((report) => report.id === id);
  writeArchive(all.filter((report) => report.id !== id));
  if (removed) {
    await deleteArchivedImages(removed.imageItemIds.map((itemId) => imageKey(id, itemId)));
  }
}
