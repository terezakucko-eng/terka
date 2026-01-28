import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Download, Filter, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Typy dat
interface BudgetItem {
  id: string;
  category: string;
  code: string;
  country: string;
  description: string;
  monthlyData: {
    [month: string]: {
      yoy: number;
      plan: number;
      real: number;
    };
  };
}

interface CategoryData {
  name: string;
  items: BudgetItem[];
  expanded: boolean;
}

const BudgetPivotTable = () => {
  // Demo data based on the Google Sheets structure
  const [budgetData] = useState<CategoryData[]>([
    {
      name: 'MKT_Dárky',
      expanded: false,
      items: [
        {
          id: '1',
          category: 'MKT_Dárky',
          code: '50402',
          country: 'CZ',
          description: 'Dárky neslíbené',
          monthlyData: {
            '2026-01': { yoy: 180000, plan: 200000, real: 195000 },
            '2026-02': { yoy: 165000, plan: 180000, real: 172000 },
            '2026-03': { yoy: 190000, plan: 210000, real: 0 },
            '2026-04': { yoy: 175000, plan: 195000, real: 0 },
            '2026-05': { yoy: 200000, plan: 220000, real: 0 },
            '2026-06': { yoy: 185000, plan: 205000, real: 0 },
            '2026-07': { yoy: 170000, plan: 190000, real: 0 },
            '2026-08': { yoy: 195000, plan: 215000, real: 0 },
            '2026-09': { yoy: 210000, plan: 230000, real: 0 },
            '2026-10': { yoy: 225000, plan: 245000, real: 0 },
            '2026-11': { yoy: 280000, plan: 300000, real: 0 },
            '2026-12': { yoy: 320000, plan: 350000, real: 0 },
          }
        },
        {
          id: '2',
          category: 'MKT_Dárky',
          code: '50403',
          country: 'CZ',
          description: 'Dárky slíbené',
          monthlyData: {
            '2026-01': { yoy: 95000, plan: 105000, real: 102000 },
            '2026-02': { yoy: 88000, plan: 98000, real: 95000 },
            '2026-03': { yoy: 102000, plan: 112000, real: 0 },
            '2026-04': { yoy: 92000, plan: 102000, real: 0 },
            '2026-05': { yoy: 108000, plan: 118000, real: 0 },
            '2026-06': { yoy: 98000, plan: 108000, real: 0 },
            '2026-07': { yoy: 85000, plan: 95000, real: 0 },
            '2026-08': { yoy: 105000, plan: 115000, real: 0 },
            '2026-09': { yoy: 115000, plan: 125000, real: 0 },
            '2026-10': { yoy: 125000, plan: 135000, real: 0 },
            '2026-11': { yoy: 155000, plan: 165000, real: 0 },
            '2026-12': { yoy: 185000, plan: 195000, real: 0 },
          }
        },
      ]
    },
    {
      name: 'MKT_Služby',
      expanded: false,
      items: [
        {
          id: '3',
          category: 'MKT_Služby',
          code: '51201',
          country: 'CZ',
          description: 'Cestovné',
          monthlyData: {
            '2026-01': { yoy: 12000, plan: 15000, real: 14500 },
            '2026-02': { yoy: 10000, plan: 12000, real: 11800 },
            '2026-03': { yoy: 15000, plan: 18000, real: 0 },
            '2026-04': { yoy: 18000, plan: 20000, real: 0 },
            '2026-05': { yoy: 16000, plan: 18000, real: 0 },
            '2026-06': { yoy: 14000, plan: 16000, real: 0 },
            '2026-07': { yoy: 8000, plan: 10000, real: 0 },
            '2026-08': { yoy: 10000, plan: 12000, real: 0 },
            '2026-09': { yoy: 15000, plan: 17000, real: 0 },
            '2026-10': { yoy: 18000, plan: 20000, real: 0 },
            '2026-11': { yoy: 20000, plan: 22000, real: 0 },
            '2026-12': { yoy: 12000, plan: 14000, real: 0 },
          }
        },
        {
          id: '4',
          category: 'MKT_Služby',
          code: '51202',
          country: 'CZ',
          description: 'PHM',
          monthlyData: {
            '2026-01': { yoy: 8000, plan: 9000, real: 8800 },
            '2026-02': { yoy: 7500, plan: 8500, real: 8200 },
            '2026-03': { yoy: 9000, plan: 10000, real: 0 },
            '2026-04': { yoy: 9500, plan: 10500, real: 0 },
            '2026-05': { yoy: 10000, plan: 11000, real: 0 },
            '2026-06': { yoy: 9000, plan: 10000, real: 0 },
            '2026-07': { yoy: 8000, plan: 9000, real: 0 },
            '2026-08': { yoy: 8500, plan: 9500, real: 0 },
            '2026-09': { yoy: 9500, plan: 10500, real: 0 },
            '2026-10': { yoy: 10000, plan: 11000, real: 0 },
            '2026-11': { yoy: 10500, plan: 11500, real: 0 },
            '2026-12': { yoy: 8000, plan: 9000, real: 0 },
          }
        },
      ]
    },
    {
      name: 'MKT_TV_Radio_Outdoor',
      expanded: false,
      items: [
        {
          id: '5',
          category: 'MKT_TV_Radio_Outdoor',
          code: '518301',
          country: 'CZ',
          description: 'TV Nova',
          monthlyData: {
            '2026-01': { yoy: 850000, plan: 950000, real: 920000 },
            '2026-02': { yoy: 780000, plan: 880000, real: 850000 },
            '2026-03': { yoy: 920000, plan: 1020000, real: 0 },
            '2026-04': { yoy: 850000, plan: 950000, real: 0 },
            '2026-05': { yoy: 900000, plan: 1000000, real: 0 },
            '2026-06': { yoy: 750000, plan: 850000, real: 0 },
            '2026-07': { yoy: 600000, plan: 700000, real: 0 },
            '2026-08': { yoy: 700000, plan: 800000, real: 0 },
            '2026-09': { yoy: 950000, plan: 1050000, real: 0 },
            '2026-10': { yoy: 1100000, plan: 1200000, real: 0 },
            '2026-11': { yoy: 1400000, plan: 1500000, real: 0 },
            '2026-12': { yoy: 1200000, plan: 1300000, real: 0 },
          }
        },
        {
          id: '6',
          category: 'MKT_TV_Radio_Outdoor',
          code: '518302',
          country: 'CZ',
          description: 'TV Prima',
          monthlyData: {
            '2026-01': { yoy: 650000, plan: 720000, real: 710000 },
            '2026-02': { yoy: 600000, plan: 680000, real: 665000 },
            '2026-03': { yoy: 700000, plan: 780000, real: 0 },
            '2026-04': { yoy: 650000, plan: 730000, real: 0 },
            '2026-05': { yoy: 680000, plan: 760000, real: 0 },
            '2026-06': { yoy: 580000, plan: 660000, real: 0 },
            '2026-07': { yoy: 450000, plan: 530000, real: 0 },
            '2026-08': { yoy: 520000, plan: 600000, real: 0 },
            '2026-09': { yoy: 720000, plan: 800000, real: 0 },
            '2026-10': { yoy: 850000, plan: 930000, real: 0 },
            '2026-11': { yoy: 1050000, plan: 1130000, real: 0 },
            '2026-12': { yoy: 920000, plan: 1000000, real: 0 },
          }
        },
        {
          id: '7',
          category: 'MKT_TV_Radio_Outdoor',
          code: '518401',
          country: 'CZ',
          description: 'Rádio regionální',
          monthlyData: {
            '2026-01': { yoy: 120000, plan: 140000, real: 135000 },
            '2026-02': { yoy: 110000, plan: 130000, real: 125000 },
            '2026-03': { yoy: 140000, plan: 160000, real: 0 },
            '2026-04': { yoy: 130000, plan: 150000, real: 0 },
            '2026-05': { yoy: 145000, plan: 165000, real: 0 },
            '2026-06': { yoy: 125000, plan: 145000, real: 0 },
            '2026-07': { yoy: 100000, plan: 120000, real: 0 },
            '2026-08': { yoy: 115000, plan: 135000, real: 0 },
            '2026-09': { yoy: 150000, plan: 170000, real: 0 },
            '2026-10': { yoy: 175000, plan: 195000, real: 0 },
            '2026-11': { yoy: 210000, plan: 230000, real: 0 },
            '2026-12': { yoy: 180000, plan: 200000, real: 0 },
          }
        },
      ]
    },
    {
      name: 'MKT_Performance',
      expanded: false,
      items: [
        {
          id: '8',
          category: 'MKT_Performance',
          code: '518401',
          country: 'CZ',
          description: 'PPC Google CZ',
          monthlyData: {
            '2026-01': { yoy: 1200000, plan: 1350000, real: 1320000 },
            '2026-02': { yoy: 1100000, plan: 1250000, real: 1210000 },
            '2026-03': { yoy: 1300000, plan: 1450000, real: 0 },
            '2026-04': { yoy: 1250000, plan: 1400000, real: 0 },
            '2026-05': { yoy: 1350000, plan: 1500000, real: 0 },
            '2026-06': { yoy: 1200000, plan: 1350000, real: 0 },
            '2026-07': { yoy: 1000000, plan: 1150000, real: 0 },
            '2026-08': { yoy: 1150000, plan: 1300000, real: 0 },
            '2026-09': { yoy: 1400000, plan: 1550000, real: 0 },
            '2026-10': { yoy: 1600000, plan: 1750000, real: 0 },
            '2026-11': { yoy: 2000000, plan: 2150000, real: 0 },
            '2026-12': { yoy: 1800000, plan: 1950000, real: 0 },
          }
        },
        {
          id: '9',
          category: 'MKT_Performance',
          code: '518402',
          country: 'SK',
          description: 'PPC Google SK',
          monthlyData: {
            '2026-01': { yoy: 350000, plan: 400000, real: 390000 },
            '2026-02': { yoy: 320000, plan: 370000, real: 355000 },
            '2026-03': { yoy: 380000, plan: 430000, real: 0 },
            '2026-04': { yoy: 360000, plan: 410000, real: 0 },
            '2026-05': { yoy: 390000, plan: 440000, real: 0 },
            '2026-06': { yoy: 350000, plan: 400000, real: 0 },
            '2026-07': { yoy: 280000, plan: 330000, real: 0 },
            '2026-08': { yoy: 320000, plan: 370000, real: 0 },
            '2026-09': { yoy: 400000, plan: 450000, real: 0 },
            '2026-10': { yoy: 460000, plan: 510000, real: 0 },
            '2026-11': { yoy: 580000, plan: 630000, real: 0 },
            '2026-12': { yoy: 520000, plan: 570000, real: 0 },
          }
        },
        {
          id: '10',
          category: 'MKT_Performance',
          code: '518403',
          country: 'CZ',
          description: 'Facebook/Meta Ads',
          monthlyData: {
            '2026-01': { yoy: 450000, plan: 520000, real: 505000 },
            '2026-02': { yoy: 420000, plan: 490000, real: 475000 },
            '2026-03': { yoy: 480000, plan: 550000, real: 0 },
            '2026-04': { yoy: 460000, plan: 530000, real: 0 },
            '2026-05': { yoy: 500000, plan: 570000, real: 0 },
            '2026-06': { yoy: 450000, plan: 520000, real: 0 },
            '2026-07': { yoy: 380000, plan: 450000, real: 0 },
            '2026-08': { yoy: 430000, plan: 500000, real: 0 },
            '2026-09': { yoy: 520000, plan: 590000, real: 0 },
            '2026-10': { yoy: 600000, plan: 670000, real: 0 },
            '2026-11': { yoy: 750000, plan: 820000, real: 0 },
            '2026-12': { yoy: 680000, plan: 750000, real: 0 },
          }
        },
        {
          id: '11',
          category: 'MKT_Performance',
          code: '518404',
          country: 'CZ',
          description: 'SMS marketing',
          monthlyData: {
            '2026-01': { yoy: 85000, plan: 95000, real: 92000 },
            '2026-02': { yoy: 78000, plan: 88000, real: 85000 },
            '2026-03': { yoy: 92000, plan: 102000, real: 0 },
            '2026-04': { yoy: 88000, plan: 98000, real: 0 },
            '2026-05': { yoy: 95000, plan: 105000, real: 0 },
            '2026-06': { yoy: 85000, plan: 95000, real: 0 },
            '2026-07': { yoy: 70000, plan: 80000, real: 0 },
            '2026-08': { yoy: 80000, plan: 90000, real: 0 },
            '2026-09': { yoy: 98000, plan: 108000, real: 0 },
            '2026-10': { yoy: 115000, plan: 125000, real: 0 },
            '2026-11': { yoy: 145000, plan: 155000, real: 0 },
            '2026-12': { yoy: 130000, plan: 140000, real: 0 },
          }
        },
      ]
    },
    {
      name: 'MKT_Ostatní',
      expanded: false,
      items: [
        {
          id: '12',
          category: 'MKT_Ostatní',
          code: '518505',
          country: 'CZ',
          description: 'PR služby',
          monthlyData: {
            '2026-01': { yoy: 65000, plan: 75000, real: 72000 },
            '2026-02': { yoy: 60000, plan: 70000, real: 68000 },
            '2026-03': { yoy: 70000, plan: 80000, real: 0 },
            '2026-04': { yoy: 68000, plan: 78000, real: 0 },
            '2026-05': { yoy: 72000, plan: 82000, real: 0 },
            '2026-06': { yoy: 65000, plan: 75000, real: 0 },
            '2026-07': { yoy: 55000, plan: 65000, real: 0 },
            '2026-08': { yoy: 60000, plan: 70000, real: 0 },
            '2026-09': { yoy: 75000, plan: 85000, real: 0 },
            '2026-10': { yoy: 85000, plan: 95000, real: 0 },
            '2026-11': { yoy: 105000, plan: 115000, real: 0 },
            '2026-12': { yoy: 95000, plan: 105000, real: 0 },
          }
        },
        {
          id: '13',
          category: 'MKT_Ostatní',
          code: '518510',
          country: 'CZ',
          description: 'Tisk materiálů',
          monthlyData: {
            '2026-01': { yoy: 35000, plan: 42000, real: 40000 },
            '2026-02': { yoy: 32000, plan: 38000, real: 36500 },
            '2026-03': { yoy: 38000, plan: 45000, real: 0 },
            '2026-04': { yoy: 36000, plan: 43000, real: 0 },
            '2026-05': { yoy: 40000, plan: 47000, real: 0 },
            '2026-06': { yoy: 35000, plan: 42000, real: 0 },
            '2026-07': { yoy: 28000, plan: 35000, real: 0 },
            '2026-08': { yoy: 32000, plan: 39000, real: 0 },
            '2026-09': { yoy: 42000, plan: 49000, real: 0 },
            '2026-10': { yoy: 48000, plan: 55000, real: 0 },
            '2026-11': { yoy: 60000, plan: 67000, real: 0 },
            '2026-12': { yoy: 52000, plan: 59000, real: 0 },
          }
        },
      ]
    },
    {
      name: 'MKT_Mzdy',
      expanded: false,
      items: [
        {
          id: '14',
          category: 'MKT_Mzdy',
          code: '52100',
          country: 'CZ',
          description: 'Mzdové náklady HPP',
          monthlyData: {
            '2026-01': { yoy: 380000, plan: 410000, real: 405000 },
            '2026-02': { yoy: 380000, plan: 410000, real: 408000 },
            '2026-03': { yoy: 380000, plan: 410000, real: 0 },
            '2026-04': { yoy: 380000, plan: 410000, real: 0 },
            '2026-05': { yoy: 380000, plan: 410000, real: 0 },
            '2026-06': { yoy: 380000, plan: 410000, real: 0 },
            '2026-07': { yoy: 380000, plan: 410000, real: 0 },
            '2026-08': { yoy: 380000, plan: 410000, real: 0 },
            '2026-09': { yoy: 380000, plan: 410000, real: 0 },
            '2026-10': { yoy: 380000, plan: 410000, real: 0 },
            '2026-11': { yoy: 380000, plan: 410000, real: 0 },
            '2026-12': { yoy: 380000, plan: 410000, real: 0 },
          }
        },
      ]
    },
  ]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [visibleMonths, setVisibleMonths] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [filterCountry, setFilterCountry] = useState<string>('all');

  const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  const countries = ['CZ', 'SK', 'HU', 'RO', 'SI', 'HR', 'BG'];

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedCategories(new Set(budgetData.map(c => c.name)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Filter data
  const filteredData = useMemo(() => {
    return budgetData.map(category => ({
      ...category,
      items: category.items.filter(item => {
        const matchesSearch = searchTerm === '' ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.code.includes(searchTerm);
        const matchesCountry = filterCountry === 'all' || item.country === filterCountry;
        return matchesSearch && matchesCountry;
      })
    })).filter(category => category.items.length > 0);
  }, [budgetData, searchTerm, filterCountry]);

  // Calculate category totals
  const getCategoryTotals = (category: CategoryData, month: string) => {
    return category.items.reduce((acc, item) => {
      const monthData = item.monthlyData[month] || { yoy: 0, plan: 0, real: 0 };
      return {
        yoy: acc.yoy + monthData.yoy,
        plan: acc.plan + monthData.plan,
        real: acc.real + monthData.real,
      };
    }, { yoy: 0, plan: 0, real: 0 });
  };

  // Calculate grand totals
  const getGrandTotals = (month: string) => {
    return filteredData.reduce((acc, category) => {
      const categoryTotals = getCategoryTotals(category, month);
      return {
        yoy: acc.yoy + categoryTotals.yoy,
        plan: acc.plan + categoryTotals.plan,
        real: acc.real + categoryTotals.real,
      };
    }, { yoy: 0, plan: 0, real: 0 });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    return new Intl.NumberFormat('cs-CZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' Kč';
  };

  // Get variance indicator
  const getVarianceIndicator = (plan: number, real: number) => {
    if (real === 0) return null;
    const variance = ((real - plan) / plan) * 100;
    if (variance > 5) return <TrendingUp className="w-3 h-3 text-red-500" />;
    if (variance < -5) return <TrendingDown className="w-3 h-3 text-green-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  // Calculate year totals for a category
  const getCategoryYearTotal = (category: CategoryData, type: 'yoy' | 'plan' | 'real') => {
    return visibleMonths.reduce((total, monthNum) => {
      const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const monthTotals = getCategoryTotals(category, monthKey);
      return total + monthTotals[type];
    }, 0);
  };

  // Calculate item year totals
  const getItemYearTotal = (item: BudgetItem, type: 'yoy' | 'plan' | 'real') => {
    return visibleMonths.reduce((total, monthNum) => {
      const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const monthData = item.monthlyData[monthKey] || { yoy: 0, plan: 0, real: 0 };
      return total + monthData[type];
    }, 0);
  };

  // Get grand year total
  const getGrandYearTotal = (type: 'yoy' | 'plan' | 'real') => {
    return filteredData.reduce((total, category) => {
      return total + getCategoryYearTotal(category, type);
    }, 0);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Kategorie', 'Kód', 'Země', 'Popis'];
    visibleMonths.forEach(m => {
      headers.push(`${months[m-1]} YOY`, `${months[m-1]} PLAN`, `${months[m-1]} REAL`);
    });
    headers.push('Celkem YOY', 'Celkem PLAN', 'Celkem REAL');

    const rows: string[][] = [];

    filteredData.forEach(category => {
      category.items.forEach(item => {
        const row = [category.name, item.code, item.country, item.description];
        visibleMonths.forEach(monthNum => {
          const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
          const data = item.monthlyData[monthKey] || { yoy: 0, plan: 0, real: 0 };
          row.push(String(data.yoy), String(data.plan), String(data.real));
        });
        row.push(
          String(getItemYearTotal(item, 'yoy')),
          String(getItemYearTotal(item, 'plan')),
          String(getItemYearTotal(item, 'real'))
        );
        rows.push(row);
      });
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `budget_pivot_${selectedYear}.csv`;
    link.click();
  };

  // Month range selector
  const monthRanges = [
    { label: 'Q1', months: [1, 2, 3] },
    { label: 'Q2', months: [4, 5, 6] },
    { label: 'Q3', months: [7, 8, 9] },
    { label: 'Q4', months: [10, 11, 12] },
    { label: 'H1', months: [1, 2, 3, 4, 5, 6] },
    { label: 'H2', months: [7, 8, 9, 10, 11, 12] },
    { label: 'Celý rok', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ];

  return (
    <div className="max-w-full mx-auto p-6 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 min-h-screen font-sans">
      {/* Header */}
      <div className="mb-6 bg-white shadow-lg rounded-2xl p-6 border border-purple-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              Kontingenční tabulka - Marketing Budget {selectedYear}
            </h1>
            <p className="text-gray-600 mt-1">Přehled YOY / PLAN / REAL dle projektů a měsíců</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters and controls */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Hledat účet nebo popis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-64"
            />
          </div>

          {/* Country filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">Všechny země</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>

          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>

          {/* Month range selector */}
          <div className="flex items-center gap-2">
            {monthRanges.map(range => (
              <button
                key={range.label}
                onClick={() => setVisibleMonths(range.months)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  JSON.stringify(visibleMonths) === JSON.stringify(range.months)
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Expand/Collapse buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={expandAll}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              Rozbalit vše
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Sbalit vše
            </button>
          </div>
        </div>
      </div>

      {/* Pivot Table */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-purple-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Month headers */}
              <tr className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white">
                <th className="p-3 text-left font-bold sticky left-0 bg-gradient-to-r from-pink-500 to-pink-500 z-20 min-w-[300px]">
                  Projekt / Účet
                </th>
                {visibleMonths.map(monthNum => (
                  <th key={monthNum} colSpan={3} className="p-3 text-center font-bold border-l border-purple-400">
                    {months[monthNum - 1]}
                  </th>
                ))}
                <th colSpan={3} className="p-3 text-center font-bold border-l-2 border-yellow-400 bg-gradient-to-r from-yellow-500 to-orange-500">
                  CELKEM
                </th>
              </tr>
              {/* Sub-headers (YOY, PLAN, REAL) */}
              <tr className="bg-purple-100 text-purple-900">
                <th className="p-2 text-left font-semibold sticky left-0 bg-purple-100 z-20">
                  Kód / Popis
                </th>
                {visibleMonths.map(monthNum => (
                  <React.Fragment key={monthNum}>
                    <th className="p-2 text-right font-medium border-l border-purple-200 w-28 bg-blue-50">YOY</th>
                    <th className="p-2 text-right font-medium w-28 bg-green-50">PLAN</th>
                    <th className="p-2 text-right font-medium w-28 bg-orange-50">REAL</th>
                  </React.Fragment>
                ))}
                <th className="p-2 text-right font-medium border-l-2 border-yellow-400 w-28 bg-blue-100">YOY</th>
                <th className="p-2 text-right font-medium w-28 bg-green-100">PLAN</th>
                <th className="p-2 text-right font-medium w-28 bg-orange-100">REAL</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((category, catIndex) => {
                const isExpanded = expandedCategories.has(category.name);

                return (
                  <React.Fragment key={category.name}>
                    {/* Category row (summary) */}
                    <tr
                      className={`bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 cursor-pointer font-semibold border-t-2 border-purple-200 ${catIndex === 0 ? 'border-t-0' : ''}`}
                      onClick={() => toggleCategory(category.name)}
                    >
                      <td className="p-3 sticky left-0 bg-gradient-to-r from-purple-50 to-purple-50 z-10">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-purple-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-purple-600" />
                          )}
                          <span className="text-purple-800">{category.name}</span>
                          <span className="text-xs text-purple-500 ml-2">({category.items.length} položek)</span>
                        </div>
                      </td>
                      {visibleMonths.map(monthNum => {
                        const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
                        const totals = getCategoryTotals(category, monthKey);
                        return (
                          <React.Fragment key={monthNum}>
                            <td className="p-2 text-right border-l border-purple-100 bg-blue-50/50">{formatCurrency(totals.yoy)}</td>
                            <td className="p-2 text-right bg-green-50/50">{formatCurrency(totals.plan)}</td>
                            <td className="p-2 text-right bg-orange-50/50">
                              <div className="flex items-center justify-end gap-1">
                                {formatCurrency(totals.real)}
                                {getVarianceIndicator(totals.plan, totals.real)}
                              </div>
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="p-2 text-right border-l-2 border-yellow-400 bg-blue-100/50 font-bold">
                        {formatCurrency(getCategoryYearTotal(category, 'yoy'))}
                      </td>
                      <td className="p-2 text-right bg-green-100/50 font-bold">
                        {formatCurrency(getCategoryYearTotal(category, 'plan'))}
                      </td>
                      <td className="p-2 text-right bg-orange-100/50 font-bold">
                        {formatCurrency(getCategoryYearTotal(category, 'real'))}
                      </td>
                    </tr>

                    {/* Expanded items */}
                    {isExpanded && category.items.map((item, itemIndex) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 ${itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                      >
                        <td className="p-2 pl-10 sticky left-0 bg-white z-10 border-l-4 border-purple-200">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{item.code}</span>
                            <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{item.country}</span>
                            <span className="text-gray-700">{item.description}</span>
                          </div>
                        </td>
                        {visibleMonths.map(monthNum => {
                          const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
                          const data = item.monthlyData[monthKey] || { yoy: 0, plan: 0, real: 0 };
                          return (
                            <React.Fragment key={monthNum}>
                              <td className="p-2 text-right border-l border-gray-100 text-gray-600">{formatCurrency(data.yoy)}</td>
                              <td className="p-2 text-right text-gray-600">{formatCurrency(data.plan)}</td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1 text-gray-700">
                                  {formatCurrency(data.real)}
                                  {getVarianceIndicator(data.plan, data.real)}
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="p-2 text-right border-l-2 border-yellow-300 text-gray-700 font-medium">
                          {formatCurrency(getItemYearTotal(item, 'yoy'))}
                        </td>
                        <td className="p-2 text-right text-gray-700 font-medium">
                          {formatCurrency(getItemYearTotal(item, 'plan'))}
                        </td>
                        <td className="p-2 text-right text-gray-700 font-medium">
                          {formatCurrency(getItemYearTotal(item, 'real'))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Grand Total row */}
              <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold border-t-4 border-purple-500">
                <td className="p-4 sticky left-0 bg-gray-800 z-10 text-lg">
                  CELKEM
                </td>
                {visibleMonths.map(monthNum => {
                  const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
                  const totals = getGrandTotals(monthKey);
                  return (
                    <React.Fragment key={monthNum}>
                      <td className="p-3 text-right border-l border-gray-600">{formatCurrency(totals.yoy)}</td>
                      <td className="p-3 text-right">{formatCurrency(totals.plan)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(totals.real)}
                          {getVarianceIndicator(totals.plan, totals.real)}
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-3 text-right border-l-2 border-yellow-400 bg-yellow-600 text-lg">
                  {formatCurrency(getGrandYearTotal('yoy'))}
                </td>
                <td className="p-3 text-right bg-green-600 text-lg">
                  {formatCurrency(getGrandYearTotal('plan'))}
                </td>
                <td className="p-3 text-right bg-orange-600 text-lg">
                  {formatCurrency(getGrandYearTotal('real'))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white shadow-lg rounded-2xl p-6 border border-purple-100">
        <h3 className="text-lg font-bold text-purple-600 mb-4">Legenda</h3>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <span className="text-sm text-gray-600"><strong>YOY</strong> - Hodnoty z předchozího roku (Year-over-Year)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded"></div>
            <span className="text-sm text-gray-600"><strong>PLAN</strong> - Plánované hodnoty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 rounded"></div>
            <span className="text-sm text-gray-600"><strong>REAL</strong> - Skutečné hodnoty (realita)</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600">Překročení plánu o více než 5%</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">Úspora oproti plánu o více než 5%</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="text-sm text-gray-500 mb-1">Celkem YOY</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(getGrandYearTotal('yoy'))}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="text-sm text-gray-500 mb-1">Celkem PLAN</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(getGrandYearTotal('plan'))}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="text-sm text-gray-500 mb-1">Celkem REAL</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(getGrandYearTotal('real'))}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="text-sm text-gray-500 mb-1">Počet kategorií</div>
          <div className="text-2xl font-bold text-purple-600">{filteredData.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            {filteredData.reduce((sum, cat) => sum + cat.items.length, 0)} účtů celkem
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetPivotTable;
