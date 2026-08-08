import { PublicClientApplication, Configuration } from '@azure/msal-browser';
import { Client } from '@microsoft/microsoft-graph-client';
import { OutlookSubmission } from '../types/expense';

export const DEFAULT_RECIPIENTS = {
  to: ['accounts-saudi@aimsgt.com'],
  cc: [
    'ziauddin@aimsgt.com',
    'ksa-service@aimsgt.com',
    'leela@aimsgt.com',
    'Maaz@aimsgt.com'
  ]
};

// Default MSAL Config (User can override Client ID if needed)
const msalConfig: Configuration = {
  auth: {
    clientId: '00000000-0000-0000-0000-000000000000', // Placeholder or user-configured Azure Client ID
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

/**
 * Scans sent items in Outlook for the last 2-3 months matching expense submissions
 */
export async function fetchSentExpenseEmails(accessToken?: string): Promise<OutlookSubmission[]> {
  if (!accessToken) {
    // Return sample historical baseline if unauthenticated
    return [
      {
        id: '1',
        subject: 'Sundry expenses June 2026 - Shoeb Ali Khan',
        sentDateTime: '2026-06-27T10:30:00Z',
        recipients: DEFAULT_RECIPIENTS.to,
        hasAttachments: true,
        pdfAttachments: [
          { name: 'Shoeb_SUNDRY EXPENSES_ 27- June 26_SAR 1245.pdf', size: 218363, contentType: 'application/pdf' }
        ]
      },
      {
        id: '2',
        subject: 'Sundry expenses April 2026 - Shoeb Ali Khan',
        sentDateTime: '2026-04-11T09:15:00Z',
        recipients: DEFAULT_RECIPIENTS.to,
        hasAttachments: true,
        pdfAttachments: [
          { name: 'Shoeb_SUNDRY EXPENSES_ 11- April 26_SAR 2157.pdf', size: 224298, contentType: 'application/pdf' }
        ]
      },
      {
        id: '3',
        subject: 'Sundry expenses March 2026 - Shoeb Ali Khan',
        sentDateTime: '2026-03-18T11:00:00Z',
        recipients: DEFAULT_RECIPIENTS.to,
        hasAttachments: true,
        pdfAttachments: [
          { name: 'Shoeb_SUNDRY EXPENSES_ 18- March 26_SAR 5359.pdf', size: 210938, contentType: 'application/pdf' }
        ]
      }
    ];
  }

  try {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken)
    });

    // Query messages sent in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const filterDate = ninetyDaysAgo.toISOString();

    const response = await client
      .api('/me/mailFolders/sentitems/messages')
      .filter(`sentDateTime ge ${filterDate} and (contains(subject, 'SUNDRY') or contains(subject, 'Expense'))`)
      .select('id,subject,sentDateTime,toRecipients,hasAttachments')
      .top(15)
      .get();

    const submissions: OutlookSubmission[] = [];

    for (const msg of response.value || []) {
      submissions.push({
        id: msg.id,
        subject: msg.subject,
        sentDateTime: msg.sentDateTime,
        recipients: (msg.toRecipients || []).map((r: any) => r.emailAddress.address),
        hasAttachments: msg.hasAttachments,
        pdfAttachments: []
      });
    }

    return submissions;
  } catch (err) {
    console.error('Error querying Outlook Sent Items:', err);
    return [];
  }
}

/**
 * Sends the expense email with PDF attachments via Microsoft Graph API
 */
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

/**
 * Prepares mailto fallback link with prefilled recipients, subject & body
 */
export function generateMailtoUrl(subject: string, body: string): string {
  const toStr = DEFAULT_RECIPIENTS.to.join(',');
  const ccStr = DEFAULT_RECIPIENTS.cc.join(',');
  return `mailto:${toStr}?cc=${encodeURIComponent(ccStr)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
