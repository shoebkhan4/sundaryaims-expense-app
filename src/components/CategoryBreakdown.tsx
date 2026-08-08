import React from 'react';
import { ExpenseItem, CompanyHeaderInfo } from '../types/expense';
import { Fuel, Wrench, Truck, Sliders, ShoppingBag, ShieldCheck } from 'lucide-react';

interface CategoryBreakdownProps {
  expenses: ExpenseItem[];
  headerInfo: CompanyHeaderInfo;
  onUpdateHeaderInfo: (info: Partial<CompanyHeaderInfo>) => void;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  expenses,
  headerInfo,
  onUpdateHeaderInfo
}) => {
  const categoryTotals = {
    fuel: expenses.filter(e => e.category === 'Electricity water fuel').reduce((s, i) => s + i.amount, 0),
    repair: expenses.filter(e => e.category === 'Site Office small repair').reduce((s, i) => s + i.amount, 0),
    rental: expenses.filter(e => e.category === 'Spot rental equpt').reduce((s, i) => s + i.amount, 0),
    tools: expenses.filter(e => e.category === 'Site Tools equpt').reduce((s, i) => s + i.amount, 0),
    consumable: expenses.filter(e => e.category === 'Sundry Consumable' || e.category === 'Other').reduce((s, i) => s + i.amount, 0)
  };

  const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            F2 Form Category Totals Breakdown
          </h3>
          <p className="text-xs text-slate-400">Live breakdown matching Saudi F2 Form columns</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Total: SAR {grandTotal.toFixed(2)}
        </span>
      </div>

      {/* Category Pills Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        
        {/* Fuel / Water */}
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Fuel className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-medium truncate">Fuel & Utilities</span>
          </div>
          <span className="text-sm font-bold text-slate-100 block">SAR {categoryTotals.fuel.toFixed(2)}</span>
        </div>

        {/* Office Repair */}
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Wrench className="w-4 h-4 text-sky-400" />
            <span className="text-[11px] font-medium truncate">Office Repair</span>
          </div>
          <span className="text-sm font-bold text-slate-100 block">SAR {categoryTotals.repair.toFixed(2)}</span>
        </div>

        {/* Spot Rental */}
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Truck className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-medium truncate">Spot Rental</span>
          </div>
          <span className="text-sm font-bold text-slate-100 block">SAR {categoryTotals.rental.toFixed(2)}</span>
        </div>

        {/* Tools */}
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-medium truncate">Site Tools</span>
          </div>
          <span className="text-sm font-bold text-slate-100 block">SAR {categoryTotals.tools.toFixed(2)}</span>
        </div>

        {/* Consumables */}
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-2 text-slate-400 mb-1">
            <ShoppingBag className="w-4 h-4 text-purple-400" />
            <span className="text-[11px] font-medium truncate">Consumables</span>
          </div>
          <span className="text-sm font-bold text-slate-100 block">SAR {categoryTotals.consumable.toFixed(2)}</span>
        </div>

      </div>

      {/* Advance & Previous Balance Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60 text-xs">
        <div>
          <label className="block text-slate-400 font-medium mb-1">Advance Received from Company (SAR)</label>
          <input
            type="number"
            value={headerInfo.advanceFromCompany}
            onChange={(e) => onUpdateHeaderInfo({ advanceFromCompany: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Previous Bank Balance (SAR)</label>
          <input
            type="number"
            value={headerInfo.previousBalance}
            onChange={(e) => onUpdateHeaderInfo({ previousBalance: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

    </div>
  );
};
