import { useState, useEffect } from 'react';
import type { BudgetCategory, BudgetItem, DataViewType, MonthlyData } from '../data/budgetData';

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

interface GrandTotalData {
  monthly: number[];
  monthlyData?: {
    yoy: number[];
    plan: number[];
    real: number[];
  };
  total: number;
  totalYoy?: number;
  totalPlan?: number;
  totalReal?: number;
  percentage: number;
}

interface UseGoogleSheetDataResult {
  budgetData: BudgetCategory[];
  grandTotal: GrandTotalData;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
  dataView: DataViewType;
  setDataView: (view: DataViewType) => void;
  hasMultipleViews: boolean;
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

interface ColumnMapping {
  hasYoyPlanReal: boolean;
  // Fixed columns
  projectColumn: number;  // Projekt
  countryColumn: number;  // Země
  accountColumn: number;  // Účet
  descColumn: number;     // Popis
  noteColumn: number;     // Poznámka
  // For YOY/PLAN/REAL format: each month has 3 columns
  yoyColumns: number[];   // Column indices for YOY months 1-12
  planColumns: number[];  // Column indices for PLAN months 1-12
  realColumns: number[];  // Column indices for REAL months 1-12
  totalYoyColumn: number;
  totalPlanColumn: number;
  totalRealColumn: number;
  // For simple format: just monthly columns
  monthlyColumns: number[];
  totalColumn: number;
}

function detectColumnMapping(headerRow: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    hasYoyPlanReal: false,
    projectColumn: -1,
    countryColumn: -1,
    accountColumn: -1,
    descColumn: -1,
    noteColumn: -1,
    yoyColumns: [],
    planColumns: [],
    realColumns: [],
    totalYoyColumn: -1,
    totalPlanColumn: -1,
    totalRealColumn: -1,
    monthlyColumns: [],
    totalColumn: -1,
  };

  // Look for YOY, PLAN, REAL patterns in headers
  const yoyPattern = /YOY|2025/i;
  const planPattern = /PLAN/i;
  const realPattern = /REAL|SKUT/i;
  const totalPattern = /CELKEM|TOTAL/i;

  headerRow.forEach((header, idx) => {
    const h = header.toUpperCase();

    // Detect fixed columns
    if (/PROJEKT/i.test(header)) {
      mapping.projectColumn = idx;
    } else if (/ZEM[ĚE]/i.test(header) || h === 'COUNTRY') {
      mapping.countryColumn = idx;
    } else if (/[ÚU][ČC]ET/i.test(header) || h === 'ACCOUNT') {
      mapping.accountColumn = idx;
    } else if (/POPIS/i.test(header) || h === 'DESCRIPTION') {
      mapping.descColumn = idx;
    } else if (/POZN[ÁA]MKA/i.test(header) || h === 'NOTE') {
      mapping.noteColumn = idx;
    }
    // Check for YOY/PLAN/REAL columns
    else if (yoyPattern.test(header)) {
      if (totalPattern.test(header)) {
        mapping.totalYoyColumn = idx;
      } else {
        mapping.yoyColumns.push(idx);
      }
    } else if (planPattern.test(header)) {
      if (totalPattern.test(header)) {
        mapping.totalPlanColumn = idx;
      } else {
        mapping.planColumns.push(idx);
      }
    } else if (realPattern.test(header)) {
      if (totalPattern.test(header)) {
        mapping.totalRealColumn = idx;
      } else {
        mapping.realColumns.push(idx);
      }
    } else if (totalPattern.test(header) && !h.includes('%')) {
      mapping.totalColumn = idx;
    } else if (/^\d+$/.test(h) || /^(0?[1-9]|1[0-2])$/.test(h)) {
      // Column is just a month number
      mapping.monthlyColumns.push(idx);
    }
  });

  // Determine if we have YOY/PLAN/REAL structure
  mapping.hasYoyPlanReal = mapping.yoyColumns.length >= 12 ||
                           mapping.planColumns.length >= 12 ||
                           mapping.realColumns.length >= 12;

  // If no monthly columns found, use a default range (columns 4-15 for months)
  if (mapping.monthlyColumns.length === 0 && !mapping.hasYoyPlanReal) {
    for (let i = 4; i < 16; i++) {
      if (i < headerRow.length) {
        mapping.monthlyColumns.push(i);
      }
    }
  }

  // Default column positions if not found in headers
  if (mapping.projectColumn === -1) mapping.projectColumn = 0;
  if (mapping.countryColumn === -1) mapping.countryColumn = 1;
  if (mapping.accountColumn === -1) mapping.accountColumn = 2;
  if (mapping.descColumn === -1) mapping.descColumn = 3;
  if (mapping.noteColumn === -1) mapping.noteColumn = 4;

