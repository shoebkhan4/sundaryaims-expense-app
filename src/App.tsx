import React, { useState, useEffect } from 'react';
import { CompanyHeaderInfo, ExpenseItem } from './types/expense';
import { Navbar } from './components/Navbar';
import { ExpenseList } from './components/ExpenseList';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { F2PdfPreviewModal } from './components/F2PdfPreviewModal';
import { OutlookModal } from './components/OutlookModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';
import { clearStoredExpenses, loadExpenses, loadReceiptImages, persistExpenses } from './services/expenseStorage';
import { Send, FileText, Sparkles, Building2, UserCheck, Calendar, Edit3, RotateCcw, Layers } from 'lucide-react';
import { AIMS_LOGO_BASE64 } from './assets/images';

const INITIAL_HEADER_INFO: CompanyHeaderInfo = {
  companyName: 'HADAF AL AIMS TRADING CO.',
  formName: 'AIMS F2 FORM (SAUDI RIYALS)',
  employeeName: 'Shoeb Ali Khan',
  badgeNo: 'xx',
  placeSite: 'KSA',
  currency: 'SAR',
  expenseTypeSummary: 'Sundry expenses August 2026',
  approverName: 'Leela Venkat',
  dateSubmitted: new Date().toISOString().split('T')[0],
  advanceFromCompany: 0,
  previousBalance: 0,
  cashInHand: 0,
  consolidateCategories: true
};

function detectExpenseTypeSummary(items: ExpenseItem[]): string {
  if (items.length === 0) return 'Sundry expenses August 2026';

  const monthsMap: Record<string, Set<number>> = {};
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  items.forEach(item => {
    if (!item.date) return;
    // Read the parts directly: `new Date('2026-09-01')` is UTC midnight, and
    // getMonth() is local, which slips to the previous month west of Greenwich.
    const parts = item.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) return;
    const year = Number(parts[1]);
    const monthIdx = Number(parts[2]) - 1;
    if (monthIdx < 0 || monthIdx > 11) return;
    if (!monthsMap[year]) monthsMap[year] = new Set();
    monthsMap[year].add(monthIdx);
  });

  const years = Object.keys(monthsMap).sort();
  if (years.length === 0) return 'Sundry expenses August 2026';

  const latestYear = years[years.length - 1];
  const sortedMonthIndices = Array.from(monthsMap[latestYear]).sort((a, b) => a - b);
  const formattedMonthNames = sortedMonthIndices.map(m => monthNames[m]).join(', ');

  return `Sundry expenses ${formattedMonthNames} ${latestYear}`;
}

