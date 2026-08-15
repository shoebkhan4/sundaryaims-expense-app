import React from 'react';
import { ExpenseItem, CompanyHeaderInfo } from '../types/expense';
import { Fuel, Wrench, Truck, Sliders, ShoppingBag, ShieldCheck, Utensils, Package, Cpu } from 'lucide-react';

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
    food: expenses.filter(e => e.category === 'Site Food').reduce((s, i) => s + i.amount, 0),
    material: expenses.filter(e => e.category === 'Project Material').reduce((s, i) => s + i.amount, 0),
    onlineParts: expenses.filter(e => e.category === 'Online Parts Purchased (Project)').reduce((s, i) => s + i.amount, 0),
    repair: expenses.filter(e => e.category === 'Site Office small repair').reduce((s, i) => s + i.amount, 0),
    rental: expenses.filter(e => e.category === 'Spot rental equpt').reduce((s, i) => s + i.amount, 0),
    tools: expenses.filter(e => e.category === 'Site Tools equpt').reduce((s, i) => s + i.amount, 0),
    consumable: expenses.filter(e => e.category === 'Sundry Consumable' || e.category === 'Other').reduce((s, i) => s + i.amount, 0)
  };

  const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00A3E0]" />
            F2 Form Category Breakdown
          </h3>
          <p className="text-[11px] text-slate-400">Live summary of site expenses by category</p>
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          Total: SAR {grandTotal.toFixed(2)}
        </span>
      </div>

      {/* Category Pills Grid (Mobile Optimized) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        
        {/* Fuel / Utilities */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Fuel className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Fuel & Utilities</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.fuel.toFixed(2)}</span>
        </div>

        {/* Site Food */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Utensils className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Site Food</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.food.toFixed(2)}</span>
        </div>

        {/* Project Material */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Material</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.material.toFixed(2)}</span>
        </div>

        {/* Online Parts */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Online Parts</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.onlineParts.toFixed(2)}</span>
        </div>

        {/* Office Repair */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Office Repair</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.repair.toFixed(2)}</span>
        </div>

        {/* Spot Rental */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Truck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Spot Rental</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.rental.toFixed(2)}</span>
        </div>

        {/* Tools */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <Sliders className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Site Tools</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.tools.toFixed(2)}</span>
        </div>

        {/* Consumables */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3">
          <div className="flex items-center space-x-1.5 text-slate-400 mb-1">
            <ShoppingBag className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold truncate">Consumables</span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-100 block">SAR {categoryTotals.consumable.toFixed(2)}</span>
        </div>

      </div>

      {/* Advance & Previous Balance Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div>
          {/* Labelled exactly as on the F2 form itself. */}
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Advance from Company</label>
          <input
            type="number"
            value={headerInfo.advanceFromCompany}
            onChange={(e) => onUpdateHeaderInfo({ advanceFromCompany: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-bold"
          />
        </div>

        <div>
          {/* The F2 form's own wording; this figure is carried into the total
              on the submission email. */}
          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Bank Balance / previous bal</label>
          <input
            type="number"
            value={headerInfo.previousBalance}
            onChange={(e) => onUpdateHeaderInfo({ previousBalance: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-bold"
          />
        </div>
      </div>

    </div>
  );
};
