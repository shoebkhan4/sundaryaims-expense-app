export type ExpenseCategory = 
  | 'Electricity water fuel'
  | 'Site Office small repair'
  | 'Spot rental equpt'
  | 'Site Tools equpt'
  | 'Sundry Consumable'
  | 'Other';

export interface ExpenseItem {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  jobNo: string;
  category: ExpenseCategory;
  amount: number;
  receiptImage?: string; // base64 or object URL
  receiptFileName?: string;
  accountCode?: string;
  finEntity?: string;
  rawOcrText?: string;
}

export interface CompanyHeaderInfo {
  companyName: string;
  formName: string;
  employeeName: string;
  badgeNo: string;
  placeSite: string;
  currency: string;
  expenseTypeSummary: string;
  approverName: string;
  dateSubmitted: string;
  advanceFromCompany: number;
  previousBalance: number;
  cashInHand: number;
}

export interface OutlookSubmission {
  id: string;
  subject: string;
  sentDateTime: string;
  recipients: string[];
  hasAttachments: boolean;
  pdfAttachments: {
    name: string;
    size: number;
    contentType: string;
  }[];
}