export default function App() {
  const [headerInfo, setHeaderInfo] = useState<CompanyHeaderInfo>(() => {
    const saved = localStorage.getItem('aims_header_info');
    return saved ? JSON.parse(saved) : INITIAL_HEADER_INFO;
  });

  // The list paints immediately; the receipt images arrive from IndexedDB just
  // after, because they are far too large for localStorage.
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => loadExpenses());

  useEffect(() => {
    let cancelled = false;
    const saved = loadExpenses();
    if (saved.length === 0) return;

    loadReceiptImages(saved.map((e) => e.id)).then((images) => {
      if (cancelled || images.size === 0) return;
      // Merged by id rather than replacing the list, so anything added while
      // the images were loading survives.
      setExpenses((prev) =>
        prev.map((expense) =>
          expense.receiptImage ? expense : { ...expense, receiptImage: images.get(expense.id) }
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const [isEditingTitle, setIsEditingTitle] = useState(false);

  /**
   * Whether the report title was typed by hand. The title is derived from the
   * months the expenses fall in, but that derivation used to run on every
   * change to the list, so a title the user had corrected was overwritten the
   * next time anything was added or edited.
   */
  const [isTitleManual, setIsTitleManual] = useState<boolean>(() => {
    return localStorage.getItem('aims_title_manual') === '1';
  });

  useEffect(() => {
    try {
      localStorage.setItem('aims_title_manual', isTitleManual ? '1' : '0');
    } catch {
      // Persistence failures are surfaced by the expense save below.
    }
  }, [isTitleManual]);

  useEffect(() => {
    if (isTitleManual) return;
    if (expenses.length > 0) {
      const autoTitle = detectExpenseTypeSummary(expenses);
      setHeaderInfo(prev => ({ ...prev, expenseTypeSummary: autoTitle }));
    }
  }, [expenses, isTitleManual]);

  useEffect(() => {
    try {
      localStorage.setItem('aims_header_info', JSON.stringify(headerInfo));
    } catch (e) {
      console.warn('localStorage save failed for headerInfo', e);
    }
  }, [headerInfo]);

  /** Set when the browser refuses to persist, so the user is not left thinking
   *  their work is saved when it is not. */
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    persistExpenses(expenses).then((result) => {
      if (!cancelled) setStorageError(!result.ok);
    });
    return () => {
      cancelled = true;
    };
  }, [expenses]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isOutlookModalOpen, setIsOutlookModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Pending destructive actions, each held until the user confirms.
  const [expensePendingDelete, setExpensePendingDelete] = useState<ExpenseItem | null>(null);
  const [isClearReportPending, setIsClearReportPending] = useState(false);

  const grandTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  const handleStartNewReport = () => {
    if (expenses.length === 0) {
      // Nothing would be lost, so do not interrupt with a dialog.
      resetReport();
      return;
    }
    setIsClearReportPending(true);
  };

  const resetReport = () => {
    setIsTitleManual(false);
    setHeaderInfo({
      ...INITIAL_HEADER_INFO,
      dateSubmitted: new Date().toISOString().split('T')[0],
      expenseTypeSummary: 'Sundry expenses August 2026'
    });
    setExpenses([]);
    void clearStoredExpenses();
  };

  const handleSaveExpense = (newExpenseData: Omit<ExpenseItem, 'id'>) => {
    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...newExpenseData, id: editingExpense.id } : e));
      setEditingExpense(null);
    } else {
      const newItem: ExpenseItem = {
        ...newExpenseData,
        id: `exp-${Date.now()}`
      };
      setExpenses(prev => [newItem, ...prev]);
    }
  };

  /** Deletions always route through a confirmation dialog. */
  const handleDeleteExpense = (id: string) => {
    const target = expenses.find(e => e.id === id);
    if (target) setExpensePendingDelete(target);
  };

  const confirmDeleteExpense = () => {
    if (!expensePendingDelete) return;
    const id = expensePendingDelete.id;
    setExpenses(prev => prev.filter(e => e.id !== id));
    setExpensePendingDelete(null);
  };

  const handleEditExpense = (item: ExpenseItem) => {
    setEditingExpense(item);
    setIsAddModalOpen(true);
  };

  const handleUpdateHeaderInfo = (partial: Partial<CompanyHeaderInfo>) => {
    setHeaderInfo(prev => ({ ...prev, ...partial }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Persistence is silent when it works; it must not be silent when it fails. */}
      {storageError && (
        <div className="bg-rose-600/90 text-white text-xs font-semibold px-4 py-2 text-center">
          This device is out of storage space, so recent changes are not being saved.
          Send or download this report, then start a new one to free space.
        </div>
      )}

      {/* Sticky Header Navbar with AIMS Logo */}
      <Navbar
        onOpenAddModal={() => {
          setEditingExpense(null);
          setIsAddModalOpen(true);
        }}
        onOpenOutlookModal={() => setIsOutlookModalOpen(true)}
        onOpenHistoryDrawer={() => setIsHistoryDrawerOpen(true)}
        onOpenPdfPreview={() => setIsPdfModalOpen(true)}
        onStartNewReport={handleStartNewReport}
        totalExpensesCount={expenses.length}
        grandTotal={grandTotal}
        isOutlookConnected={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* AIMS BRANDED TOP SUMMARY BANNER CARD */}
        <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          
          {/* Top Yellow Ribbon Matching F2 Form Header */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFC20E]" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-1">
            
            {/* Header Info Details */}
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-[#00A3E0]/15 border border-[#00A3E0]/30 text-[#00A3E0] text-xs font-black uppercase tracking-wider">
                  Company F2 Form Draft
                </span>

                <div className="flex items-center text-xs text-slate-300 bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400 mr-1.5" />
                  <span className="text-slate-400 mr-1 font-medium">Expense Date:</span>
                  <input
                    type="date"
                    value={headerInfo.dateSubmitted}
                    onChange={(e) => handleUpdateHeaderInfo({ dateSubmitted: e.target.value })}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold px-2 py-0.5 rounded focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Category Consolidation Mode Toggle */}
                <button
                  onClick={() => handleUpdateHeaderInfo({ consolidateCategories: !headerInfo.consolidateCategories })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                    headerInfo.consolidateCategories
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle point-wise category grouping on F2 Form PDF"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PDF Mode: {headerInfo.consolidateCategories ? 'Category Grouped' : 'Individual Rows'}</span>
                </button>
              </div>

              {/* Editable Report Title / Auto Month Detection */}
              <div className="group relative max-w-2xl">
                {isEditingTitle ? (
                  <input
                    type="text"
                    autoFocus
                    value={headerInfo.expenseTypeSummary}
                    onChange={(e) => {
                      setIsTitleManual(true);
                      handleUpdateHeaderInfo({ expenseTypeSummary: e.target.value });
                    }}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                    className="w-full text-xl sm:text-2xl font-black text-white bg-slate-950 border border-[#00A3E0] rounded-xl px-3 py-1 focus:outline-none shadow-inner"
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingTitle(true)}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-slate-850 p-2 rounded-xl -ml-2 transition border border-transparent hover:border-slate-800"
                    title="Auto-detected from bill dates. Click to edit manually."
                  >
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {headerInfo.expenseTypeSummary}
                    </h2>
                    <Edit3 className="w-4 h-4 text-[#00A3E0] opacity-70 group-hover:opacity-100 transition" />
                  </div>
                )}
              </div>

              {/* Editable Metadata Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300 pt-1">
                
                {/* Employee Name */}
                <div className="flex items-center space-x-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <Building2 className="w-4 h-4 text-[#00A3E0] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Employee</span>
                    <input
                      type="text"
                      value={headerInfo.employeeName}
                      onChange={(e) => handleUpdateHeaderInfo({ employeeName: e.target.value })}
                      className="bg-transparent font-bold text-slate-100 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Site / Location */}
                <div className="flex items-center space-x-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <Sparkles className="w-4 h-4 text-[#FFC20E] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Place / Site</span>
                    <input
                      type="text"
                      value={headerInfo.placeSite}
                      onChange={(e) => handleUpdateHeaderInfo({ placeSite: e.target.value })}
                      className="bg-transparent font-bold text-slate-100 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Approver Name */}
                <div className="flex items-center space-x-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Approver</span>
                    <input
                      type="text"
                      value={headerInfo.approverName}
                      onChange={(e) => handleUpdateHeaderInfo({ approverName: e.target.value })}
                      className="bg-transparent font-semibold text-slate-100 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="flex items-center space-x-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Currency</span>
                    <input
                      type="text"
                      value={headerInfo.currency}
                      onChange={(e) => handleUpdateHeaderInfo({ currency: e.target.value })}
                      className="bg-transparent font-bold text-slate-100 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-cyan-500"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Action Box (Removed duplicate + Add Row button) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0 shadow-lg">
              <div className="text-left sm:text-right pr-4 border-r-0 sm:border-r border-slate-800">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Grand Total</span>
                <span className="text-2xl font-black text-emerald-400">SAR {grandTotal.toFixed(2)}</span>
              </div>

              <button
                onClick={() => setIsOutlookModalOpen(true)}
                disabled={expenses.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A3E0] to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Send Outlook</span>
              </button>
            </div>

          </div>

        </div>

        {/* F2 FORM CATEGORY BREAKDOWN BAR */}
        <CategoryBreakdown
          expenses={expenses}
          headerInfo={headerInfo}
          onUpdateHeaderInfo={handleUpdateHeaderInfo}
        />

        {/* EXPENSE ITEMS LIST & DASHBOARD */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00A3E0]" />
              Expense Items List ({expenses.length})
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Click thumbnail to view full resolution bill photo
            </span>
          </div>

          <ExpenseList
            expenses={expenses}
            onEditExpense={handleEditExpense}
            onDeleteExpense={handleDeleteExpense}
            onOpenAddModal={() => {
              setEditingExpense(null);
              setIsAddModalOpen(true);
            }}
          />
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-5 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
        <div className="flex items-center space-x-2">
          <img src={AIMS_LOGO_BASE64} alt="AIMS Logo" className="h-4 w-auto bg-white px-1 py-0.5 rounded" />
          <span className="font-bold text-slate-300">HADAF AL AIMS TRADING CO. &copy; 2026</span>
        </div>
        <p className="text-[11px] text-slate-500">Sundry Expense Manager & Outlook Submissions</p>
      </footer>

      {/* POPUP MODALS */}
      <ExpenseFormModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExpense(null);
        }}
        onSaveExpense={handleSaveExpense}
        initialValues={editingExpense}
      />

      <F2PdfPreviewModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        headerInfo={headerInfo}
        expenses={expenses}
      />

      <OutlookModal
        isOpen={isOutlookModalOpen}
        onClose={() => setIsOutlookModalOpen(false)}
        headerInfo={headerInfo}
        expenses={expenses}
      />

      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        onLoadPastReport={(header, items) => {
          setHeaderInfo(header);
          setExpenses(items);
        }}
      />

      {/* Delete a single expense row */}
      <ConfirmDialog
        isOpen={Boolean(expensePendingDelete)}
        title="Delete this expense item?"
        message="The row and its attached bill will be removed from this report. This cannot be undone."
        detail={
          expensePendingDelete
            ? `${expensePendingDelete.description} — SAR ${expensePendingDelete.amount.toFixed(2)} (${expensePendingDelete.date})`
            : undefined
        }
        confirmLabel="Delete Item"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpensePendingDelete(null)}
      />

      {/* Clear the whole form and start a new report */}
      <ConfirmDialog
        isOpen={isClearReportPending}
        title="Delete this form and start fresh?"
        message="Every expense row and attached bill in the current draft will be cleared. This cannot be undone."
        detail={`${expenses.length} item${expenses.length === 1 ? '' : 's'} — SAR ${grandTotal.toFixed(2)}`}
        confirmLabel="Delete Form"
        onConfirm={() => {
          resetReport();
          setIsClearReportPending(false);
        }}
        onCancel={() => setIsClearReportPending(false)}
      />

    </div>
  );
}
