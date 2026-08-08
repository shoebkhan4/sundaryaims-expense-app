import React, { useState } from 'react';
import { CompanyHeaderInfo, ExpenseItem } from './types/expense';
import { Navbar } from './components/Navbar';
import { ExpenseList } from './components/ExpenseList';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { F2PdfPreviewModal } from './components/F2PdfPreviewModal';
import { OutlookModal } from './components/OutlookModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { Plus, Send, FileText, Sparkles, Building2, UserCheck, Calendar, Edit3 } from 'lucide-react';

const INITIAL_HEADER_INFO: CompanyHeaderInfo = {
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
};

// Prefilled active June 2026 expense draft matching Shoeb_SUNDRY EXPENSES_ 27- June 26.xlsx
const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    date: '2026-06-27',
    description: 'Site Fuel -FGP (6 Visit)',
    jobNo: '12918',
    category: 'Electricity water fuel',
    amount: 430.50
  },
  {
    id: 'exp-2',
    date: '2026-06-27',
    description: 'Site Food-FGP (6 Visit)-5 Person',
    jobNo: '12918',
    category: 'Sundry Consumable',
    amount: 508.00
  },
  {
    id: 'exp-3',
    date: '2026-06-27',
    description: 'AI Subscription Bills',
    jobNo: '-',
    category: 'Sundry Consumable',
    amount: 257.40
  },
  {
    id: 'exp-4',
    date: '2026-06-27',
    description: 'Material (Special cable)',
    jobNo: '12918',
    category: 'Site Tools equpt',
    amount: 50.00
  }
];

export default function App() {
  const [headerInfo, setHeaderInfo] = useState<CompanyHeaderInfo>(() => {
    const saved = localStorage.getItem('aims_header_info');
    return saved ? JSON.parse(saved) : INITIAL_HEADER_INFO;
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('aims_expenses');
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Save to localStorage on change
  React.useEffect(() => {
    localStorage.setItem('aims_header_info', JSON.stringify(headerInfo));
  }, [headerInfo]);

  React.useEffect(() => {
    localStorage.setItem('aims_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isOutlookModalOpen, setIsOutlookModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  const grandTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

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

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
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
      
      {/* Sticky Header Navbar */}
      <Navbar
        onOpenAddModal={() => {
          setEditingExpense(null);
          setIsAddModalOpen(true);
        }}
        onOpenOutlookModal={() => setIsOutlookModalOpen(true)}
        onOpenHistoryDrawer={() => setIsHistoryDrawerOpen(true)}
        onOpenPdfPreview={() => setIsPdfModalOpen(true)}
        totalExpensesCount={expenses.length}
        grandTotal={grandTotal}
        isOutlookConnected={true}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* TOP SUMMARY BANNER CARD */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Header Info Details */}
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                  Company F2 Form Draft
                </span>

                <div className="flex items-center text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                  <span className="text-slate-400 mr-1 font-medium">Expense Date:</span>
                  <input
                    type="date"
                    value={headerInfo.dateSubmitted}
                    onChange={(e) => handleUpdateHeaderInfo({ dateSubmitted: e.target.value })}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold px-2 py-0.5 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Editable Report Title / Period */}
              <div className="group relative max-w-2xl">
                {isEditingTitle ? (
                  <input
                    type="text"
                    autoFocus
                    value={headerInfo.expenseTypeSummary}
                    onChange={(e) => handleUpdateHeaderInfo({ expenseTypeSummary: e.target.value })}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                    className="w-full text-xl sm:text-2xl font-extrabold text-white bg-slate-900 border border-blue-500 rounded-lg px-3 py-1 focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingTitle(true)}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-lg -ml-1.5 transition"
                    title="Click to edit expense period description"
                  >
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
                      {headerInfo.expenseTypeSummary}
                    </h2>
                    <Edit3 className="w-4 h-4 text-blue-400 opacity-60 group-hover:opacity-100 transition" />
                  </div>
                )}
              </div>

              {/* Editable Metadata Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300 pt-1">
                
                {/* Employee Name */}
                <div className="flex items-center space-x-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Employee</span>
                    <input
                      type="text"
                      value={headerInfo.employeeName}
                      onChange={(e) => handleUpdateHeaderInfo({ employeeName: e.target.value })}
                      className="bg-transparent font-semibold text-slate-200 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Site / Location */}
                <div className="flex items-center space-x-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Place / Site</span>
                    <input
                      type="text"
                      value={headerInfo.placeSite}
                      onChange={(e) => handleUpdateHeaderInfo({ placeSite: e.target.value })}
                      className="bg-transparent font-semibold text-slate-200 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Approver Name */}
                <div className="flex items-center space-x-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Approver</span>
                    <input
                      type="text"
                      value={headerInfo.approverName}
                      onChange={(e) => handleUpdateHeaderInfo({ approverName: e.target.value })}
                      className="bg-transparent font-semibold text-slate-200 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="flex items-center space-x-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Currency</span>
                    <input
                      type="text"
                      value={headerInfo.currency}
                      onChange={(e) => handleUpdateHeaderInfo({ currency: e.target.value })}
                      className="bg-transparent font-semibold text-slate-200 w-full focus:outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Action Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800 shrink-0">
              <div className="text-left sm:text-right pr-4 border-r-0 sm:border-r border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Grand Total</span>
                <span className="text-2xl font-black text-emerald-400">SAR {grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsOutlookModalOpen(true)}
                  disabled={expenses.length === 0}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Outlook</span>
                </button>
                <button
                  onClick={() => {
                    setEditingExpense(null);
                    setIsAddModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Row</span>
                </button>
              </div>
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
            <h3 className="text-base font-bold text-slate-200">
              Expense Items List ({expenses.length})
            </h3>
            <span className="text-xs text-slate-400">
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
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs text-slate-500">
        HADAF AL AIMS TRADING CO. &copy; 2026 | Sundry Expense Tracker & Outlook Submissions
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

    </div>
  );
}
