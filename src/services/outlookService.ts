import { PublicClientApplication, Configuration } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';
import { OutlookSubmission, ExpenseItem, CompanyHeaderInfo } from '../types/expense';

export const DEFAULT_RECIPIENTS = {
  to: ['accounts-saudi@aimsgt.com'],
  cc: [
    'ziauddin@aimsgt.com',
    'ksa-service@aimsgt.com',
    'leela@aimsgt.com',
    'Maaz@aimsgt.com'
  ]
};

export interface PastReportRecord {
  id: string;
  periodTitle: string;
  dateSubmitted: string;
  totalAmount: number;
  pdfFileName: string;
  headerInfo: CompanyHeaderInfo;
  items: ExpenseItem[];
}

export const PAST_2026_REPORTS: PastReportRecord[] = [
  {
    // Sent 9 Aug 2026 on the "Petty expenses summary sheet." thread, SAR 1393,
    // with no previous balance outstanding.
    id: 'report-august-2026',
    periodTitle: 'Sundry expenses July 2026',
    dateSubmitted: '2026-08-08',
    totalAmount: 1393,
    pdfFileName: 'Shoeb_SUNDRY EXPENSES_ 08- Aug-2026_SAR1393.pdf',
    headerInfo: {
      companyName: 'HADAF AL AIMS TRADING CO.',
      formName: 'AIMS F2 FORM (SAUDI RIYALS)',
      employeeName: 'Shoeb Ali Khan',
      badgeNo: 'xx',
      placeSite: 'KSA',
      currency: 'SAR',
      expenseTypeSummary: 'Sundry expenses July 2026',
      approverName: 'Leela Venkat',
      dateSubmitted: '2026-08-08',
      advanceFromCompany: 0,
      previousBalance: 0,
      cashInHand: 0
    },
    items: []
  },
  {
    id: 'report-june-2026',
    periodTitle: 'Sundry expenses April, May, June 2026',
    dateSubmitted: '2026-06-27',
    totalAmount: 1245.90,
    pdfFileName: 'Shoeb_SUNDRY EXPENSES_ 27- June 26_SAR 1245.pdf',
    headerInfo: {
      companyName: 'HADAF AL AIMS TRADING CO.',
      formName: 'AIMS F2 FORM (SAUDI RIYALS)',
      employeeName: 'Shoeb Ali Khan',
      badgeNo: 'xx',
      placeSite: 'KSA',
      currency: 'SAR',
      expenseTypeSummary: 'Sundry expenses April, May, June 2026',
      approverName: 'Leela Venkat',
      dateSubmitted: '2026-06-27',
      advanceFromCompany: 0,
      previousBalance: 0,
      cashInHand: 0
    },
    items: [
      { id: 'jun-1', date: '2026-06-27', description: 'Site Fuel -FGP (6 Visit)', jobNo: '12918', category: 'Electricity water fuel', amount: 430.50 },
      { id: 'jun-2', date: '2026-06-27', description: 'Site Food-FGP (6 Visit)-5 Person', jobNo: '12918', category: 'Sundry Consumable', amount: 508.00 },
      { id: 'jun-3', date: '2026-06-27', description: 'AI Subscription Bills', jobNo: '-', category: 'Sundry Consumable', amount: 257.40 },
      { id: 'jun-4', date: '2026-06-27', description: 'Material (Special cable)', jobNo: '12918', category: 'Site Tools equpt', amount: 50.00 }
    ]
  },
  {
    id: 'report-april-2026',
    periodTitle: 'Sundry expenses April 2026',
    dateSubmitted: '2026-04-11',
    totalAmount: 2157.81,
    pdfFileName: 'Shoeb_SUNDRY EXPENSES_ 11- April 26_SAR 2157.pdf',
    headerInfo: {
      companyName: 'HADAF AL AIMS TRADING CO.',
      formName: 'AIMS F2 FORM (SAUDI RIYALS)',
      employeeName: 'Shoeb Ali Khan',
      badgeNo: 'xx',
      placeSite: 'KSA',
      currency: 'SAR',
      expenseTypeSummary: 'Sundry expenses April 2026',
      approverName: 'Leela Venkat',
      dateSubmitted: '2026-04-11',
      advanceFromCompany: 0,
      previousBalance: 0,
      cashInHand: 0
    },
    items: [
      { id: 'apr-1', date: '2026-04-11', description: 'Site Fuel -FGP (2 Visit)', jobNo: '2025-11', category: 'Electricity water fuel', amount: 120.00 },
      { id: 'apr-2', date: '2026-04-11', description: 'Site Food-FGP (2 Visit)-2 Person', jobNo: '2025-11', category: 'Sundry Consumable', amount: 77.00 },
      { id: 'apr-3', date: '2026-04-11', description: 'AI Subscription Bills', jobNo: '-', category: 'Sundry Consumable', amount: 218.40 },
      { id: 'apr-4', date: '2026-04-11', description: 'PCB Prototype Manufacturing by China Vendor (Final Amount)', jobNo: '14983', category: 'Site Tools equpt', amount: 1742.41 }
    ]
  },
  {
    id: 'report-march-2026',
    periodTitle: 'Sundry expenses March 2026',
    dateSubmitted: '2026-03-18',
    totalAmount: 5359.97,
    pdfFileName: 'Shoeb_SUNDRY EXPENSES_ 18- March 26_SAR 5359.pdf',
    headerInfo: {
      companyName: 'HADAF AL AIMS TRADING CO.',
      formName: 'AIMS F2 FORM (SAUDI RIYALS)',
      employeeName: 'Shoeb Ali Khan',
      badgeNo: 'xx',
      placeSite: 'KSA',
      currency: 'SAR',
      expenseTypeSummary: 'Sundry expenses March 2026',
      approverName: 'Leela Venkat',
      dateSubmitted: '2026-03-18',
      advanceFromCompany: 0,
      previousBalance: 0,
      cashInHand: 0
    },
    items: [
      { id: 'mar-1', date: '2026-03-18', description: 'Site Fuel -FGP (4 Visit)', jobNo: '2025-11', category: 'Electricity water fuel', amount: 240.00 },
      { id: 'mar-2', date: '2026-03-18', description: 'Site Food-FGP (4 Visit)', jobNo: '2025-11', category: 'Sundry Consumable', amount: 53.80 },
      { id: 'mar-3', date: '2026-03-18', description: 'AI Subscription Bills-2 months', jobNo: '-', category: 'Sundry Consumable', amount: 218.40 },
      { id: 'mar-4', date: '2026-03-18', description: 'PCB Prototype Manufacturing (Advance Payment 1200$)', jobNo: '14983', category: 'Site Tools equpt', amount: 4653.00 },
      { id: 'mar-5', date: '2026-03-18', description: 'Material Purchase Online for SSC', jobNo: '14983', category: 'Sundry Consumable', amount: 194.77 }
    ]
  },
  {
    id: 'report-feb-2026',
    periodTitle: 'Sundry expenses Jan 2026',
    dateSubmitted: '2026-02-02',
    totalAmount: 1252.78,
    pdfFileName: 'Shoeb_SUNDRY EXPENSES_ 02- Feb 26_SAR1252.pdf',
    headerInfo: {
      companyName: 'HADAF AL AIMS TRADING CO.',
      formName: 'AIMS F2 FORM (SAUDI RIYALS)',
      employeeName: 'Shoeb Ali Khan',
      badgeNo: 'xx',
      placeSite: 'KSA',
      currency: 'SAR',
      expenseTypeSummary: 'Sundry expenses Jan 2026',
      approverName: 'Leela Venkat',
      dateSubmitted: '2026-02-02',
      advanceFromCompany: 0,
      previousBalance: 0,
      cashInHand: 0
    },
    items: [
      { id: 'feb-1', date: '2026-02-02', description: 'Site Fuel -FGP (8 Visit)', jobNo: '2025-11', category: 'Electricity water fuel', amount: 470.00 },
      { id: 'feb-2', date: '2026-02-02', description: 'Site Food-FGP (8 Visit)', jobNo: '2025-11', category: 'Sundry Consumable', amount: 144.00 },
      { id: 'feb-3', date: '2026-02-02', description: 'PCB Design-Freelance Service (Milestone 3 & 4 Completed)', jobNo: '14983', category: 'Site Tools equpt', amount: 638.78 }
    ]
  }
];

