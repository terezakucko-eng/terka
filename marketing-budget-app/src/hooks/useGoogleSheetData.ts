import { useState, useEffect } from 'react';
import type { BudgetCategory, BudgetItem } from '../data/budgetData';

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLHTV_TNKT0mScyjApOvtPfb8ZpGo5bBLVDude23aPRjTHfw13dDFAMgqNcg7FspAZSjJd1clvPxjL/pub?output=csv';

// Category colors mapping
const categoryColors: Record<string, string> = {
  'MARKETING - DÁRKY': '#ec4899',
  'MARKETING - TV + RÁDIO, billboardy': '#8b5cf6',
  'MARKETING - PPC + výkonnostní MKG': '#3b82f6',
  'MARKETING - ostatní': '#10b981',
  'EXTERNÍ SLUŽBY': '#f59e0b',
  'IT': '#6366f1',
  'SLUŽBY, REŽIJNÍ NÁKLADY': '#14b8a6',
  'MZDY': '#ef4444',
};

interface UseGoogleSheetDataResult {
  budgetData: BudgetCategory[];
  grandTotal: {
    monthly: number[];
    total: number;
    percentage: number;
  };
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      if (char === '\r') i++;
    } else if (char !== '\r') {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumber(value: string): number {
  if (!value || value === '-' || value === '') return 0;
  // Remove spaces, replace comma with dot for decimals
  const cleaned = value.replace(/\s/g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function processSheetData(rows: string[][]): { categories: BudgetCategory[]; grandTotal: { monthly: number[]; total: number; percentage: number } } {
  const categories: BudgetCategory[] = [];
  let currentCategory: BudgetCategory | null = null;
  let grandTotalMonthly: number[] = new Array(12).fill(0);
  let grandTotalSum = 0;

  // Skip header rows - find where data starts
  let dataStartIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.includes('MARKETING') || rows[i][0]?.includes('EXTERNÍ') || rows[i][0]?.includes('MZDY') || rows[i][0]?.includes('IT') || rows[i][0]?.includes('SLUŽBY')) {
      dataStartIndex = i;
      break;
    }
  }

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const firstCell = row[0]?.trim() || '';

    // Skip empty rows or total rows
    if (!firstCell || firstCell === 'CELKEM' || firstCell.startsWith('CELKEM')) {
      // If this is the grand total row, parse it
      if (firstCell === 'CELKEM' || firstCell.startsWith('CELKEM')) {
        for (let m = 0; m < 12; m++) {
          const monthValue = parseNumber(row[m + 4] || '0');
          grandTotalMonthly[m] = monthValue;
        }
        grandTotalSum = parseNumber(row[16] || '0');
      }
      continue;
    }

    // Check if this is a category header (starts with MARKETING, EXTERNÍ, IT, SLUŽBY, MZDY)
    const isCategory = firstCell.startsWith('MARKETING') ||
                       firstCell.startsWith('EXTERNÍ') ||
                       firstCell === 'IT' ||
                       firstCell.startsWith('SLUŽBY') ||
                       firstCell === 'MZDY';

    if (isCategory) {
      // Save previous category
      if (currentCategory && currentCategory.items.length > 0) {
        // Calculate category total from items
        currentCategory.total = currentCategory.items.reduce((sum, item) => sum + item.total, 0);
        categories.push(currentCategory);
      }

      // Create new category
      currentCategory = {
        id: firstCell.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        name: firstCell,
        color: categoryColors[firstCell] || '#64748b',
        icon: '',
        items: [],
        total: 0,
        percentage: 0,
      };
    } else if (currentCategory) {
      // This is a budget item
      const accountCode = row[1]?.trim() || '';
      const name = row[2]?.trim() || firstCell;
      const note = row[3]?.trim() || '';

      // Parse monthly values (columns 4-15 typically)
      const monthly: number[] = [];
      for (let m = 0; m < 12; m++) {
        monthly.push(parseNumber(row[m + 4] || '0'));
      }

      // Parse total (column 16 typically)
      const total = parseNumber(row[16] || '0');

      if (name && (total > 0 || monthly.some(v => v > 0))) {
        const item: BudgetItem = {
          id: `${currentCategory.id}-${currentCategory.items.length + 1}`,
          accountCode,
          name,
          note: note || undefined,
          monthly,
          total: total || monthly.reduce((sum, v) => sum + v, 0),
        };
        currentCategory.items.push(item);
      }
    }
  }

  // Don't forget the last category
  if (currentCategory && currentCategory.items.length > 0) {
    currentCategory.total = currentCategory.items.reduce((sum, item) => sum + item.total, 0);
    categories.push(currentCategory);
  }

  // Calculate percentages
  const totalBudget = categories.reduce((sum, cat) => sum + cat.total, 0);
  categories.forEach(cat => {
    cat.percentage = totalBudget > 0 ? (cat.total / totalBudget) * 100 : 0;
  });

  // If grand total wasn't found, calculate it
  if (grandTotalSum === 0) {
    grandTotalSum = totalBudget;
    grandTotalMonthly = new Array(12).fill(0);
    categories.forEach(cat => {
      cat.items.forEach(item => {
        item.monthly.forEach((val, idx) => {
          grandTotalMonthly[idx] += val;
        });
      });
    });
  }

  return {
    categories,
    grandTotal: {
      monthly: grandTotalMonthly,
      total: grandTotalSum || totalBudget,
      percentage: 100,
    },
  };
}

export function useGoogleSheetData(): UseGoogleSheetDataResult {
  const [budgetData, setBudgetData] = useState<BudgetCategory[]>([]);
  const [grandTotal, setGrandTotal] = useState<{ monthly: number[]; total: number; percentage: number }>({
    monthly: new Array(12).fill(0),
    total: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      const rows = parseCSV(csvText);
      const { categories, grandTotal: total } = processSheetData(rows);

      setBudgetData(categories);
      setGrandTotal(total);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data');
      console.error('Error fetching sheet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    budgetData,
    grandTotal,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}
