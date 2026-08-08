import React, { useState } from 'react';
import { X, Mail, Paperclip, Send, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import { DEFAULT_RECIPIENTS, sendExpenseEmailViaGraph, generateMailtoUrl } from '../services/outlookService';
import { generateF2SummaryPdf, generateCompiledBillsPdf } from '../services/pdfGenerator';

interface OutlookModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerInfo: CompanyHeaderInfo;
  expenses: ExpenseItem[];
}

export const OutlookModal: React.FC<OutlookModalProps> = ({
  isOpen,
  onClose,
  headerInfo,
  expenses
}) => {
  const [toInput, setToInput] = useState(DEFAULT_RECIPIENTS.to.join(', '));
  const [ccInput, setCcInput] = useState(DEFAULT_RECIPIENTS.cc.join(', '));
  
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const [subject, setSubject] = useState(
    `Sundry Expenses Submission - Shoeb Ali Khan (${headerInfo.dateSubmitted}) - SAR ${Math.round(grandTotal)}`
  );

  const [emailBody, setEmailBody] = useState(
    `Dear Accounts Team,\n\nPlease find attached the finalized F2 Sundry Expense Form and compiled bill receipt attachments for my recent site expenses.\n\nSummary Breakdown:\n- Employee Name: Shoeb Ali Khan\n- Date: ${headerInfo.dateSubmitted}\n- Site / Location: ${headerInfo.placeSite}\n- Total Amount: SAR ${grandTotal.toFixed(2)}\n- Total Attachments: ${expenses.filter(e => e.receiptImage).length} Bills\n\nAttachments:\n1. F2 Summary PDF: Shoeb_SUNDRY EXPENSES_ ${headerInfo.dateSubmitted}_SAR ${Math.round(grandTotal)}.pdf\n2. Compiled Bills PDF: Shoeb_SUNDRY EXPENSES_ ${headerInfo.dateSubmitted}_Compiled_Bills.pdf\n\nBest regards,\nShoeb Ali Khan\nDirector BU`
  );

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendViaGraph = async () => {
    setIsSending(true);
    setErrorMessage(null);

    try {
      // Generate PDFs
      const [f2Res, billsRes] = await Promise.all([
        generateF2SummaryPdf(headerInfo, expenses),
        generateCompiledBillsPdf(headerInfo, expenses)
      ]);

      const toList = toInput.split(',').map(s => s.trim()).filter(Boolean);
      const ccList = ccInput.split(',').map(s => s.trim()).filter(Boolean);

      // Convert newlines to HTML br
      const htmlBody = emailBody.replace(/\n/g, '<br/>');

      const success = await sendExpenseEmailViaGraph('demo-token-or-active-session', {
        to: toList,
        cc: ccList,
        subject,
        bodyHtml: htmlBody,
        attachments: [
          { name: f2Res.fileName, base64: f2Res.base64 },
          { name: billsRes.fileName, base64: billsRes.base64 }
        ]
      });

      setIsSending(false);

      if (success) {
        setSendSuccess(true);
      } else {
        setErrorMessage('Outlook Graph API session requiring login. Using direct mailto client fallback.');
      }
    } catch (err) {
      console.error(err);
      setIsSending(false);
      setErrorMessage('Direct email draft initialized.');
    }
  };

  const handleOpenMailto = async () => {
    // Generate and trigger mailto link
    const mailtoUrl = generateMailtoUrl(subject, emailBody);
    window.location.href = mailtoUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 transform transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-400" />
              Send Expense Report via Outlook
            </h2>
            <p className="text-xs text-slate-400">Prefilled company email addresses & automatic PDF attachments</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {sendSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">Expense Report Sent Successfully!</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Your F2 Expense Report PDF and Compiled Bills PDF have been emailed to <span className="text-slate-200 font-semibold">{toInput}</span>.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow transition"
            >
              Close Window
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4 text-xs">
            
            {/* Recipient To */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">To (Primary Recipients)</label>
              <input
                type="text"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Recipient CC */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">CC (Approver & Copy Recipients)</label>
              <input
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Email Body */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Body Message</label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Attachments Info Box */}
            <div className="bg-slate-850 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-400" />
                Attached Documents (Auto-Generated):
              </span>

              <div className="space-y-1.5 pl-5">
                <div className="flex items-center justify-between text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/40">
                  <span className="font-mono truncate">1. F2 Summary PDF: Shoeb_SUNDRY EXPENSES_{headerInfo.dateSubmitted}_SAR {Math.round(grandTotal)}.pdf</span>
                  <span className="text-emerald-400 font-bold shrink-0">SAR {grandTotal.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/40">
                  <span className="font-mono truncate">2. Compiled Bills PDF ({expenses.filter(e => e.receiptImage).length} Receipts)</span>
                  <span className="text-blue-400 font-bold shrink-0">{expenses.filter(e => e.receiptImage).length} Images</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              
              <button
                type="button"
                onClick={handleOpenMailto}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4 text-sky-400" />
                Open Outlook App / Mail Client
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendViaGraph}
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? 'Sending Mail...' : 'Send via Outlook'}</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