/* ------------------------------------------------------------------ *
 * Signing in to the company mailbox
 *
 * A web page cannot choose which account the phone's mail app sends from —
 * that app uses its own default, which is why reports went out from a
 * personal address. The only way to send *as* the company account is to sign
 * in to it here and post the mail through Microsoft Graph.
 *
 * That needs an app registration in the aimsgt.com tenant, whose client id is
 * supplied as VITE_MS_CLIENT_ID at build time. The authority deliberately
 * defaults to "organizations", which offers work and school accounts only, so
 * a personal Microsoft account cannot be picked by mistake.
 * ------------------------------------------------------------------ */

const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID?.trim() || '';
const MS_TENANT = import.meta.env.VITE_MS_TENANT_ID?.trim() || 'organizations';
const MAIL_SCOPES = ['User.Read', 'Mail.Send'];

/** True when this build carries a company app registration. */
export function isGraphConfigured(): boolean {
  return MS_CLIENT_ID.length > 0;
}

// Built on demand rather than at import time, so this module can be loaded
// (and its pure helpers tested) without a browser window present.
function msalConfig(): Configuration {
  return {
    auth: {
      clientId: MS_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${MS_TENANT}`,
      redirectUri: window.location.origin
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false
    }
  };
}

let msalInstance: PublicClientApplication | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig());
    await msalInstance.initialize();
  }
  return msalInstance;
}

/** The signed-in company address, or null when nobody is signed in. */
export async function getSignedInAddress(): Promise<string | null> {
  if (!isGraphConfigured()) return null;
  try {
    const msal = await getMsalInstance();
    const account = msal.getAllAccounts()[0];
    return account?.username || null;
  } catch {
    return null;
  }
}

/** A token for sending, reusing the existing session when there is one. */
export async function getMailToken(interactive: boolean): Promise<string | null> {
  if (!isGraphConfigured()) return null;
  const msal = await getMsalInstance();
  const account = msal.getAllAccounts()[0];

  if (account) {
    try {
      const silent = await msal.acquireTokenSilent({ scopes: MAIL_SCOPES, account });
      if (silent.accessToken) return silent.accessToken;
    } catch {
      // The session expired; fall through to signing in again.
    }
  }

  if (!interactive) return null;
  const result = await msal.loginPopup({ scopes: MAIL_SCOPES, prompt: 'select_account' });
  return result.accessToken || null;
}

export async function signOutOutlook(): Promise<void> {
  if (!isGraphConfigured()) return;
  const msal = await getMsalInstance();
  const account = msal.getAllAccounts()[0];
  if (account) await msal.clearCache({ account });
}

export async function fetchSentExpenseEmails(accessToken?: string): Promise<OutlookSubmission[]> {
  // Returns submitted reports for 2026
  return PAST_2026_REPORTS.map(r => ({
    id: r.id,
    subject: `${r.periodTitle} - Shoeb Ali Khan`,
    sentDateTime: r.dateSubmitted,
    recipients: DEFAULT_RECIPIENTS.to,
    hasAttachments: true,
    pdfAttachments: [
      { name: r.pdfFileName, size: 215000, contentType: 'application/pdf' }
    ]
  }));
}

export async function sendExpenseEmailViaGraph(
  accessToken: string,
  params: {
    to: string[];
    cc: string[];
    subject: string;
    bodyHtml: string;
    attachments: { name: string; base64: string }[];
  }
): Promise<boolean> {
  {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken)
    });

    const message = {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.bodyHtml
      },
      toRecipients: params.to.map((email) => ({
        emailAddress: { address: email.trim() }
      })),
      ccRecipients: params.cc.map((email) => ({
        emailAddress: { address: email.trim() }
      })),
      attachments: params.attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.name,
        contentType: 'application/pdf',
        contentBytes: att.base64
      }))
    };

    // Errors are deliberately left to the caller: a send that failed used to
    // be swallowed and reported as a fallback that never happened.
    await client.api('/me/sendMail').post({ message, saveToSentItems: true });
    return true;
  }
}

/* ------------------------------------------------------------------ *
 * Handing the report to the phone's mail app
 * ------------------------------------------------------------------ */

/**
 * A mailto: link can carry recipients and text but never a file — no mail
 * client on any platform accepts attachments this way. Anything sent through
 * here has to have its PDFs added by hand.
 */
export function generateMailtoUrl(
  to: string[],
  cc: string[],
  subject: string,
  body: string
): string {
  // Each address is escaped on its own: escaping the joined string turns the
  // separating commas into %2C, which some clients read as one long address.
  const toStr = to.map(encodeURIComponent).join(',');
  const ccStr = cc.map(encodeURIComponent).join(',');
  return `mailto:${toStr}?cc=${ccStr}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/**
 * Hands both PDFs to the system share sheet, which is the one route from a web
 * page to a mail app that keeps the files attached. Picking Outlook there
 * opens a new message with both PDFs already on it.
 */
export async function shareReportFiles(
  files: File[],
  subject: string,
  body: string
): Promise<ShareOutcome> {
  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files });

  if (!canShare) return 'unsupported';

  try {
    await navigator.share({ files, title: subject, text: body });
    return 'shared';
  } catch (err) {
    // Dismissing the share sheet rejects; that is not a failure worth reporting.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

/** Saves both PDFs, so they can be attached by hand as a last resort. */
export function downloadReportFiles(files: File[]): void {
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}
