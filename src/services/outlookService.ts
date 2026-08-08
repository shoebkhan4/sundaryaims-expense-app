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

// MSAL Configuration
const msalConfig: Configuration = {
  auth: {
    clientId: '00000000-0000-0000-0000-000000000000',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  }
};

let msalInstance: PublicClientApplication | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
}

export async function loginOutlook(): Promise<string | null> {
  try {
    const msal = await getMsalInstance();
    const loginResponse = await msal.loginPopup({
      scopes: ['User.Read', 'Mail.Read', 'Mail.Send']
    });
    return loginResponse.accessToken;
  } catch (err) {
    console.error('MSAL Login error:', err);
    return null;
  }
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
  try {
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

    await client.api('/me/sendMail').post({ message, saveToSentItems: true });
    return true;
  } catch (err) {
    console.error('Failed to send mail via Outlook Graph API:', err);
    return false;
  }
}

export function generateMailtoUrl(subject: string, body: string): string {
  const toStr = DEFAULT_RECIPIENTS.to.join(',');
  const ccStr = DEFAULT_RECIPIENTS.cc.join(',');
  return `mailto:${toStr}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
