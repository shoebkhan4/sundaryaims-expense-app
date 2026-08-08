import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, Check } from 'lucide-react';
import { CompanyHeaderInfo, ExpenseItem } from '../types/expense';
import { generateF2SummaryPdf, generateCompiledBillsPdf } from '../services/pdfGenerator';

interface F2PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerInfo: CompanyHeaderInfo;
  expenses: ExpenseItem[];
}

export const F2PdfPreviewModal: React.FC<F2PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  headerInfo,
  expenses
}) => {
  const [f2PdfUrl, setF2PdfUrl] = useState<string | null>(null);
  const [f2FileName, setF2FileName] = useState<string>('');

  const [billsPdfUrl, setBillsPdfUrl] = useState<string | null>(null);
  const [billsFileName, setBillsFileName] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'f2' | 'bills'>('f2');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && expenses.length > 0) {
      setIsGenerating(true);

      Promise.all([
        generateF2SummaryPdf(headerInfo, expenses),
        generateCompiledBillsPdf(headerInfo, expenses)
      ]).then(([f2Res, billsRes]) => {
        const urlF2 = URL.createObjectURL(f2Res.pdfBlob);
        setF2PdfUrl(urlF2);
        setF2FileName(f2Res.fileName);

        const urlBills = URL.createObjectURL(billsRes.pdfBlob);
        setBillsPdfUrl(urlBills);
        setBillsFileName(billsRes.fileName);

        setIsGenerating(false);
      });
    }
  }, [isOpen, headerInfo, expenses]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Generated Expense Reports PDF Preview
            </h2>
            <p className="text-xs text-slate-400">PDFs formatted for company approval & email attachments</p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Tab Switches */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('f2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'f2' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                F2 Summary PDF
              </button>
              <button
                onClick={() => setActiveTab('bills')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'bills' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compiled Bills PDF
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / PDF Viewer */}
        <div className="flex-1 bg-slate-950 p-4 overflow-hidden relative flex flex-col items-center justify-center">
          {isGenerating ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-semibold text-slate-300">Rendering PDF document...</span>
            </div>
          ) : activeTab === 'f2' ? (
            f2PdfUrl ? (
              <iframe
                src={f2PdfUrl}
                className="w-full h-full rounded-xl border border-slate-800 shadow-inner bg-slate-900"
                title="F2 PDF Preview"
              />
            ) : null
          ) : billsPdfUrl ? (
            <iframe
              src={billsPdfUrl}
              className="w-full h-full rounded-xl border border-slate-800 shadow-inner bg-slate-900"
              title="Compiled Bills PDF Preview"
            />
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-850 flex items-center justify-between text-xs">
          <span className="text-slate-400 truncate max-w-md">
            Active file: <span className="font-mono text-slate-200">{activeTab === 'f2' ? f2FileName : billsFileName}</span>
          </span>

          <div className="flex items-center space-x-3">
            {activeTab === 'f2' && f2PdfUrl && (
              <a
                href={f2PdfUrl}
                download={f2FileName}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" />
                Download F2 PDF
              </a>
            )}

            {activeTab === 'bills' && billsPdfUrl && (
              <a
                href={billsPdfUrl}
                download={billsFileName}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" />
                Download Compiled Bills PDF
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
