import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Download, Search, TrendingUp, BarChart3, Table } from 'lucide-react';
import { budgetData, grandTotal, months } from '../data/budgetData';
import type { BudgetCategory } from '../data/budgetData';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('cs-CZ').format(value);
};

const BudgetDashboard: React.FC = () => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ppc']));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(budgetData.map(c => c.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return budgetData;

    return budgetData.map(category => ({
      ...category,
      items: category.items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.accountCode.includes(searchTerm) ||
        (item.note && item.note.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    })).filter(category =>
      category.items.length > 0 ||
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const exportToCSV = () => {
    const headers = ['Kategorie', 'Účet', 'Název', 'Poznámka', ...months, 'CELKEM 2026'];
    const rows: string[][] = [];

    budgetData.forEach(category => {
      rows.push([category.name, '', '', '', ...category.items[0]?.monthly.map(() => '') || [], formatNumber(category.total)]);
      category.items.forEach(item => {
        rows.push([
          '',
          item.accountCode,
          item.name,
          item.note || '',
          ...item.monthly.map(v => formatNumber(v)),
          formatNumber(item.total),
        ]);
      });
    });

    rows.push(['CELKEM', '', '', '', ...grandTotal.monthly.map(v => formatNumber(v)), formatNumber(grandTotal.total)]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `marketing_budget_2026_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getCategoryMonthlyTotal = (category: BudgetCategory, monthIndex: number): number => {
    return category.items.reduce((sum, item) => sum + item.monthly[monthIndex], 0);
  };

  const getMaxMonthValue = (): number => {
    return Math.max(...grandTotal.monthly);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Náklady MKT 2026</h1>
              <p className="text-slate-500 text-sm mt-1">Marketingový rozpočet - roční přehled</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-medium">Celkový rozpočet 2026</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(grandTotal.total)}</div>
            <div className="flex items-center gap-1 mt-2 text-emerald-600 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{grandTotal.percentage.toFixed(2)}% z tržeb</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-medium">Průměr/měsíc</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(grandTotal.total / 12)}</div>
            <div className="text-slate-400 text-sm mt-2">~{formatNumber(Math.round(grandTotal.total / 12))} Kč</div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-medium">Nejvyšší měsíc</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {months[grandTotal.monthly.indexOf(Math.max(...grandTotal.monthly))]}
            </div>
            <div className="text-slate-400 text-sm mt-2">{formatCurrency(Math.max(...grandTotal.monthly))}</div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-medium">Nejnižší měsíc</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {months[grandTotal.monthly.indexOf(Math.min(...grandTotal.monthly))]}
            </div>
            <div className="text-slate-400 text-sm mt-2">{formatCurrency(Math.min(...grandTotal.monthly))}</div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-medium">Počet kategorií</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{budgetData.length}</div>
            <div className="text-slate-400 text-sm mt-2">{budgetData.reduce((sum, c) => sum + c.items.length, 0)} položek</div>
          </div>
        </div>

        {/* Category Overview Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Rozložení rozpočtu podle kategorií</h3>
          <div className="space-y-3">
            {budgetData.sort((a, b) => b.total - a.total).map(category => {
              const percentage = (category.total / grandTotal.total) * 100;
              return (
                <div key={category.id} className="flex items-center gap-4">
                  <div className="w-48 flex items-center gap-2">
                    <span className="text-xl">{category.icon}</span>
                    <span className="text-sm font-medium text-slate-700 truncate">{category.name.replace('MARKETING - ', '')}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-8 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(category.total)}</div>
                    <div className="text-xs text-slate-500">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Overview Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Měsíční přehled nákladů</h3>
          <div className="flex items-end gap-2 h-48">
            {grandTotal.monthly.map((value, index) => {
              const height = (value / getMaxMonthValue()) * 100;
              const isSelected = selectedMonth === index;
              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                  onClick={() => setSelectedMonth(isSelected ? null : index)}
                >
                  <div className="text-xs text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatCurrency(value)}
                  </div>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isSelected ? 'bg-indigo-600' : 'bg-indigo-400 hover:bg-indigo-500'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className={`text-xs mt-2 font-medium ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {months[index].substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Hledat podle názvu, účtu nebo poznámky..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Rozbalit vše
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Sbalit vše
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <Table className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'chart' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-4 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[300px]">
                    Položka
                  </th>
                  <th className="text-left p-4 font-semibold text-slate-700 w-20">Účet</th>
                  {months.map((month, index) => (
                    <th
                      key={month}
                      className={`text-right p-4 font-semibold text-slate-700 min-w-[100px] cursor-pointer hover:bg-slate-100 transition-colors ${
                        selectedMonth === index ? 'bg-indigo-50 text-indigo-700' : ''
                      }`}
                      onClick={() => setSelectedMonth(selectedMonth === index ? null : index)}
                    >
                      {index + 1}
                      <div className="text-xs font-normal text-slate-500">{month}</div>
                    </th>
                  ))}
                  <th className="text-right p-4 font-bold text-slate-900 min-w-[130px] bg-slate-100">
                    CELKEM 2026
                  </th>
                  <th className="text-right p-4 font-semibold text-slate-700 w-20">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Grand Total Row */}
                <tr className="bg-indigo-600 text-white font-bold">
                  <td className="p-4 sticky left-0 bg-indigo-600 z-10">
                    <span className="text-lg">◾ CELKEM</span>
                  </td>
                  <td className="p-4"></td>
                  {grandTotal.monthly.map((value, index) => (
                    <td
                      key={index}
                      className={`text-right p-4 font-mono ${selectedMonth === index ? 'bg-indigo-500' : ''}`}
                    >
                      {formatNumber(value)}
                    </td>
                  ))}
                  <td className="text-right p-4 font-mono bg-indigo-700">{formatNumber(grandTotal.total)}</td>
                  <td className="text-right p-4">{grandTotal.percentage.toFixed(2)}%</td>
                </tr>

                {/* Categories */}
                {filteredData.map(category => {
                  const isExpanded = expandedCategories.has(category.id);
                  return (
                    <React.Fragment key={category.id}>
                      {/* Category Header */}
                      <tr
                        className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-t-2 border-slate-200"
                        onClick={() => toggleCategory(category.id)}
                      >
                        <td className="p-4 sticky left-0 bg-slate-50 hover:bg-slate-100 z-10">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="text-xl">{category.icon}</span>
                            <span className="font-semibold text-slate-800">{category.name}</span>
                          </div>
                        </td>
                        <td className="p-4"></td>
                        {category.items[0]?.monthly.map((_, index) => {
                          const monthTotal = getCategoryMonthlyTotal(category, index);
                          return (
                            <td
                              key={index}
                              className={`text-right p-4 font-mono font-semibold text-slate-700 ${
                                selectedMonth === index ? 'bg-indigo-50' : ''
                              }`}
                            >
                              {formatNumber(monthTotal)}
                            </td>
                          );
                        })}
                        <td
                          className="text-right p-4 font-mono font-bold text-slate-900 bg-slate-100"
                          style={{ color: category.color }}
                        >
                          {formatNumber(category.total)}
                        </td>
                        <td className="text-right p-4 font-semibold" style={{ color: category.color }}>
                          {category.percentage.toFixed(2)}%
                        </td>
                      </tr>

                      {/* Category Items */}
                      {isExpanded &&
                        category.items.map((item, itemIndex) => (
                          <tr
                            key={item.id}
                            className={`${itemIndex % 2 === 0 ? 'bg-white' : 'bg-slate-25'} hover:bg-blue-50 transition-colors`}
                          >
                            <td className="p-4 pl-14 sticky left-0 bg-inherit z-10">
                              <div>
                                <span className="text-slate-800">{item.name}</span>
                                {item.note && (
                                  <div className="text-xs text-slate-400 mt-1 italic">{item.note}</div>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">
                                {item.accountCode}
                              </span>
                            </td>
                            {item.monthly.map((value, index) => (
                              <td
                                key={index}
                                className={`text-right p-4 font-mono text-slate-600 ${
                                  selectedMonth === index ? 'bg-indigo-50 font-semibold text-indigo-700' : ''
                                } ${value === 0 ? 'text-slate-300' : ''}`}
                              >
                                {value === 0 ? '-' : formatNumber(value)}
                              </td>
                            ))}
                            <td className="text-right p-4 font-mono font-semibold text-slate-900 bg-slate-50">
                              {formatNumber(item.total)}
                            </td>
                            <td className="text-right p-4 text-slate-400 text-xs">
                              {((item.total / grandTotal.total) * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Month Summary */}
        {selectedMonth !== null && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-sm text-slate-500">Vybraný měsíc</div>
                <div className="text-lg font-bold text-indigo-600">{months[selectedMonth]}</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <div className="text-sm text-slate-500">Celkové náklady</div>
                <div className="text-lg font-bold text-slate-900">{formatCurrency(grandTotal.monthly[selectedMonth])}</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <div className="text-sm text-slate-500">Podíl na roce</div>
                <div className="text-lg font-bold text-slate-900">
                  {((grandTotal.monthly[selectedMonth] / grandTotal.total) * 100).toFixed(1)}%
                </div>
              </div>
              <button
                onClick={() => setSelectedMonth(null)}
                className="ml-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1800px] mx-auto px-6 py-4 text-center text-slate-500 text-sm">
          Náklady MKT 2026 | Marketingový rozpočet | Vygenerováno {new Date().toLocaleDateString('cs-CZ')}
        </div>
      </footer>
    </div>
  );
};

export default BudgetDashboard;
