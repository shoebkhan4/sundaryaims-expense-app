import React, { useEffect, useState } from 'react';
import { X, Mail, Paperclip, Send, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, Share2, Download } from 'lucide-react';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import {
  DEFAULT_RECIPIENTS,
  sendExpenseEmailViaGraph,
  generateMailtoUrl,
  isGraphConfigured,
  getSignedInAddress,
  getMailToken,
  shareReportFiles,
  downloadReportFiles
} from '../services/outlookService';
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

  /**
   * These two match the mails that have actually been sent to accounts for
   * years: one long thread with this subject, and a short body whose point is
   * the running unpaid balance — the number accounts acts on. The previous
   * wording listed the attachments back at the reader and never mentioned what
   * was owed. Both stay editable here.
   */
  const [subject, setSubject] = useState('RE: Petty expenses summary sheet.');
  const [emailBody, setEmailBody] = useState('');

  // Taken from the Previous Due Balance on the form, so the two never disagree.
  const previousBalance = headerInfo.previousBalance || 0;

  /**
   * Written afresh each time the dialog opens. This component stays mounted
   * between openings, and useState initialisers only run on first mount, so
   * the body used to be built once — while the report was still empty — and
   * then quoted SAR 0 no matter what had been added since.
   */
  useEffect(() => {
    if (!isOpen) return;
    const totalUnpaid = previousBalance + grandTotal;
    const totalLine =
      previousBalance > 0
        ? `Total Unpaid: ${previousBalance.toFixed(0)}+${grandTotal.toFixed(0)}: SAR ${totalUnpaid.toFixed(0)}`
        : `Total Unpaid: SAR ${totalUnpaid.toFixed(0)}`;

    setSubject('RE: Petty expenses summary sheet.');
    setEmailBody(
      `Dear Accounts,\n\nPlease find attached last month bills.\n\nNew Expense (Unpaid): SAR ${grandTotal.toFixed(
        0
      )}\nPrevious Balance (Unpaid): SAR ${previousBalance.toFixed(0)}\n\n${totalLine}\n\nRegards,\nShoeb`
    );
  }, [isOpen, grandTotal, previousBalance]);

  const [isSending, setIsSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>('Sending Mail...');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sentFrom, setSentFrom] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  /** The company address the report will be sent as, once signed in. */
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const graphReady = isGraphConfigured();

  useEffect(() => {
    if (!isOpen || !graphReady) return;
    getSignedInAddress().then(setSignedInAs);
  }, [isOpen, graphReady]);

  if (!isOpen) return null;

  const toList = toInput.split(',').map((s) => s.trim()).filter(Boolean);
  const ccList = ccInput.split(',').map((s) => s.trim()).filter(Boolean);

  /** Both PDFs as files, ready either to attach or to share. */
  const buildReportFiles = async (): Promise<File[]> => {
    const [f2Res, billsRes] = await Promise.all([
      generateF2SummaryPdf(headerInfo, expenses),
      generateCompiledBillsPdf(headerInfo, expenses)
    ]);
    return [
      new File([f2Res.pdfBlob], f2Res.fileName, { type: 'application/pdf' }),
      new File([billsRes.pdfBlob], billsRes.fileName, { type: 'application/pdf' })
    ];
  };

  /**
   * Sends through the company mailbox itself, so the report leaves from the
   * work address rather than whatever account the phone's mail app defaults to.
   */
  const handleSendViaGraph = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);

    if (!graphReady) {
      setErrorMessage(
        'Sending from the company mailbox needs an Outlook app registration for aimsgt.com, which is not set up in this build. Use "Share with attachments" below — it opens Outlook with both PDFs attached.'
      );
      return;
    }

    setIsSending(true);
    setBusyLabel('Signing in...');

    try {
      const token = await getMailToken(true);
      if (!token) {
        setErrorMessage('Sign-in was not completed, so nothing was sent.');
        return;
      }

      const address = await getSignedInAddress();
      setSignedInAs(address);

      setBusyLabel('Building PDFs...');
      const [f2Res, billsRes] = await Promise.all([
        generateF2SummaryPdf(headerInfo, expenses),
        generateCompiledBillsPdf(headerInfo, expenses)
      ]);

      setBusyLabel('Sending Mail...');
      await sendExpenseEmailViaGraph(token, {
        to: toList,
        cc: ccList,
        subject,
        bodyHtml: emailBody.replace(/\n/g, '<br/>'),
        attachments: [
          { name: f2Res.fileName, base64: f2Res.base64 },
          { name: billsRes.fileName, base64: billsRes.base64 }
        ]
      });

      setSentFrom(address);
      setSendSuccess(true);
    } catch (err) {
      console.error('Could not send the report:', err);
      setErrorMessage(
        `The report was not sent. ${err instanceof Error ? err.message : 'Outlook refused the request.'} Nothing has gone out — use "Share with attachments" to send it from the Outlook app instead.`
      );
    } finally {
      setIsSending(false);
    }
  };

  /**
   * The share sheet is the only route from a web page to the Outlook app that
   * keeps the PDFs attached; a mailto: link cannot carry a file.
   */
  const handleShare = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setIsSending(true);
    setBusyLabel('Building PDFs...');

    try {
      const files = await buildReportFiles();
      const outcome = await shareReportFiles(files, subject, emailBody);

      if (outcome === 'unsupported') {
        downloadReportFiles(files);
        setNoticeMessage(
          'This browser cannot pass files to another app, so both PDFs have been saved instead. Attach them to the mail yourself.'
        );
      } else if (outcome === 'shared') {
        setNoticeMessage(
          'Both PDFs were handed to the app you picked. Check the recipients there before sending.'
        );
      }
    } catch (err) {
      console.error('Could not share the report:', err);
      setErrorMessage('The PDFs could not be shared. Use "Save both PDFs" and attach them by hand.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setIsSending(true);
    setBusyLabel('Building PDFs...');
    try {
      downloadReportFiles(await buildReportFiles());
      setNoticeMessage('Both PDFs have been saved. Attach them to the mail yourself.');
    } catch (err) {
      console.error('Could not build the PDFs:', err);
      setErrorMessage('The PDFs could not be built.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMailto = () => {
    // Recipients come from the fields above; they used to be ignored here, so
    // edits made in this dialog never reached the mail that opened.
    window.location.href = generateMailtoUrl(toList, ccList, subject, emailBody);
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
              Your F2 Expense Report PDF and Compiled Bills PDF have been emailed to <span className="text-slate-200 font-semibold">{toInput}</span>
              {sentFrom && (
                <>
                  {' '}from <span className="text-slate-200 font-semibold">{sentFrom}</span>
                </>
              )}
              .
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

            {/* What is being claimed, so the totals are checkable before sending */}
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-700/60 space-y-1">
              <div className="flex items-center justify-between text-slate-300">
                <span>This report ({headerInfo.dateSubmitted})</span>
                <span className="font-semibold text-slate-100">SAR {grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Bank Balance / previous bal</span>
                <span className="font-semibold text-slate-100">SAR {previousBalance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-slate-200">
                <span className="font-semibold">Total unpaid</span>
                <span className="font-bold text-emerald-400">
                  SAR {(previousBalance + grandTotal).toFixed(2)}
                </span>
              </div>
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
                  <span className="font-mono truncate">2. Bills PDF: Shoeb_Bills_{headerInfo.dateSubmitted}_SAR {Math.round(grandTotal)}.pdf</span>
                  <span className="text-blue-400 font-bold shrink-0">{expenses.filter(e => e.receiptImage).length} Images</span>
                </div>
              </div>
            </div>

            {/* Which account this will actually leave from */}
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-700/60 text-slate-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              {graphReady ? (
                <span>
                  {signedInAs ? (
                    <>
                      Sending as <span className="font-semibold text-slate-100">{signedInAs}</span>, with both
                      PDFs attached.
                    </>
                  ) : (
                    <>Sending asks you to sign in to your <span className="font-semibold text-slate-100">aimsgt.com</span> account first, so the report leaves from your company address with both PDFs attached.</>
                  )}
                </span>
              ) : (
                <span>
                  This build cannot sign in to <span className="font-semibold text-slate-100">aimsgt.com</span>,
                  so it cannot choose the sending account — the mail app picks that itself. Use{' '}
                  <span className="font-semibold text-slate-100">Share with attachments</span>, then check the
                  From address in Outlook before sending.
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {noticeMessage && (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{noticeMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-3">

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isSending}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Share2 className="w-4 h-4 text-sky-400" />
                  Share with attachments
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isSending}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  Save both PDFs
                </button>
              </div>

              {/* Kept for a quick draft, but it can never carry the files. */}
              <button
                type="button"
                onClick={handleOpenMailto}
                disabled={isSending}
                className="w-full px-4 py-2 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open mail app with the text only — no attachments
              </button>

              <div className="flex items-center gap-2 pt-1">
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
                  className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? busyLabel : graphReady ? 'Send from aimsgt.com' : 'Send via Outlook'}</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