  // Default total column if not found
  if (mapping.totalColumn === -1) {
    mapping.totalColumn = 16;
  }

  return mapping;
}

function processSheetData(rows: string[][]): {
  categories: BudgetCategory[];
  grandTotal: GrandTotalData;
  hasMultipleViews: boolean;
} {
  const categories: BudgetCategory[] = [];
  let currentCategory: BudgetCategory | null = null;
  let grandTotalMonthly: number[] = new Array(12).fill(0);
  let grandTotalSum = 0;
  let hasMultipleViews = false;

  // Find header row
  let headerRowIndex = -1;
  let columnMapping: ColumnMapping | null = null;

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    // Look for a row that might be headers (contains YOY, PLAN, REAL or month numbers)
    if (row.some(cell => /YOY|PLAN|REAL|CELKEM|^\d{1,2}$/i.test(cell))) {
      headerRowIndex = i;
      columnMapping = detectColumnMapping(row);
      break;
    }
  }

  // If no header row found, use defaults
  if (!columnMapping) {
    columnMapping = {
      hasYoyPlanReal: false,
      projectColumn: 0,
      countryColumn: 1,
      accountColumn: 2,
      descColumn: 3,
      noteColumn: 4,
      yoyColumns: [],
      planColumns: [],
      realColumns: [],
      totalYoyColumn: -1,
      totalPlanColumn: -1,
      totalRealColumn: -1,
      monthlyColumns: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      totalColumn: 17,
    };
  }

  hasMultipleViews = columnMapping.hasYoyPlanReal;

  // Skip header rows - find where data starts
  let dataStartIndex = headerRowIndex + 1;
  for (let i = dataStartIndex; i < rows.length; i++) {
    if (rows[i][0]?.includes('MARKETING') || rows[i][0]?.includes('EXTERNÍ') ||
        rows[i][0]?.includes('MZDY') || rows[i][0]?.includes('IT') ||
        rows[i][0]?.includes('SLUŽBY')) {
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
        if (columnMapping.hasYoyPlanReal) {
          // Parse YOY/PLAN/REAL totals
          // For now, use PLAN as default
          const planCols = columnMapping.planColumns.length > 0 ? columnMapping.planColumns : columnMapping.monthlyColumns;
          for (let m = 0; m < 12 && m < planCols.length; m++) {
            grandTotalMonthly[m] = parseNumber(row[planCols[m]] || '0');
          }
          grandTotalSum = parseNumber(row[columnMapping.totalPlanColumn] || row[columnMapping.totalColumn] || '0');
        } else {
          for (let m = 0; m < 12 && m < columnMapping.monthlyColumns.length; m++) {
            grandTotalMonthly[m] = parseNumber(row[columnMapping.monthlyColumns[m]] || '0');
          }
          grandTotalSum = parseNumber(row[columnMapping.totalColumn] || '0');
        }
      }
      continue;
    }

    // Check if this is a category header
    const isCategory = firstCell.startsWith('MARKETING') ||
                       firstCell.startsWith('EXTERNÍ') ||
                       firstCell === 'IT' ||
                       firstCell.startsWith('SLUŽBY') ||
                       firstCell === 'MZDY';

    if (isCategory) {
      // Save previous category
      if (currentCategory && currentCategory.items.length > 0) {
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
      const project = row[columnMapping.projectColumn]?.trim() || '';
      const country = row[columnMapping.countryColumn]?.trim() || '';
      const accountCode = row[columnMapping.accountColumn]?.trim() || '';
      const name = row[columnMapping.descColumn]?.trim() || firstCell;
      const note = row[columnMapping.noteColumn]?.trim() || '';

      let monthly: number[] = [];
      let monthlyData: MonthlyData | undefined;
      let total = 0;
      let totalYoy = 0;
      let totalPlan = 0;
      let totalReal = 0;

      if (columnMapping.hasYoyPlanReal) {
        // Parse all three data types
        const yoyMonthly: number[] = [];
        const planMonthly: number[] = [];
        const realMonthly: number[] = [];

        for (let m = 0; m < 12; m++) {
          yoyMonthly.push(m < columnMapping.yoyColumns.length ? parseNumber(row[columnMapping.yoyColumns[m]] || '0') : 0);
          planMonthly.push(m < columnMapping.planColumns.length ? parseNumber(row[columnMapping.planColumns[m]] || '0') : 0);
          realMonthly.push(m < columnMapping.realColumns.length ? parseNumber(row[columnMapping.realColumns[m]] || '0') : 0);
        }

        monthlyData = { yoy: yoyMonthly, plan: planMonthly, real: realMonthly };

        // Default to PLAN view
        monthly = planMonthly;

        totalYoy = columnMapping.totalYoyColumn >= 0 ? parseNumber(row[columnMapping.totalYoyColumn] || '0') : yoyMonthly.reduce((s, v) => s + v, 0);
        totalPlan = columnMapping.totalPlanColumn >= 0 ? parseNumber(row[columnMapping.totalPlanColumn] || '0') : planMonthly.reduce((s, v) => s + v, 0);
        totalReal = columnMapping.totalRealColumn >= 0 ? parseNumber(row[columnMapping.totalRealColumn] || '0') : realMonthly.reduce((s, v) => s + v, 0);

        total = totalPlan; // Default to PLAN
      } else {
        // Simple format - just monthly columns
        for (let m = 0; m < 12 && m < columnMapping.monthlyColumns.length; m++) {
          monthly.push(parseNumber(row[columnMapping.monthlyColumns[m]] || '0'));
        }
        // Pad to 12 months if needed
        while (monthly.length < 12) monthly.push(0);

        total = parseNumber(row[columnMapping.totalColumn] || '0');
        if (total === 0) {
          total = monthly.reduce((sum, v) => sum + v, 0);
        }
      }

      if (name && (total > 0 || monthly.some(v => v > 0))) {
        const item: BudgetItem = {
          id: `${currentCategory.id}-${currentCategory.items.length + 1}`,
          project: project || undefined,
          country: country || undefined,
          accountCode,
          name,
          note: note || undefined,
          monthly,
          monthlyData,
          total,
          totalYoy: totalYoy || undefined,
          totalPlan: totalPlan || undefined,
          totalReal: totalReal || undefined,
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
    hasMultipleViews,
  };
}

export function useGoogleSheetData(): UseGoogleSheetDataResult {
  const [budgetData, setBudgetData] = useState<BudgetCategory[]>([]);
  const [grandTotal, setGrandTotal] = useState<GrandTotalData>({
    monthly: new Array(12).fill(0),
    total: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataView, setDataView] = useState<DataViewType>('plan');
  const [hasMultipleViews, setHasMultipleViews] = useState(false);

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
      const { categories, grandTotal: total, hasMultipleViews: multiView } = processSheetData(rows);

      setBudgetData(categories);
      setGrandTotal(total);
      setHasMultipleViews(multiView);
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

  // Function to get data for the current view
  const getViewData = (): { data: BudgetCategory[]; total: GrandTotalData } => {
    if (!hasMultipleViews) {
      return { data: budgetData, total: grandTotal };
    }

    // Transform data based on selected view
    const transformedData = budgetData.map(cat => ({
      ...cat,
      items: cat.items.map(item => {
        if (!item.monthlyData) return item;

        let monthly: number[];
        let total: number;

        switch (dataView) {
          case 'yoy':
            monthly = item.monthlyData.yoy;
            total = item.totalYoy || monthly.reduce((s, v) => s + v, 0);
            break;
          case 'real':
            monthly = item.monthlyData.real;
            total = item.totalReal || monthly.reduce((s, v) => s + v, 0);
            break;
          case 'plan':
          default:
            monthly = item.monthlyData.plan;
            total = item.totalPlan || monthly.reduce((s, v) => s + v, 0);
        }

        return { ...item, monthly, total };
      }),
      total: 0, // Will be recalculated
    }));

    // Recalculate category totals
    transformedData.forEach(cat => {
      cat.total = cat.items.reduce((sum, item) => sum + item.total, 0);
    });

    // Recalculate grand total
    const totalBudget = transformedData.reduce((sum, cat) => sum + cat.total, 0);
    const totalMonthly = new Array(12).fill(0);
    transformedData.forEach(cat => {
      cat.items.forEach(item => {
        item.monthly.forEach((val, idx) => {
          totalMonthly[idx] += val;
        });
      });
    });

    // Recalculate percentages
    transformedData.forEach(cat => {
      cat.percentage = totalBudget > 0 ? (cat.total / totalBudget) * 100 : 0;
    });

    return {
      data: transformedData,
      total: {
        monthly: totalMonthly,
        total: totalBudget,
        percentage: 100,
      },
    };
  };

  const viewData = getViewData();

  return {
    budgetData: viewData.data,
    grandTotal: viewData.total,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    dataView,
    setDataView,
    hasMultipleViews,
  };
}
