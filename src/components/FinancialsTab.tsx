import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  Car, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CalendarDays,
  Calculator, 
  Edit3, 
  Check, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Clock,
  ShieldCheck,
  ArrowRight,
  Table,
  LayoutList,
  RotateCcw,
  CalendarRange,
  SlidersHorizontal,
  Layers,
  Filter,
  Coins,
  Scale
} from 'lucide-react';
import { Vehicle, FutureExpense, Transaction, Rental } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { 
  getEffectiveRentalPaymentWeekday, 
  getWeekdayName, 
  WEEKDAY_OPTIONS 
} from './RentalsTab';
import { 
  FutureExpensesForecastModal, 
  MonthProjectionData, 
  ProjectedExpenseItem,
  MonthRevenueProjectionData,
  ProjectedRevenueItem
} from './FutureExpensesForecastModal';
import { PeriodFilterAutonomousView } from './PeriodFilterAutonomousView';

interface FinancialsTabProps {
  vehicles: Vehicle[];
  futureExpenses: FutureExpense[];
  transactions: Transaction[];
  rentals?: Rental[];
  onUpdateVehicle: (id: string, updatedFields: Partial<Vehicle>) => void;
}

export interface DailyExpenseGroup {
  dateStr: string;
  dayNumber: number;
  dayName: string;
  shortDayName: string;
  formattedDate: string;
  fullFormattedDate: string;
  totalValue: number;
  items: ProjectedExpenseItem[];
}

export interface DailyRevenueGroup {
  dateStr: string;
  dayNumber: number;
  dayName: string;
  shortDayName: string;
  formattedDate: string;
  fullFormattedDate: string;
  totalValue: number;
  items: ProjectedRevenueItem[];
}

export function FinancialsTab({ 
  vehicles, 
  futureExpenses, 
  transactions, 
  rentals = [],
  onUpdateVehicle 
}: FinancialsTabProps) {
  
  // Local state for editing vehicle estimated values
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [subView, setSubView] = useState<'overview' | 'forecast_report' | 'period_filter'>('overview');
  const [forecastReportTab, setForecastReportTab] = useState<'despesas' | 'receitas' | 'comparativo'>('despesas');
  const [forecastViewTab, setForecastViewTab] = useState<'both' | 'despesas' | 'receitas' | 'liquido'>('both');

  const openForecastReportPage = (tab: 'despesas' | 'receitas' | 'comparativo' = 'despesas') => {
    setForecastReportTab(tab);
    setSubView('forecast_report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper for currency formatting
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // 1. CASH BALANCE (computed from all historical non-deleted transactions)
  const cashBalance = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const effectiveTransactions = transactions.filter(t => t.date <= todayStr);

    const totalRevenues = effectiveTransactions
      .filter((t) => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const totalExpenses = effectiveTransactions
      .filter((t) => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesReceived = effectiveTransactions
      .filter((t) => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesReturned = effectiveTransactions
      .filter((t) => t.type === 'caucao_devolvido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesRetained = effectiveTransactions
      .filter((t) => t.type === 'receita' && (t.category === 'Retenção de Caução' || t.category.includes('Retenção')))
      .reduce((sum, t) => sum + t.value, 0);

    const netCaucao = Math.max(0, caucoesReceived - caucoesReturned - caucoesRetained);
    return totalRevenues + netCaucao - totalExpenses;
  }, [transactions]);

  // 2. ASSETS: Sum of all non-deleted vehicles' estimated market value
  const activeVehicles = useMemo(() => {
    return vehicles.filter(v => !v.isDeleted);
  }, [vehicles]);

  const totalAssetsValue = useMemo(() => {
    return activeVehicles.reduce((sum, v) => sum + (v.estimatedValue || 0), 0);
  }, [activeVehicles]);

  // Handle saving editable estimated price
  const handleSaveEstimatedValue = (id: string) => {
    const numVal = parseFloat(editValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(numVal) && numVal >= 0) {
       onUpdateVehicle(id, {
         estimatedValue: numVal,
         estimatedValueDate: getBrasiliaDateStr()
       });
    }
    setEditingVehicleId(null);
    setEditValue('');
  };

  // 3. CONSOLIDATED LIABILITIES
  // Sum of all installments due (status === 'pending') across IPVA, Financing, or Insurance
  const consolidatedLiabilitiesBreakdown = useMemo(() => {
    let financing = 0;
    let ipva = 0;
    let insurance = 0;

    futureExpenses.forEach(exp => {
      const cat = exp.category.toLowerCase();
      const pendingInstallments = exp.installments.filter(inst => inst.status === 'pending');
      const sumValue = pendingInstallments.length * exp.value;

      if (cat.includes('financiamento') || cat.includes('parcela') || cat.includes('leasing')) {
        financing += sumValue;
      } else if (cat.includes('ipva') || cat.includes('imposto')) {
        ipva += sumValue;
      } else if (cat.includes('seguro') || cat.includes('protect')) {
        insurance += sumValue;
      }
    });

    return {
      financing,
      ipva,
      insurance,
      total: financing + ipva + insurance
    };
  }, [futureExpenses]);

  // 4. FLOATING LIABILITIES (unplanned/routine installment expenses like tires, unbudgeted supplies, etc.)
  // Sum of all pending installments that are NOT IPVA, Financing, or Insurance
  const floatingLiabilitiesValue = useMemo(() => {
    let floatTotal = 0;
    futureExpenses.forEach(exp => {
      const cat = exp.category.toLowerCase();
      const isConsolidated = 
        cat.includes('financiamento') || cat.includes('parcela') || cat.includes('leasing') ||
        cat.includes('ipva') || cat.includes('imposto') ||
        cat.includes('seguro') || cat.includes('protect');

      if (!isConsolidated) {
        const pendingInsts = exp.installments.filter(i => i.status === 'pending');
        floatTotal += pendingInsts.length * exp.value;
      }
    });
    return floatTotal;
  }, [futureExpenses]);

  // 4.5. 12-MONTH FUTURE EXPENSES PROJECTION (All scheduled expenses & pending installments)
  const next12MonthsProjection: MonthProjectionData[] = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const [currentYear, currentMonth] = todayStr.split('-').map(Number);

    // Track transaction IDs that were already converted from realized installments to avoid duplicates
    const realizedTxIds = new Set<string>();
    futureExpenses.forEach(fe => {
      (fe.installments || []).forEach(inst => {
        if (inst.realizedTransactionId) {
          realizedTxIds.add(inst.realizedTransactionId);
        }
      });
    });

    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));
    const result: MonthProjectionData[] = [];

    for (let i = 1; i <= 12; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const dateObj = new Date(y, m - 1, 1);
      const rawMonthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
      const capitalizedMonthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const shortMonthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const capitalizedShort = shortMonthName.charAt(0).toUpperCase() + shortMonthName.slice(1);

      const items: ProjectedExpenseItem[] = [];

      // 1. Pending installments from registered future expenses
      futureExpenses.forEach(exp => {
        (exp.installments || []).forEach(inst => {
          if (inst.status === 'pending' || !inst.status) {
            if (inst.dueDate && inst.dueDate.startsWith(monthKey)) {
              const veh = exp.vehicleId ? vehiclesMap.get(exp.vehicleId) : undefined;
              items.push({
                id: `fe_${exp.id}_${inst.id}`,
                source: 'parcelamento',
                title: exp.category,
                description: exp.description || '',
                category: exp.category,
                dueDate: inst.dueDate,
                installmentNumber: inst.installmentNumber,
                installmentsCount: exp.installmentsCount,
                installmentLabel: `Parc. ${inst.installmentNumber}/${exp.installmentsCount}`,
                value: exp.value,
                vehicleId: exp.vehicleId,
                vehiclePlate: veh?.plate,
                vehicleModel: veh?.brandModel
              });
            }
          }
        });
      });

      // 2. Direct future scheduled transactions in cash flow
      transactions.forEach(t => {
        if (t.type === 'despesa' && t.date && t.date.startsWith(monthKey) && t.date > todayStr) {
          if (!realizedTxIds.has(t.id)) {
            const veh = t.vehicleId ? vehiclesMap.get(t.vehicleId) : undefined;
            items.push({
              id: `tx_${t.id}`,
              source: 'programada',
              title: t.category,
              description: t.description || '',
              category: t.category,
              dueDate: t.date,
              installmentLabel: 'Despesa Programada Direta',
              value: t.value,
              vehicleId: t.vehicleId,
              vehiclePlate: veh?.plate,
              vehicleModel: veh?.brandModel
            });
          }
        }
      });

      // Sort items chronologically
      items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const totalValue = items.reduce((sum, item) => sum + item.value, 0);

      result.push({
        index: i,
        year: y,
        month: m,
        monthKey,
        label: `${capitalizedMonthName} de ${y}`,
        shortLabel: `${capitalizedShort}/${String(y).slice(-2)}`,
        isNextMonth: i === 1,
        totalValue,
        items
      });
    }

    return result;
  }, [futureExpenses, transactions, vehicles]);

  // Derived metrics for future projection
  const nextMonthData = next12MonthsProjection[0];
  const total12MonthsFutureExpenses = useMemo(() => {
    return next12MonthsProjection.reduce((sum, m) => sum + m.totalValue, 0);
  }, [next12MonthsProjection]);
  const averageMonthlyFutureExpenses = total12MonthsFutureExpenses / 12;
  const maxMonthProjectionValue = useMemo(() => {
    return Math.max(...next12MonthsProjection.map(m => m.totalValue), 1);
  }, [next12MonthsProjection]);

  // 4.6. 12-MONTH FUTURE REVENUE PROJECTION (Active rental contracts recurring weekly rent + scheduled direct revenues)
  const next12MonthsRevenueProjection: MonthRevenueProjectionData[] = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const [currentYear, currentMonth] = todayStr.split('-').map(Number);
    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));

    // Filter active rentals
    const activeRentals = (rentals || []).filter(r => !r.isDeleted && r.status === 'active');

    const result: MonthRevenueProjectionData[] = [];

    for (let i = 1; i <= 12; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const dateObj = new Date(y, m - 1, 1);
      const rawMonthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
      const capitalizedMonthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const shortMonthName = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const capitalizedShort = shortMonthName.charAt(0).toUpperCase() + shortMonthName.slice(1);

      const items: ProjectedRevenueItem[] = [];

      // Month boundaries
      const daysInMonth = new Date(y, m, 0).getDate();
      const monthStartDateStr = `${monthKey}-01`;
      const monthEndDateStr = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Revenues from Active Rental Contracts (Itemized by driver's exact weekly payment day)
      activeRentals.forEach(r => {
        const veh = vehiclesMap.get(r.vehicleId);
        const weeklyRate = r.weeklyRate || veh?.weeklyRate || 0;
        if (weeklyRate <= 0) return;

        // Se o contrato começa após o encerramento deste mês avaliado, ainda não é faturado nele
        if (r.startDate && r.startDate > monthEndDateStr) return;

        const targetWeekday = getEffectiveRentalPaymentWeekday(r);
        const weekdayName = getWeekdayName(targetWeekday);

        // Find all days in this month that fall on targetWeekday
        const paymentDatesInMonth: string[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(y, m - 1, day);
          if (d.getDay() === targetWeekday) {
            paymentDatesInMonth.push(`${monthKey}-${String(day).padStart(2, '0')}`);
          }
        }

        // Only include payment dates on or after rental startDate
        const validDates = paymentDatesInMonth.filter(dateStr => {
          if (r.startDate && dateStr < r.startDate) return false;
          return true;
        });

        validDates.forEach(dateStr => {
          const [yr, mo, da] = dateStr.split('-');
          items.push({
            id: `rev_rental_${r.id}_${dateStr}`,
            source: 'contrato',
            title: `Aluguel: ${r.tenantName}`,
            description: `Pagamento semanal (${weekdayName})`,
            category: 'Locação Semanal',
            dueDate: dateStr,
            installmentLabel: `Semana de ${da}/${mo}`,
            value: weeklyRate,
            vehicleId: r.vehicleId,
            vehiclePlate: veh?.plate,
            vehicleModel: veh?.brandModel,
            tenantName: r.tenantName
          });
        });
      });

      // 2. Direct future scheduled revenue transactions
      transactions.forEach(t => {
        if (t.type === 'receita' && t.date && t.date.startsWith(monthKey) && t.date > todayStr) {
          const veh = t.vehicleId ? vehiclesMap.get(t.vehicleId) : undefined;
          items.push({
            id: `tx_rev_${t.id}`,
            source: 'programada',
            title: t.category,
            description: t.description || 'Receita programada em fluxo de caixa',
            category: t.category,
            dueDate: t.date,
            installmentLabel: 'Receita Programada Direta',
            value: t.value,
            vehicleId: t.vehicleId,
            vehiclePlate: veh?.plate,
            vehicleModel: veh?.brandModel
          });
        }
      });

      // Sort items chronologically
      items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const totalValue = items.reduce((sum, item) => sum + item.value, 0);

      result.push({
        index: i,
        year: y,
        month: m,
        monthKey,
        label: `${capitalizedMonthName} de ${y}`,
        shortLabel: `${capitalizedShort}/${String(y).slice(-2)}`,
        isNextMonth: i === 1,
        totalValue,
        items
      });
    }

    return result;
  }, [rentals, transactions, vehicles]);

  // Derived metrics for future revenues
  const nextMonthRevenueData = next12MonthsRevenueProjection[0];
  const total12MonthsFutureRevenues = useMemo(() => {
    return next12MonthsRevenueProjection.reduce((sum, m) => sum + m.totalValue, 0);
  }, [next12MonthsRevenueProjection]);
  const averageMonthlyFutureRevenues = total12MonthsFutureRevenues / 12;
  const maxMonthRevenueProjectionValue = useMemo(() => {
    return Math.max(...next12MonthsRevenueProjection.map(m => m.totalValue), 1);
  }, [next12MonthsRevenueProjection]);

  // 1. Independent active selected months for all 3 panels:
  // - selectedNetMonthKey (for Previsão Líquida da Seleção)
  // - selectedRevenueMonthKey (for Expectativa de Receitas)
  // - selectedExpenseMonthKey (for Expectativa de Despesas)
  const [selectedNetMonthKey, setSelectedNetMonthKey] = useState<string>('');
  const [selectedRevenueMonthKey, setSelectedRevenueMonthKey] = useState<string>('');
  const [selectedExpenseMonthKey, setSelectedExpenseMonthKey] = useState<string>('');

  // Breakdown lists visibility state (collapsed by default, toggled via arrow button)
  const [showExpenseItems, setShowExpenseItems] = useState<boolean>(false);
  const [showRevenueItems, setShowRevenueItems] = useState<boolean>(false);

  const activeNetMonthKey = selectedNetMonthKey || next12MonthsProjection[0]?.monthKey || '';
  const activeRevenueMonthKey = selectedRevenueMonthKey || next12MonthsRevenueProjection[0]?.monthKey || '';
  const activeExpenseMonthKey = selectedExpenseMonthKey || next12MonthsProjection[0]?.monthKey || '';

  // Data for Previsão Líquida panel (strictly scoped to activeNetMonthKey):
  const activeNetMonthExpenseData = useMemo(() => {
    return next12MonthsProjection.find(m => m.monthKey === activeNetMonthKey) || next12MonthsProjection[0];
  }, [next12MonthsProjection, activeNetMonthKey]);

  const activeNetMonthRevenueData = useMemo(() => {
    return next12MonthsRevenueProjection.find(m => m.monthKey === activeNetMonthKey) || next12MonthsRevenueProjection[0];
  }, [next12MonthsRevenueProjection, activeNetMonthKey]);

  // Data for Expectativa de Receitas panel (strictly scoped to activeRevenueMonthKey):
  const activeRevenueMonthData = useMemo(() => {
    return next12MonthsRevenueProjection.find(m => m.monthKey === activeRevenueMonthKey) || next12MonthsRevenueProjection[0];
  }, [next12MonthsRevenueProjection, activeRevenueMonthKey]);

  // Data for Expectativa de Despesas panel (strictly scoped to activeExpenseMonthKey):
  const activeExpenseMonthData = useMemo(() => {
    return next12MonthsProjection.find(m => m.monthKey === activeExpenseMonthKey) || next12MonthsProjection[0];
  }, [next12MonthsProjection, activeExpenseMonthKey]);

  // Projected Net Calculation for activeNetMonthKey selection:
  const netSelectedRevenueVal = activeNetMonthRevenueData?.totalValue || 0;
  const netSelectedExpenseVal = activeNetMonthExpenseData?.totalValue || 0;
  const netSelectedValue = netSelectedRevenueVal - netSelectedExpenseVal;
  const isNetPositive = netSelectedValue >= 0;

  // 12-Month Net Horizon metrics
  const total12MonthsNet = total12MonthsFutureRevenues - total12MonthsFutureExpenses;
  const averageMonthlyNet = total12MonthsNet / 12;

  // Month-by-month net projection for the 12-month horizon
  const next12MonthsNetProjection = useMemo(() => {
    return next12MonthsRevenueProjection.map((revMonth, index) => {
      const expMonth = next12MonthsProjection[index] || { totalValue: 0, items: [] };
      const netVal = revMonth.totalValue - expMonth.totalValue;
      return {
        monthKey: revMonth.monthKey,
        label: revMonth.label,
        shortLabel: revMonth.shortLabel,
        isNextMonth: revMonth.isNextMonth,
        revenueValue: revMonth.totalValue,
        expenseValue: expMonth.totalValue,
        netValue: netVal,
        isPositive: netVal >= 0
      };
    });
  }, [next12MonthsRevenueProjection, next12MonthsProjection]);

  const maxMonthNetValue = useMemo(() => {
    return Math.max(...next12MonthsNetProjection.map(m => Math.abs(m.netValue)), 1);
  }, [next12MonthsNetProjection]);

  // Operational projected margin (%) for activeNetMonthKey
  const operationalMarginStr = useMemo(() => {
    if (netSelectedRevenueVal <= 0) return netSelectedValue >= 0 ? '0%' : '-100%';
    const pct = ((netSelectedValue / netSelectedRevenueVal) * 100).toFixed(1);
    return `${pct}%`;
  }, [netSelectedRevenueVal, netSelectedValue]);

  // Daily breakdown states for Expectativa de Despesas
  const [selectedExpenseDay, setSelectedExpenseDay] = useState<string>('all');
  const [expenseBreakdownMode, setExpenseBreakdownMode] = useState<'cards' | 'table'>('cards');

  const effectiveSelectedExpenseDay = 
    selectedExpenseDay.startsWith(activeExpenseMonthKey) ? selectedExpenseDay : 'all';

  const dailyExpenseBreakdown: DailyExpenseGroup[] = useMemo(() => {
    if (!activeExpenseMonthData || !activeExpenseMonthData.items) return [];

    const dayMap = new Map<string, ProjectedExpenseItem[]>();
    activeExpenseMonthData.items.forEach((item) => {
      const dateKey = item.dueDate || `${activeExpenseMonthData.monthKey}-01`;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(item);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();

    return sortedDates.map((dateStr) => {
      const items = dayMap.get(dateStr) || [];
      const totalValue = items.reduce((sum, it) => sum + it.value, 0);

      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);

      const weekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dayName = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
      const shortWeekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const shortDayName = shortWeekdayRaw.charAt(0).toUpperCase() + shortWeekdayRaw.slice(1);

      return {
        dateStr,
        dayNumber: d,
        dayName,
        shortDayName,
        formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        fullFormattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        totalValue,
        items
      };
    });
  }, [activeExpenseMonthData]);

  const displayedDailyGroups = useMemo(() => {
    if (effectiveSelectedExpenseDay === 'all') {
      return dailyExpenseBreakdown;
    }
    return dailyExpenseBreakdown.filter(g => g.dateStr === effectiveSelectedExpenseDay);
  }, [dailyExpenseBreakdown, effectiveSelectedExpenseDay]);

  // -------------------------------------------------------------
  // Daily & Period Selection states for Expectativa de Receitas (Intervalo Livre)
  // -------------------------------------------------------------
  // Mode toggle for Expectativa de Receitas (Por Dia vs Tabela)
  const [revenueBreakdownMode, setRevenueBreakdownMode] = useState<'cards' | 'table'>('cards');

  // Group active revenue month items by exact payment day
  const dailyRevenueBreakdown: DailyRevenueGroup[] = useMemo(() => {
    if (!activeRevenueMonthData || !activeRevenueMonthData.items) return [];

    const dayMap = new Map<string, ProjectedRevenueItem[]>();
    activeRevenueMonthData.items.forEach((item) => {
      const dateKey = item.dueDate || `${activeRevenueMonthData.monthKey}-01`;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(item);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();

    return sortedDates.map((dateStr) => {
      const items = dayMap.get(dateStr) || [];
      const totalValue = items.reduce((sum, it) => sum + it.value, 0);

      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);

      const weekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dayName = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
      const shortWeekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const shortDayName = shortWeekdayRaw.charAt(0).toUpperCase() + shortWeekdayRaw.slice(1);

      return {
        dateStr,
        dayNumber: d,
        dayName,
        shortDayName,
        formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        fullFormattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        totalValue,
        items
      };
    });
  }, [activeRevenueMonthData]);

  // -------------------------------------------------------------
  // ABA AUTÔNOMA: RESULTADO FINANCEIRO (Filtros Específicos & Intervalo Livre Complexo / Entre Meses)
  // -------------------------------------------------------------
  const baseProjectedMonthKey = next12MonthsRevenueProjection[0]?.monthKey || '2026-10';
  const defaultInitialStartDate = `${baseProjectedMonthKey}-01`;
  const defaultInitialEndDate = (() => {
    const [y, m] = baseProjectedMonthKey.split('-').map(Number);
    const d = new Date(y, m, 0).getDate();
    return `${baseProjectedMonthKey}-${String(d).padStart(2, '0')}`;
  })();

  const [resultStartDate, setResultStartDate] = useState<string>(defaultInitialStartDate);
  const [resultEndDate, setResultEndDate] = useState<string>(defaultInitialEndDate);
  const [resultViewMode, setResultViewMode] = useState<'split' | 'timeline'>('split');

  // Compute selected dates metadata across months (Sempre Intervalo Livre Complexo)
  const resultSelectionMeta = useMemo(() => {
    const sDate = resultStartDate || defaultInitialStartDate;
    const eDate = resultEndDate || defaultInitialEndDate;
    const actualStart = sDate <= eDate ? sDate : eDate;
    const actualEnd = sDate <= eDate ? eDate : sDate;

    const [startY, startM, startD] = actualStart.split('-').map(Number);
    const [endY, endM, endD] = actualEnd.split('-').map(Number);

    const startDt = new Date(startY, startM - 1, startD);
    const endDt = new Date(endY, endM - 1, endD);
    const diffTime = Math.abs(endDt.getTime() - startDt.getTime());
    const daysCount = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const formattedStart = `${String(startD).padStart(2, '0')}/${String(startM).padStart(2, '0')}/${startY}`;
    const formattedEnd = `${String(endD).padStart(2, '0')}/${String(endM).padStart(2, '0')}/${endY}`;

    const isSameDay = actualStart === actualEnd;
    const isSameMonth = startY === endY && startM === endM;
    const isCrossMonth = !isSameMonth;

    const selectedDateSet = new Set<string>();
    const cur = new Date(actualStart + 'T12:00:00Z');
    const end = new Date(actualEnd + 'T12:00:00Z');
    while (cur <= end) {
      selectedDateSet.add(cur.toISOString().split('T')[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const isFiltered = !(actualStart === defaultInitialStartDate && actualEnd === defaultInitialEndDate);

    let selectionTitle = `Intervalo Livre: ${formattedStart} a ${formattedEnd}`;
    let selectionSubtitle = `${daysCount} ${daysCount === 1 ? 'dia analisado' : 'dias analisados'}`;

    if (isSameDay) {
      const weekdayRaw = startDt.toLocaleDateString('pt-BR', { weekday: 'long' });
      const capitalizedWeekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
      selectionTitle = `Dia ${formattedStart} (${capitalizedWeekday})`;
      selectionSubtitle = `Análise pontual de 1 dia específico`;
    } else if (isSameMonth) {
      const monthName = startDt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      selectionTitle = `Período em ${capitalizedMonth} (${formattedStart} a ${formattedEnd})`;
      selectionSubtitle = `${daysCount} dias selecionados em ${capitalizedMonth}`;
    } else {
      const startMonthName = startDt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
      const endMonthName = endDt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
      selectionTitle = `Período Complexo: ${formattedStart} a ${formattedEnd}`;
      selectionSubtitle = `Recorte entre meses: ${daysCount} dias (${startMonthName}/${startY} a ${endMonthName}/${endY})`;
    }

    return {
      startDate: actualStart,
      endDate: actualEnd,
      daysCount,
      formattedStart,
      formattedEnd,
      selectionTitle,
      selectionSubtitle,
      isSameDay,
      isSameMonth,
      isCrossMonth,
      selectedDateSet,
      isFiltered
    };
  }, [resultStartDate, resultEndDate, defaultInitialStartDate, defaultInitialEndDate]);

  // Derived current month references for single-month context or fallback
  const activeResultMonthKey = resultSelectionMeta.startDate.substring(0, 7);
  const activeResultRevenueMonth = useMemo(() => {
    return next12MonthsRevenueProjection.find(m => m.monthKey === activeResultMonthKey) || next12MonthsRevenueProjection[0];
  }, [next12MonthsRevenueProjection, activeResultMonthKey]);

  const activeResultExpenseMonth = useMemo(() => {
    return next12MonthsProjection.find(m => m.monthKey === activeResultMonthKey) || next12MonthsProjection[0];
  }, [next12MonthsProjection, activeResultMonthKey]);

  // Compute financial result of the selection for autonomous tab (Multi-Month / Cross-Month Engine)
  const autonomousFinancialResult = useMemo(() => {
    const { startDate, endDate } = resultSelectionMeta;
    if (!startDate || !endDate) {
      return {
        revenuesTotal: 0,
        revenuesItems: [],
        expensesTotal: 0,
        expensesItems: [],
        balance: 0,
        revenuesDriversSummary: '',
        expensesSummary: ''
      };
    }

    const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));

    // 1. Calculate revenues in [startDate, endDate]
    const revenuesItems: ProjectedRevenueItem[] = [];
    const txDatesByVehicle = new Map<string, string[]>();

    // A. Actual revenue transactions recorded in ledger within [startDate, endDate]
    transactions.forEach(t => {
      if (t.type === 'receita' && t.date && t.date >= startDate && t.date <= endDate) {
        const veh = t.vehicleId ? vehiclesMap.get(t.vehicleId) : undefined;
        const matchingRental = (rentals || []).find(r => 
          r.vehicleId === t.vehicleId && 
          (!r.startDate || t.date >= r.startDate) && 
          (!r.endDate || t.date <= r.endDate)
        );
        let tenantName = matchingRental?.tenantName;
        if (!tenantName && t.description) {
          const match = t.description.match(/(?:Motorista|Locatário|Leandro|Paulo|Péricles|Alvaro)[\s:]*([A-Za-zÀ-ÿ\s]+)/i);
          if (match) tenantName = match[1].trim();
        }

        revenuesItems.push({
          id: `tx_rev_${t.id}`,
          source: 'programada',
          title: t.category,
          description: t.description || 'Receita realizada',
          category: t.category,
          dueDate: t.date,
          installmentLabel: 'Lançamento Realizado',
          value: t.value,
          vehicleId: t.vehicleId,
          vehiclePlate: veh?.plate,
          vehicleModel: veh?.brandModel,
          tenantName: tenantName || veh?.brandModel || 'Receita'
        });

        if (t.vehicleId) {
          if (!txDatesByVehicle.has(t.vehicleId)) txDatesByVehicle.set(t.vehicleId, []);
          txDatesByVehicle.get(t.vehicleId)!.push(t.date);
        }
      }
    });

    // Helper: Check if a vehicle already has a recorded transaction near a date (within ±3 days)
    const hasTxNearDate = (vehicleId: string, dateStr: string) => {
      const dates = txDatesByVehicle.get(vehicleId);
      if (!dates) return false;
      const targetTime = new Date(dateStr + 'T12:00:00Z').getTime();
      return dates.some(d => {
        const tTime = new Date(d + 'T12:00:00Z').getTime();
        const diffDays = Math.abs(targetTime - tTime) / (1000 * 60 * 60 * 24);
        return diffDays < 4;
      });
    };

    // B. Projected weekly rental revenues from contracts for dates not already covered by recorded transactions
    (rentals || []).filter(r => !r.isDeleted).forEach(r => {
      const veh = vehiclesMap.get(r.vehicleId);
      const weeklyRate = r.weeklyRate || veh?.weeklyRate || 0;
      if (weeklyRate <= 0) return;

      const targetWeekday = getEffectiveRentalPaymentWeekday(r);
      const weekdayName = getWeekdayName(targetWeekday);

      const curr = new Date(startDate + 'T12:00:00Z');
      const end = new Date(endDate + 'T12:00:00Z');

      while (curr <= end) {
        if (curr.getUTCDay() === targetWeekday) {
          const dateStr = curr.toISOString().split('T')[0];
          const afterStart = !r.startDate || dateStr >= r.startDate;
          // Valid during contract period, or continuing into future projection if active
          const beforeEnd = !r.endDate || dateStr <= r.endDate || r.status === 'active';

          if (afterStart && beforeEnd) {
            if (!hasTxNearDate(r.vehicleId, dateStr)) {
              const [yr, mo, da] = dateStr.split('-');
              revenuesItems.push({
                id: `rev_${r.id}_${dateStr}`,
                source: 'contrato',
                title: `Aluguel: ${r.tenantName}`,
                description: `Pagamento semanal (${weekdayName})`,
                category: 'Locação Semanal',
                dueDate: dateStr,
                installmentLabel: `Semana de ${da}/${mo}`,
                value: weeklyRate,
                vehicleId: r.vehicleId,
                vehiclePlate: veh?.plate,
                vehicleModel: veh?.brandModel,
                tenantName: r.tenantName
              });
            }
          }
        }
        curr.setUTCDate(curr.getUTCDate() + 1);
      }
    });

    revenuesItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const revenuesTotal = revenuesItems.reduce((sum, it) => sum + it.value, 0);

    // 2. Calculate expenses in [startDate, endDate]
    const realizedTxIds = new Set<string>();
    futureExpenses.forEach(fe => {
      (fe.installments || []).forEach(inst => {
        if (inst.realizedTransactionId) {
          realizedTxIds.add(inst.realizedTransactionId);
        }
      });
    });

    const expensesItems: ProjectedExpenseItem[] = [];

    // From futureExpenses installments
    futureExpenses.forEach(exp => {
      (exp.installments || []).forEach(inst => {
        if (inst.status === 'pending' || !inst.status) {
          if (inst.dueDate && inst.dueDate >= startDate && inst.dueDate <= endDate) {
            const veh = exp.vehicleId ? vehiclesMap.get(exp.vehicleId) : undefined;
            expensesItems.push({
              id: `fe_${exp.id}_${inst.id}`,
              source: 'parcelamento',
              title: exp.category,
              description: exp.description || '',
              category: exp.category,
              dueDate: inst.dueDate,
              installmentNumber: inst.installmentNumber,
              installmentsCount: exp.installmentsCount,
              installmentLabel: `Parc. ${inst.installmentNumber}/${exp.installmentsCount}`,
              value: exp.value,
              vehicleId: exp.vehicleId,
              vehiclePlate: veh?.plate,
              vehicleModel: veh?.brandModel
            });
          }
        }
      });
    });

    // From direct transactions scheduled in future in range
    transactions.forEach(t => {
      if (t.type === 'despesa' && t.date && t.date >= startDate && t.date <= endDate) {
        if (!realizedTxIds.has(t.id)) {
          const veh = t.vehicleId ? vehiclesMap.get(t.vehicleId) : undefined;
          expensesItems.push({
            id: `tx_${t.id}`,
            source: 'programada',
            title: t.category,
            description: t.description || 'Lançamento agendado',
            category: t.category,
            dueDate: t.date,
            installmentNumber: 1,
            installmentsCount: 1,
            installmentLabel: 'Fixa/Avulsa',
            value: t.value,
            vehicleId: t.vehicleId,
            vehiclePlate: veh?.plate,
            vehicleModel: veh?.brandModel
          });
        }
      }
    });

    expensesItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const expensesTotal = expensesItems.reduce((sum, it) => sum + it.value, 0);

    const balance = revenuesTotal - expensesTotal;

    const driverNames = Array.from(new Set(revenuesItems.map(it => it.tenantName || it.title).filter(Boolean)));
    const revenuesDriversSummary = driverNames.length > 0 
      ? driverNames.join(', ') 
      : 'Sem recebimentos na seleção';

    const expenseCategories = Array.from(new Set(expensesItems.map(it => it.category).filter(Boolean)));
    const expensesSummary = expenseCategories.length > 0
      ? expenseCategories.join(', ')
      : 'Sem despesas na seleção';

    return {
      revenuesTotal,
      revenuesItems,
      expensesTotal,
      expensesItems,
      balance,
      revenuesDriversSummary,
      expensesSummary
    };
  }, [resultSelectionMeta, vehicles, rentals, futureExpenses, transactions]);

  // Breakdown by month when the selected range spans across multiple months
  const crossMonthBreakdown = useMemo(() => {
    if (!resultSelectionMeta.isCrossMonth) return [];

    const monthMap = new Map<string, { label: string; revTotal: number; expTotal: number }>();

    // Pre-populate all months in the selected interval to guarantee complete chronological visibility
    const [startYear, startMonth] = resultSelectionMeta.startDate.split('-').map(Number);
    const [endYear, endMonth] = resultSelectionMeta.endDate.split('-').map(Number);

    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const mKey = `${curY}-${String(curM).padStart(2, '0')}`;
      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, { label: '', revTotal: 0, expTotal: 0 });
      }
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    autonomousFinancialResult.revenuesItems.forEach(it => {
      const monthKey = it.dueDate.substring(0, 7); // YYYY-MM
      const cur = monthMap.get(monthKey) || { label: '', revTotal: 0, expTotal: 0 };
      cur.revTotal += it.value;
      monthMap.set(monthKey, cur);
    });

    autonomousFinancialResult.expensesItems.forEach(it => {
      const monthKey = it.dueDate.substring(0, 7); // YYYY-MM
      const cur = monthMap.get(monthKey) || { label: '', revTotal: 0, expTotal: 0 };
      cur.expTotal += it.value;
      monthMap.set(monthKey, cur);
    });

    const sortedMonths = Array.from(monthMap.keys()).sort();

    return sortedMonths.map(monthKey => {
      const data = monthMap.get(monthKey)!;
      const [y, m] = monthKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, 1);
      const rawMonthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const label = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const shortLabel = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();

      return {
        monthKey,
        label,
        shortLabel: `${shortLabel}/${String(y).slice(2)}`,
        revTotal: data.revTotal,
        expTotal: data.expTotal,
        balance: data.revTotal - data.expTotal
      };
    });
  }, [resultSelectionMeta.isCrossMonth, resultSelectionMeta.startDate, resultSelectionMeta.endDate, autonomousFinancialResult]);

  // Days in range with scheduled financial activity (revenue or expense)
  const allActiveResultDays = useMemo(() => {
    const { revenuesItems, expensesItems } = autonomousFinancialResult;

    const dayMap = new Map<string, { revTotal: number; expTotal: number }>();

    revenuesItems.forEach(it => {
      const cur = dayMap.get(it.dueDate) || { revTotal: 0, expTotal: 0 };
      cur.revTotal += it.value;
      dayMap.set(it.dueDate, cur);
    });

    expensesItems.forEach(it => {
      const cur = dayMap.get(it.dueDate) || { revTotal: 0, expTotal: 0 };
      cur.expTotal += it.value;
      dayMap.set(it.dueDate, cur);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();

    return sortedDates.map(dateStr => {
      const { revTotal, expTotal } = dayMap.get(dateStr)!;
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);

      const weekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dayName = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
      const shortWeekdayRaw = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const shortDayName = shortWeekdayRaw.charAt(0).toUpperCase() + shortWeekdayRaw.slice(1);

      return {
        dateStr,
        dayNumber: d,
        monthNumber: m,
        year: y,
        dayName,
        shortDayName,
        formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
        shortFormattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        revTotal,
        expTotal,
        balance: revTotal - expTotal
      };
    });
  }, [autonomousFinancialResult]);

  const handleSetRangeForMonth = (mKey: string) => {
    const [y, m] = mKey.split('-').map(Number);
    const daysInM = new Date(y, m, 0).getDate();
    setResultStartDate(`${mKey}-01`);
    setResultEndDate(`${mKey}-${String(daysInM).padStart(2, '0')}`);
  };

  const handleSetPresetRange = (monthsSpan: number) => {
    const baseKey = next12MonthsRevenueProjection[0]?.monthKey || '2026-10';
    const [y, m] = baseKey.split('-').map(Number);
    const startStr = `${baseKey}-01`;

    let endM = m + monthsSpan - 1;
    let endY = y;
    while (endM > 12) {
      endM -= 12;
      endY += 1;
    }
    const endMonthKey = `${endY}-${String(endM).padStart(2, '0')}`;
    const daysInEndMonth = new Date(endY, endM, 0).getDate();
    const endStr = `${endMonthKey}-${String(daysInEndMonth).padStart(2, '0')}`;

    setResultStartDate(startStr);
    setResultEndDate(endStr);
  };

  const handleResetResultToDefault = () => {
    setResultStartDate(defaultInitialStartDate);
    setResultEndDate(defaultInitialEndDate);
  };

  const handleResetResultToFullMonth = () => {
    handleSetRangeForMonth(activeResultMonthKey);
  };

  const handleSelectResultSingleDay = (dateStr: string) => {
    if (resultStartDate === dateStr && resultEndDate === dateStr) {
      handleSetRangeForMonth(dateStr.substring(0, 7));
    } else {
      setResultStartDate(dateStr);
      setResultEndDate(dateStr);
    }
  };

  // Helper: Count exact Mondays in a month (representing standard corporate cycles/weeks)
  const countMondaysInMonth = (year: number, monthIndex: number) => {
    let count = 0;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, monthIndex, d);
      if (date.getDay() === 1) { // 1 = Monday
        count++;
      }
    }
    return count || 4;
  };

  // 5. MONTHLY RESULT: performance of each month chronologically
  const monthlyResults = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const resultsMap: Record<string, {
      monthKey: string; // YYYY-MM
      year: number;
      monthIndex: number;
      revenuesSum: number;
      caucaoReceivedSum: number;
      caucaoDevolvidoSum: number;
      caucaoRetainedSum: number;
      expensesSum: number;
      installmentRentalCount: number;
      installmentRentalSum: number;
      expenseTransactionsCount: number;
    }> = {};

    transactions
      .filter(t => t.date <= todayStr)
      .forEach(t => {
      if (!t.date) return;
      const [yearStr, monthStr] = t.date.split('-');
      if (!yearStr || !monthStr) return;
      const monthKey = `${yearStr}-${monthStr}`;
      const year = parseInt(yearStr);
      const monthIndex = parseInt(monthStr) - 1;

      if (!resultsMap[monthKey]) {
        resultsMap[monthKey] = {
          monthKey,
          year,
          monthIndex,
          revenuesSum: 0,
          caucaoReceivedSum: 0,
          caucaoDevolvidoSum: 0,
          caucaoRetainedSum: 0,
          expensesSum: 0,
          installmentRentalCount: 0,
          installmentRentalSum: 0,
          expenseTransactionsCount: 0
        };
      }

      const mData = resultsMap[monthKey];

      if (t.type === 'receita') {
        mData.revenuesSum += t.value;
        if (t.category === 'Retenção de Caução' || t.category.includes('Retenção')) {
          mData.caucaoRetainedSum += t.value;
        }
        if (t.category.toLowerCase().includes('aluguel') || t.category.toLowerCase().includes('locação')) {
          mData.installmentRentalCount += 1;
          mData.installmentRentalSum += t.value;
        }
      } else if (t.type === 'despesa') {
        mData.expensesSum += t.value;
        mData.expenseTransactionsCount += 1;
      } else if (t.type === 'caucao_recebido') {
        mData.caucaoReceivedSum += t.value;
      } else if (t.type === 'caucao_devolvido') {
        mData.caucaoDevolvidoSum += t.value;
      }
    });

    // Make an array sorted chronologically desc
    return Object.values(resultsMap)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [transactions]);

  // Filtered monthly results by chosen year
  const filteredMonthlyResults = useMemo(() => {
    if (!yearFilter) return monthlyResults;
    return monthlyResults.filter(r => r.year.toString() === yearFilter);
  }, [monthlyResults, yearFilter]);

  // Lists of available years for filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    monthlyResults.forEach(r => years.add(r.year.toString()));
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [monthlyResults]);

  // 6 & 7. GENERAL BILLING & GENERAL EXPENSES Sum
  const generalTotals = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const effectiveTransactions = transactions.filter(t => t.date <= todayStr);

    const revenueSum = effectiveTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const expenseSum = effectiveTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesReceived = effectiveTransactions
      .filter((t) => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesReturned = effectiveTransactions
      .filter((t) => t.type === 'caucao_devolvido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesRetained = effectiveTransactions
      .filter((t) => t.type === 'receita' && (t.category === 'Retenção de Caução' || t.category.includes('Retenção')))
      .reduce((sum, t) => sum + t.value, 0);

    const netCaucao = Math.max(0, caucoesReceived - caucoesReturned - caucoesRetained);

    return {
      revenueSum,
      expenseSum,
      netCaucao
    };
  }, [transactions]);

  if (subView === 'forecast_report') {
    return (
      <FutureExpensesForecastModal
        isOpen={true}
        isPageView={true}
        onClose={() => {
          setSubView('overview');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        monthsExpenseProjection={next12MonthsProjection}
        monthsRevenueProjection={next12MonthsRevenueProjection}
        vehicles={vehicles}
        formatBRL={formatBRL}
        initialTab={forecastReportTab}
      />
    );
  }

  if (subView === 'period_filter') {
    return (
      <PeriodFilterAutonomousView
        onClose={() => {
          setSubView('overview');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        vehicles={vehicles}
        futureExpenses={futureExpenses}
        transactions={transactions}
        rentals={rentals || []}
        formatBRL={formatBRL}
        initialStartDate={resultStartDate}
        initialEndDate={resultEndDate}
        cashBalance={cashBalance}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in w-full max-w-full overflow-hidden">
      
      {/* EXECUTIVE COMMAND BAR & PROMINENT AUTONOMOUS FEATURE: FILTRO POR DIA/PERÍODO */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-premium relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Subtle decorative background gradient aura */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-gradient-to-br from-indigo-500/10 via-brand-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 shadow-2xs shrink-0">
              <Coins className="h-4.5 w-4.5" />
            </span>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200/60">
              Módulo Financeiro Geral
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black font-display text-slate-900 tracking-tight">
            Gestão Financeira & Balanço Operacional
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Consolidação do caixa real, faturamento histórico, custos da frota e projeções de contratos.
          </p>
        </div>

        {/* PROMINENT STANDALONE FEATURE BUTTON: FILTRO POR DIA/PERÍODO */}
        <div className="relative z-10 shrink-0">
          <button
            type="button"
            id="open-period-filter-autonomous-btn"
            onClick={() => {
              setSubView('period_filter');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="group relative w-full sm:w-auto inline-flex items-center justify-between gap-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 hover:from-indigo-950 hover:via-indigo-900 hover:to-slate-900 text-white shadow-xl shadow-indigo-950/20 hover:shadow-indigo-900/30 border border-indigo-500/35 hover:border-indigo-400/60 active:scale-[0.98] transition-all duration-300 cursor-pointer overflow-hidden"
            title="Acessar filtro avançado para analisar qualquer dia ou período personalizado"
          >
            {/* Shimmer light sweep animation */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-600/10 text-indigo-300 border border-indigo-400/30 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shrink-0 shadow-inner">
                <SlidersHorizontal className="h-4.5 w-4.5 group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white font-sans">
                FILTRO AVANÇADO
              </span>
            </div>

            <div className="h-7 w-7 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-indigo-200 group-hover:bg-white group-hover:text-indigo-950 group-hover:translate-x-1 transition-all duration-300 shrink-0 ml-1">
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 1: HEADER SUMMARY AND CASH IN HAND */}
      <div className="space-y-4 sm:space-y-6">
        
        {/* CASH BALANCE CARD - STANDS ALONE ABOVE */}
        <div id="financial-cash-card" className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 border border-blue-800/40 rounded-2xl p-4 sm:p-6 text-white shadow-premium relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="h-20 w-20 sm:h-32 sm:w-32 text-white" />
          </div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm tracking-wider uppercase text-blue-100 font-extrabold font-sans">
              Dinheiro em Caixa (Saldo Real)
            </span>
            <span className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] shrink-0">
              <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
          </div>
          <div className="font-mono text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)] break-words select-all">
            {formatBRL(cashBalance)}
          </div>
          <p className="text-[11px] sm:text-xs text-blue-200/90 mt-2 font-medium leading-relaxed">
            Saldo acumulado conciliado com todos os pagamentos e despesas efetivas lançadas.
          </p>
        </div>

        {/* BOTTOM METRICS IN CORRECT SEQUENCE: REVENUE -> EXPENSES -> CAUÇÃO -> RESULT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* GENERAL BILLING CARD */}
          <div id="financial-billing-card" className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-premium flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-extrabold font-black">
                  Faturamento Geral Acumulado
                </span>
                <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
                  <TrendingUp className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl xl:text-3xl font-black text-emerald-600 truncate">
                {formatBRL(generalTotals.revenueSum)}
              </div>
            </div>
            <p className="text-[10px] text-emerald-700/80 mt-2 sm:mt-3 leading-relaxed font-semibold">
              Soma de todo o faturamento histórico de aluguéis e taxas de recarga recebidas.
            </p>
          </div>

          {/* GENERAL EXPENSES CARD */}
          <div id="financial-expenses-card" className="bg-gradient-to-br from-rose-50 to-rose-100/40 rounded-2xl p-4 sm:p-5 border border-rose-200/80 shadow-premium flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-700 font-extrabold font-black">
                  Despesas Gerais Efetivadas
                </span>
                <span className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                  <TrendingDown className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl xl:text-3xl font-black text-rose-800 truncate">
                {formatBRL(generalTotals.expenseSum)}
              </div>
            </div>
            <p className="text-[10px] text-rose-700/80 mt-2 sm:mt-3 leading-relaxed font-semibold">
              Total de gastos operacionais, IPVAs, seguros e financiamentos já liquidados.
            </p>
          </div>

          {/* TOTAL CAUÇÃO IN CUSTODY CARD */}
          <div id="financial-caucao-card" className="bg-gradient-to-br from-blue-50 to-blue-100/40 rounded-2xl p-4 sm:p-5 border border-blue-200/80 shadow-premium flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-700 font-extrabold font-black">
                  Depósitos de Caução Retidos
                </span>
                <span className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="font-mono text-xl sm:text-2xl xl:text-3xl font-black text-blue-600 truncate">
                {formatBRL(generalTotals.netCaucao)}
              </div>
            </div>
            <p className="text-[10px] text-blue-700/80 mt-2 sm:mt-3 leading-relaxed font-semibold">
              Total em garantia custodiada ativa (exclui devoluções e conversões retidas).
            </p>
          </div>

          {/* NET RESULT CARD (RESULTADO ENTRE FATURAMENTO E DESPESAS) */}
          {(() => {
            const netResultValue = generalTotals.revenueSum - generalTotals.expenseSum;
            const isPositive = netResultValue >= 0;
            return (
              <div 
                id="financial-net-result" 
                className={`rounded-2xl p-4 sm:p-5 border shadow-premium flex flex-col justify-between group transition-all duration-300 ${
                  isPositive 
                    ? 'bg-indigo-50/20 border-indigo-200/80 shadow-indigo-500/5' 
                    : 'bg-rose-50/30 border-rose-200/80 shadow-rose-500/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <span className={`text-[10px] font-mono uppercase tracking-widest font-black ${
                      isPositive ? 'text-indigo-700' : 'text-rose-700'
                    }`}>
                      Resultado de Caixa
                    </span>
                    <span className={`p-2 rounded-xl shrink-0 ${
                      isPositive ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </span>
                  </div>
                  <div className={`font-mono text-xl sm:text-2xl xl:text-3xl font-black truncate ${
                    isPositive ? 'text-indigo-600' : 'text-rose-600'
                  }`}>
                    {formatBRL(netResultValue)}
                  </div>
                </div>
                <div>
                  <p className={`text-[10px] mt-2 sm:mt-3 leading-relaxed font-semibold ${
                    isPositive ? 'text-indigo-700/80' : 'text-rose-700/80'
                  }`}>
                    {isPositive ? '✓ Superávit Operacional Geral' : '⚠ Atenção: Defasagem Acumulada'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubView('period_filter');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-2.5 pt-2 border-t border-slate-200/60 w-full flex items-center justify-between text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group/link"
                  >
                    <span>Abrir no Filtro por Período</span>
                    <ArrowRight className="h-3 w-3 text-indigo-500 group-hover/link:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })()}

        </div>
 
      </div>

      {/* SECTION: PLANEJAMENTO & EXPECTATIVA FUTURA (DESPESAS E RECEITAS) */}
      <div className="space-y-4">
        {/* Section Header & View Subtabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600 shrink-0" />
              <span>Expectativa dos Meses Seguintes & Projeção 12 Meses</span>
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Subtab Switcher - Receitas Previstas, Despesas Previstas, Previsão Líquida, Ver Ambas */}
            <div className="grid grid-cols-2 sm:flex sm:items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs font-semibold shadow-2xs gap-1 w-full sm:w-auto">
              <button
                id="forecast-tab-receitas"
                type="button"
                onClick={() => setForecastViewTab('receitas')}
                className={`text-center px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forecastViewTab === 'receitas'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${forecastViewTab === 'receitas' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Receitas</span>
                <span className="hidden xl:inline">Previstas</span>
              </button>
              <button
                id="forecast-tab-despesas"
                type="button"
                onClick={() => setForecastViewTab('despesas')}
                className={`text-center px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forecastViewTab === 'despesas'
                    ? 'bg-rose-600 text-white shadow-xs font-bold ring-1 ring-rose-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <TrendingDown className={`h-3.5 w-3.5 shrink-0 ${forecastViewTab === 'despesas' ? 'text-white' : 'text-rose-500'}`} />
                <span>Despesas</span>
                <span className="hidden xl:inline">Previstas</span>
              </button>
              <button
                id="forecast-tab-liquido"
                type="button"
                onClick={() => setForecastViewTab('liquido')}
                className={`text-center px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forecastViewTab === 'liquido'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold ring-1 ring-indigo-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Scale className={`h-3.5 w-3.5 shrink-0 ${forecastViewTab === 'liquido' ? 'text-white' : 'text-indigo-600'}`} />
                <span>Previsão Líquida</span>
              </button>
              <button
                id="forecast-tab-both"
                type="button"
                onClick={() => setForecastViewTab('both')}
                className={`text-center px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  forecastViewTab === 'both'
                    ? 'bg-slate-900 text-white shadow-xs font-bold ring-1 ring-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Layers className={`h-3.5 w-3.5 shrink-0 ${forecastViewTab === 'both' ? 'text-white' : 'text-slate-500'}`} />
                <span>Ver Ambas</span>
              </button>
            </div>

            {/* Full Report Page Navigation Button */}
            <button
              type="button"
              id="open-full-report-page-btn"
              onClick={() => openForecastReportPage('comparativo')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer w-full sm:w-auto shrink-0"
              title="Acessar página de relatório completo das projeções (12 meses)"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <span>Relatório Completo</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 0. PREVISÃO LÍQUIDA DA SELEÇÃO (IGUAL DESTAQUE AOS VALORES DE RECEITAS E DESPESAS) */}
        {(forecastViewTab === 'both' || forecastViewTab === 'liquido') && (
          <div 
            id="financial-future-net-box"
            className={`bg-white border rounded-2xl p-4 sm:p-6 shadow-premium transition-all duration-200 overflow-hidden ${
              isNetPositive 
                ? 'border-indigo-300/90 shadow-indigo-950/5' 
                : 'border-rose-300/90 shadow-rose-950/5'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              {/* Left side: Mês Selecionado & Valor Líquido com Igual Destaque */}
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap max-w-full">
                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-sans border shadow-2xs shrink-0 whitespace-nowrap ${
                    isNetPositive 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80' 
                      : 'bg-rose-50 text-rose-700 border-rose-200/80'
                  }`}>
                    {isNetPositive ? (
                      <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-600 shrink-0" />
                    ) : (
                      <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-600 shrink-0" />
                    )}
                    <span>Previsão Líquida da Seleção</span>
                  </span>

                  <span className="shrink-0 text-[10px] sm:text-xs text-slate-900 font-mono font-black px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 whitespace-nowrap">
                    {activeNetMonthExpenseData?.label}
                  </span>

                  <span className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isNetPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isNetPositive ? '✓ Superávit Projetado' : '⚠ Déficit Projetado'}
                  </span>
                </div>

                <div>
                  <div className={`font-mono text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight ${
                    isNetPositive ? 'text-indigo-600' : 'text-rose-600'
                  }`}>
                    <span>{isNetPositive ? '+' : ''}{formatBRL(netSelectedValue)}</span>
                  </div>

                  {/* Fórmula visual explicativa com os valores da seleção */}
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap text-xs text-slate-600 font-mono font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <span className="text-slate-400 font-sans text-[11px]">Receitas ({activeNetMonthRevenueData?.shortLabel}):</span>
                      <strong className="font-black">+{formatBRL(netSelectedRevenueVal)}</strong>
                    </span>
                    <span className="text-slate-400 font-bold">−</span>
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <span className="text-slate-400 font-sans text-[11px]">Despesas ({activeNetMonthExpenseData?.shortLabel}):</span>
                      <strong className="font-black">{formatBRL(netSelectedExpenseVal)}</strong>
                    </span>
                    <span className="text-slate-400 font-bold">=</span>
                    <span className="text-slate-700 font-sans font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                      Margem Projetada: <strong className="font-bold text-slate-900">{operationalMarginStr}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: 12-Month Net Horizon */}
              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                <div className="text-left lg:text-right">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block">
                    Total Líquido Previsto (12 Meses)
                  </span>
                  <span className={`font-mono text-lg sm:text-xl lg:text-2xl font-black block ${
                    total12MonthsNet >= 0 ? 'text-indigo-700' : 'text-rose-700'
                  }`}>
                    {total12MonthsNet >= 0 ? '+' : ''}{formatBRL(total12MonthsNet)}
                  </span>
                  <span className="block text-[11px] sm:text-xs text-slate-500 font-mono">
                    Média de {total12MonthsNet >= 0 ? '+' : ''}{formatBRL(averageMonthlyNet)} / mês
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openForecastReportPage('comparativo')}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <span>DRE Comparativo</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* 12 Months Interactive Sparkline Timeline for NET RESULT */}
            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 bg-slate-50/80 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 font-mono mb-2 sm:mb-2.5 gap-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Evolução Líquida Mês a Mês (12 Meses):</span>
                  <span className="text-slate-400 font-normal hidden sm:inline">filtro independente da previsão líquida</span>
                </span>
                <span className={`font-bold truncate ${netSelectedValue >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                  Mês Ativo: {activeNetMonthExpenseData?.shortLabel} ({netSelectedValue >= 0 ? '+' : ''}{formatBRL(netSelectedValue)})
                </span>
              </div>

              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <div className="flex items-end justify-between gap-1 sm:gap-2 min-w-[320px] sm:min-w-0">
                  {next12MonthsNetProjection.map((m) => {
                    const isSelected = m.monthKey === activeNetMonthKey;
                    const isNext = m.isNextMonth;
                    const heightPercent = maxMonthNetValue > 0 
                      ? Math.max((Math.abs(m.netValue) / maxMonthNetValue) * 100, 14) 
                      : 14;

                    return (
                      <button
                        key={m.monthKey} 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNetMonthKey(m.monthKey);
                        }}
                        className={`flex-1 flex flex-col items-center gap-1 p-0.5 sm:p-1 rounded-lg transition-all cursor-pointer group/bar focus:outline-none min-w-[22px] ${
                          isSelected 
                            ? 'bg-indigo-100/90 ring-2 ring-indigo-500 shadow-xs' 
                            : 'hover:bg-slate-200/60'
                        }`}
                        title={`${m.label}: Receitas ${formatBRL(m.revenueValue)} − Despesas ${formatBRL(m.expenseValue)} = Líquido ${m.isPositive ? '+' : ''}${formatBRL(m.netValue)}`}
                      >
                        <div className="w-full h-10 sm:h-12 bg-slate-200/70 rounded-xs flex flex-col justify-end p-0.5 overflow-hidden">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-xs transition-all duration-200 ${
                              isSelected
                                ? (m.isPositive ? 'bg-indigo-600 shadow-xs' : 'bg-rose-600 shadow-xs')
                                : (m.isPositive ? 'bg-slate-300 group-hover/bar:bg-indigo-400' : 'bg-slate-300 group-hover/bar:bg-rose-400')
                            }`}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono leading-none ${
                          isSelected 
                            ? 'text-indigo-900 font-black underline' 
                            : 'text-slate-500 font-semibold group-hover/bar:text-slate-800'
                        }`}>
                          {m.shortLabel.split('/')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1. EXPECTATIVA DE RECEITAS (VISUAL REFINADO, CLARO E ALTO CONTRASTE) */}
        {(forecastViewTab === 'both' || forecastViewTab === 'receitas') && (
          <div 
            id="financial-future-revenues-box"
            className="bg-white border border-emerald-200/90 rounded-2xl p-4 sm:p-6 shadow-premium transition-all duration-200 overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              {/* Left side: Mês Selecionado */}
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap max-w-full overflow-hidden">
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-sans bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs shrink-0 whitespace-nowrap">
                    <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 shrink-0" />
                    <span className="hidden sm:inline">{activeRevenueMonthData?.isNextMonth ? 'Expectativa de Receitas • Próximo Mês' : 'Expectativa de Receitas'}</span>
                    <span className="sm:hidden">{activeRevenueMonthData?.isNextMonth ? 'Receitas • Próx. Mês' : 'Expectativa Receitas'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] sm:text-xs text-slate-900 font-mono font-black px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 whitespace-nowrap">
                    {activeRevenueMonthData?.label}
                  </span>
                </div>

                <div>
                  <div className="font-mono text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-700 tracking-tight">
                    <span>{formatBRL(activeRevenueMonthData?.totalValue || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Right side: 12-Month Horizon Pill */}
              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                <div className="text-left lg:text-right">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block">
                    Total Previsto (12 Meses)
                  </span>
                  <span className="font-mono text-lg sm:text-xl lg:text-2xl font-black text-slate-900 block">
                    {formatBRL(total12MonthsFutureRevenues)}
                  </span>
                  <span className="block text-[11px] sm:text-xs text-slate-500 font-mono">
                    Média de {formatBRL(averageMonthlyFutureRevenues)} / mês
                  </span>
                </div>

                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium text-right lg:text-right hidden xs:block">
                  Clique no mês abaixo para trocar
                </div>
              </div>
            </div>

            {/* 12 Months Interactive Sparkline Timeline */}
            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 bg-slate-50/80 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 font-mono mb-2 sm:mb-2.5 gap-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Cronograma Interativo (Mês a Mês):</span>
                  <span className="text-slate-400 font-normal hidden sm:inline">clique para selecionar</span>
                </span>
                <span className="text-emerald-800 font-bold truncate">
                  Selecionado: {activeRevenueMonthData?.shortLabel} ({formatBRL(activeRevenueMonthData?.totalValue || 0)})
                </span>
              </div>

              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <div className="flex items-end justify-between gap-1 sm:gap-2 min-w-[320px] sm:min-w-0">
                  {next12MonthsRevenueProjection.map((m) => {
                    const isSelected = m.monthKey === activeRevenueMonthKey;
                    const isNext = m.isNextMonth;
                    const heightPercent = maxMonthRevenueProjectionValue > 0 
                      ? Math.max((m.totalValue / maxMonthRevenueProjectionValue) * 100, 12) 
                      : 12;
                    const hasVal = m.totalValue > 0;

                    return (
                      <button
                        key={m.monthKey} 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRevenueMonthKey(m.monthKey);
                        }}
                        className={`flex-1 flex flex-col items-center gap-1 p-0.5 sm:p-1 rounded-lg transition-all cursor-pointer group/bar focus:outline-none min-w-[22px] ${
                          isSelected 
                            ? 'bg-emerald-100/90 ring-2 ring-emerald-500 shadow-xs' 
                            : 'hover:bg-slate-200/60'
                        }`}
                        title={`${m.label}: ${formatBRL(m.totalValue)} (Clique para exibir no painel)`}
                      >
                        <div className="w-full h-10 sm:h-12 bg-slate-200/70 rounded-xs flex flex-col justify-end p-0.5 overflow-hidden">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-xs transition-all duration-200 ${
                              isSelected
                                ? 'bg-emerald-600 shadow-xs'
                                : (hasVal ? 'bg-slate-300 group-hover/bar:bg-emerald-400' : 'bg-slate-200')
                            }`}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono leading-none ${
                          isSelected 
                            ? 'text-emerald-900 font-black underline' 
                            : 'text-slate-500 font-semibold group-hover/bar:text-slate-800'
                        }`}>
                          {m.shortLabel.split('/')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* In-Panel Itemized Breakdown for Selected Month (Hidden by default, toggled via arrow) */}
            <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="toggle-revenue-breakdown-btn"
                onClick={() => setShowRevenueItems(prev => !prev)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-200/80 transition-all text-left group/revToggle cursor-pointer bg-white shadow-2xs"
                aria-expanded={showRevenueItems}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-xs md:text-base font-bold text-slate-800 whitespace-nowrap">
                      Receitas do Mês
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] md:text-xs font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 shrink-0">
                      {activeRevenueMonthData?.items.length || 0} {activeRevenueMonthData?.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    {dailyRevenueBreakdown.length > 0 && (
                      <span className="hidden xs:inline-block px-1.5 py-0.5 rounded-md text-[10px] md:text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0">
                        {dailyRevenueBreakdown.length} {dailyRevenueBreakdown.length === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-colors shrink-0 ml-2 bg-emerald-50/80 text-emerald-700 group-hover/revToggle:bg-emerald-100">
                  <span>{showRevenueItems ? 'Ocultar' : 'Ver'}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showRevenueItems ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showRevenueItems && (
                <div className="mt-3 space-y-3 animate-fade-in">
                  {activeRevenueMonthData?.items.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500 font-sans">
                      Nenhuma receita estimada para este mês.
                    </div>
                  ) : (
                    <>
                      {/* BARRA SUPERIOR DAS RECEITAS DO MÊS */}
                      <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 font-sans">
                              Discriminação de Receitas de {activeRevenueMonthData?.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              + {formatBRL(activeRevenueMonthData?.totalValue || 0)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            {dailyRevenueBreakdown.length} {dailyRevenueBreakdown.length === 1 ? 'dia com recebimento' : 'dias com recebimento'} • {activeRevenueMonthData?.items.length || 0} parcelas calculadas pelos dias combinados
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Atalho para Filtro por Dia/Período Autônomo */}
                          <button
                            type="button"
                            onClick={() => {
                              handleSetRangeForMonth(activeRevenueMonthKey);
                              setSubView('period_filter');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Abrir no Filtro por Dia/Período"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Filtro por Dia/Período</span>
                          </button>

                          {/* Toggle Mode: Cards vs Table */}
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium font-sans shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setRevenueBreakdownMode('cards')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                revenueBreakdownMode === 'cards'
                                  ? 'bg-emerald-50 text-emerald-800 font-bold shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <LayoutList className="h-3 w-3" />
                              <span>Por Dia</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevenueBreakdownMode('table')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                revenueBreakdownMode === 'table'
                                  ? 'bg-emerald-50 text-emerald-800 font-bold shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Table className="h-3 w-3" />
                              <span>Tabela</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Display Mode 1: Daily Group Cards with item breakdown */}
                      {revenueBreakdownMode === 'cards' && (
                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                          {dailyRevenueBreakdown.length === 0 ? (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500 font-sans">
                              Nenhuma receita prevista para este mês.
                            </div>
                          ) : (
                            dailyRevenueBreakdown.map((group) => (
                              <div 
                                key={group.dateStr}
                                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-emerald-200"
                              >
                                {/* Daily Group Header with exact total */}
                                <div className="bg-slate-50/90 px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex flex-col items-center justify-center bg-white border border-slate-200/90 rounded-lg px-2 py-0.5 shadow-2xs text-center shrink-0 min-w-[46px]">
                                      <span className="text-[8px] uppercase font-bold text-slate-400 font-sans leading-none">
                                        {group.shortDayName}
                                      </span>
                                      <span className="text-sm font-black font-mono text-slate-900 leading-tight">
                                        {String(group.dayNumber).padStart(2, '0')}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900 font-sans">
                                          {group.fullFormattedDate}
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-medium font-sans">
                                          • {group.dayName}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono block leading-tight">
                                        {group.items.length} {group.items.length === 1 ? 'recebimento previsto' : 'recebimentos previstos'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Total value for this day */}
                                  <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase font-sans">
                                      Total do Dia:
                                    </span>
                                    <span className="font-mono text-xs sm:text-sm font-black text-emerald-800">
                                      + {formatBRL(group.totalValue)}
                                    </span>
                                  </div>
                                </div>

                                {/* Items on this day */}
                                <div className="divide-y divide-slate-100 p-1 sm:p-1.5 bg-white">
                                  {group.items.map((item) => (
                                    <div 
                                      key={item.id}
                                      className="flex flex-col xs:flex-row xs:items-center justify-between p-2 hover:bg-slate-50/80 rounded-lg transition-colors text-xs gap-2"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-slate-800 truncate">
                                            {item.title}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            {item.category}
                                          </span>
                                          {item.vehiclePlate && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-700">
                                              {item.vehiclePlate} {item.vehicleModel ? `• ${item.vehicleModel}` : ''}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                          {item.description || item.installmentLabel}
                                        </p>
                                      </div>
                                      <div className="shrink-0 font-mono font-bold text-emerald-700 self-end xs:self-center pl-2 text-xs sm:text-sm">
                                        + {formatBRL(item.value)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* Display Mode 2: Compact Summary Table */}
                      {revenueBreakdownMode === 'table' && (
                        <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs max-h-[420px] overflow-y-auto scrollbar-thin bg-white">
                          <table className="w-full text-left border-collapse text-xs font-sans">
                            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">Dia / Data</th>
                                <th className="p-2.5 hidden sm:table-cell">Dia da Semana</th>
                                <th className="p-2.5">Recebimentos Previstos</th>
                                <th className="p-2.5 text-right">Valor Total do Dia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {dailyRevenueBreakdown.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-slate-500">
                                    Nenhuma receita prevista para este mês.
                                  </td>
                                </tr>
                              ) : (
                                dailyRevenueBreakdown.map((group) => (
                                  <tr key={group.dateStr} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-1.5 font-black text-emerald-800">
                                        Dia {String(group.dayNumber).padStart(2, '0')}
                                      </span>
                                      {group.formattedDate}
                                    </td>
                                    <td className="p-2.5 text-slate-600 hidden sm:table-cell font-medium">
                                      {group.dayName}
                                    </td>
                                    <td className="p-2.5 text-slate-700">
                                      <div className="space-y-0.5">
                                        <div className="font-semibold text-slate-800">
                                          {group.items.length} {group.items.length === 1 ? 'recebimento' : 'recebimentos'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 line-clamp-1">
                                          {group.items.map(it => it.title).join(', ')}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-black text-emerald-700 whitespace-nowrap text-xs sm:text-sm">
                                      + {formatBRL(group.totalValue)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                              <tr>
                                <td colSpan={2} className="p-2.5 text-slate-700 font-sans hidden sm:table-cell">
                                  Total Consolidado ({dailyRevenueBreakdown.length} dias de recebimento)
                                </td>
                                <td className="p-2.5 text-slate-700 font-sans sm:hidden">
                                  Total ({dailyRevenueBreakdown.length} dias)
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px] font-mono sm:table-cell hidden">
                                  {activeRevenueMonthData?.items.length || 0} recebimentos
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-emerald-800 text-sm">
                                  + {formatBRL(activeRevenueMonthData?.totalValue || 0)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. EXPECTATIVA DE DESPESAS (VISUAL REFINADO, CLARO E ALTO CONTRASTE) */}
        {(forecastViewTab === 'both' || forecastViewTab === 'despesas') && (
          <div 
            id="financial-future-expenses-box"
            className="bg-white border border-rose-200/90 rounded-2xl p-4 sm:p-6 shadow-premium transition-all duration-200 overflow-hidden"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              {/* Left side: Mês Selecionado */}
              <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap max-w-full overflow-hidden">
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold font-sans bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs shrink-0 whitespace-nowrap">
                    <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-600 shrink-0" />
                    <span className="hidden sm:inline">{activeExpenseMonthData?.isNextMonth ? 'Expectativa de Despesas • Próximo Mês' : 'Expectativa de Despesas'}</span>
                    <span className="sm:hidden">{activeExpenseMonthData?.isNextMonth ? 'Despesas • Próx. Mês' : 'Expectativa Despesas'}</span>
                  </span>
                  <span className="shrink-0 text-[10px] sm:text-xs text-slate-900 font-mono font-black px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 whitespace-nowrap">
                    {activeExpenseMonthData?.label}
                  </span>
                </div>

                <div>
                  <div className="font-mono text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-rose-600 tracking-tight">
                    <span>{formatBRL(activeExpenseMonthData?.totalValue || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Right side: 12-Month Horizon Pill */}
              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                <div className="text-left lg:text-right">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 block">
                    Total Previsto (12 Meses)
                  </span>
                  <span className="font-mono text-lg sm:text-xl lg:text-2xl font-black text-slate-900 block">
                    {formatBRL(total12MonthsFutureExpenses)}
                  </span>
                  <span className="block text-[11px] sm:text-xs text-slate-500 font-mono">
                    Média de {formatBRL(averageMonthlyFutureExpenses)} / mês
                  </span>
                </div>

                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium text-right lg:text-right hidden xs:block">
                  Clique no mês abaixo para trocar
                </div>
              </div>
            </div>

            {/* 12 Months Interactive Sparkline Timeline */}
            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 bg-slate-50/80 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 font-mono mb-2 sm:mb-2.5 gap-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Cronograma Interativo (Mês a Mês):</span>
                  <span className="text-slate-400 font-normal hidden sm:inline">clique para selecionar</span>
                </span>
                <span className="text-rose-700 font-bold truncate">
                  Selecionado: {activeExpenseMonthData?.shortLabel} ({formatBRL(activeExpenseMonthData?.totalValue || 0)})
                </span>
              </div>

              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <div className="flex items-end justify-between gap-1 sm:gap-2 min-w-[320px] sm:min-w-0">
                  {next12MonthsProjection.map((m) => {
                    const isSelected = m.monthKey === activeExpenseMonthKey;
                    const isNext = m.isNextMonth;
                    const heightPercent = maxMonthProjectionValue > 0 
                      ? Math.max((m.totalValue / maxMonthProjectionValue) * 100, 12) 
                      : 12;
                    const hasVal = m.totalValue > 0;

                    return (
                      <button
                        key={m.monthKey} 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExpenseMonthKey(m.monthKey);
                        }}
                        className={`flex-1 flex flex-col items-center gap-1 p-0.5 sm:p-1 rounded-lg transition-all cursor-pointer group/bar focus:outline-none min-w-[22px] ${
                          isSelected 
                            ? 'bg-rose-100/90 ring-2 ring-rose-500 shadow-xs' 
                            : 'hover:bg-slate-200/60'
                        }`}
                        title={`${m.label}: ${formatBRL(m.totalValue)} (Clique para exibir no painel)`}
                      >
                        <div className="w-full h-10 sm:h-12 bg-slate-200/70 rounded-xs flex flex-col justify-end p-0.5 overflow-hidden">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-xs transition-all duration-200 ${
                              isSelected
                                ? 'bg-rose-600 shadow-xs'
                                : (hasVal ? 'bg-slate-300 group-hover/bar:bg-rose-400' : 'bg-slate-200')
                            }`}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono leading-none ${
                          isSelected 
                            ? 'text-rose-800 font-black underline' 
                            : 'text-slate-500 font-semibold group-hover/bar:text-slate-800'
                        }`}>
                          {m.shortLabel.split('/')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* In-Panel Itemized Breakdown for Selected Month (Hidden by default, toggled via arrow) */}
            <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="toggle-expense-breakdown-btn"
                onClick={() => setShowExpenseItems(prev => !prev)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-200/80 transition-all text-left group/expToggle cursor-pointer bg-white shadow-2xs"
                aria-expanded={showExpenseItems}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-xs md:text-base font-bold text-slate-800 whitespace-nowrap">
                      Lançamentos do Mês
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] md:text-xs font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 shrink-0">
                      {activeExpenseMonthData?.items.length || 0} {activeExpenseMonthData?.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    {dailyExpenseBreakdown.length > 0 && (
                      <span className="hidden xs:inline-block px-1.5 py-0.5 rounded-md text-[10px] md:text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shrink-0">
                        {dailyExpenseBreakdown.length} {dailyExpenseBreakdown.length === 1 ? 'dia' : 'dias'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-colors shrink-0 ml-2 bg-rose-50/80 text-rose-700 group-hover/expToggle:bg-rose-100">
                  <span>{showExpenseItems ? 'Ocultar' : 'Ver'}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showExpenseItems ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showExpenseItems && (
                <div className="mt-3 space-y-3 animate-fade-in">
                  {activeExpenseMonthData?.items.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500 font-sans">
                      Nenhuma despesa agendada para este mês.
                    </div>
                  ) : (
                    <>
                      {/* Destrinchamento Diário Header & Quick Day Selector */}
                      <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3 sm:p-3.5 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                              <CalendarDays className="h-4 w-4" />
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block font-sans">
                                Destrinchamento Diário ({activeExpenseMonthData?.label})
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {dailyExpenseBreakdown.length} {dailyExpenseBreakdown.length === 1 ? 'dia com vencimento' : 'dias com vencimentos no mês'} • Total Previsto: <strong className="text-rose-600 font-bold">{formatBRL(activeExpenseMonthData?.totalValue || 0)}</strong>
                              </span>
                            </div>
                          </div>

                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                          {/* Atalho para Filtro por Dia/Período Autônomo */}
                          <button
                            type="button"
                            onClick={() => {
                              handleSetRangeForMonth(activeExpenseMonthKey);
                              setSubView('period_filter');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Abrir no Filtro por Dia/Período"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Filtro por Dia/Período</span>
                          </button>

                          {/* Mode Toggle: Cards vs Table */}
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium font-sans shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setExpenseBreakdownMode('cards')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                expenseBreakdownMode === 'cards'
                                  ? 'bg-rose-50 text-rose-700 font-bold shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <LayoutList className="h-3 w-3" />
                              <span>Por Dia & Lançamentos</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpenseBreakdownMode('table')}
                              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                                expenseBreakdownMode === 'table'
                                  ? 'bg-rose-50 text-rose-700 font-bold shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Table className="h-3 w-3" />
                              <span>Tabela Diária</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Horizontal Day Chips with exact day and amount */}
                        <div className="pt-1.5 border-t border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 font-sans">
                            Selecione um dia para filtrar ou veja o consolidado:
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                            <button
                              type="button"
                              onClick={() => setSelectedExpenseDay('all')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                effectiveSelectedExpenseDay === 'all'
                                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              <span>Todos ({dailyExpenseBreakdown.length} dias)</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                effectiveSelectedExpenseDay === 'all' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700 font-bold'
                              }`}>
                                {formatBRL(activeExpenseMonthData?.totalValue || 0)}
                              </span>
                            </button>

                            {dailyExpenseBreakdown.map((group) => {
                              const isSelected = effectiveSelectedExpenseDay === group.dateStr;
                              return (
                                <button
                                  key={group.dateStr}
                                  type="button"
                                  onClick={() => setSelectedExpenseDay(isSelected ? 'all' : group.dateStr)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? 'bg-rose-600 text-white font-bold shadow-xs ring-2 ring-rose-300'
                                      : 'bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-200 border border-slate-200'
                                  }`}
                                  title={`${group.fullFormattedDate} (${group.dayName}) - ${group.items.length} itens: ${formatBRL(group.totalValue)}`}
                                >
                                  <span className="font-bold">
                                    Dia {String(group.dayNumber).padStart(2, '0')} ({group.shortDayName})
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    isSelected
                                      ? 'bg-rose-700 text-white'
                                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                                  }`}>
                                    {formatBRL(group.totalValue)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Display Mode 1: Daily Group Cards with item breakdown */}
                      {expenseBreakdownMode === 'cards' && (
                        <div className="space-y-2.5 max-h-[380px] sm:max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
                          {displayedDailyGroups.map((group) => (
                            <div 
                              key={group.dateStr}
                              className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-rose-200"
                            >
                              {/* Daily Group Header with exact total */}
                              <div className="bg-slate-50/90 px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex flex-col items-center justify-center bg-white border border-slate-200/90 rounded-lg px-2 py-0.5 shadow-2xs text-center shrink-0 min-w-[46px]">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 font-sans leading-none">
                                      {group.shortDayName}
                                    </span>
                                    <span className="text-sm font-black font-mono text-slate-900 leading-tight">
                                      {String(group.dayNumber).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-900 font-sans">
                                        {group.fullFormattedDate}
                                      </span>
                                      <span className="text-[11px] text-slate-500 font-medium font-sans">
                                        • {group.dayName}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono block leading-tight">
                                      {group.items.length} {group.items.length === 1 ? 'despesa prevista' : 'despesas previstas'}
                                    </span>
                                  </div>
                                </div>

                                {/* Total value for this day */}
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-lg">
                                  <span className="text-[10px] font-bold text-rose-700 uppercase font-sans">
                                    Total do Dia:
                                  </span>
                                  <span className="font-mono text-xs sm:text-sm font-black text-rose-700">
                                    - {formatBRL(group.totalValue)}
                                  </span>
                                </div>
                              </div>

                              {/* Items on this day */}
                              <div className="divide-y divide-slate-100 p-1 sm:p-1.5 bg-white">
                                {group.items.map((item) => (
                                  <div 
                                    key={item.id}
                                    className="flex flex-col xs:flex-row xs:items-center justify-between p-2 hover:bg-slate-50/80 rounded-lg transition-colors text-xs gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-800 truncate">
                                          {item.title}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                          {item.category}
                                        </span>
                                        {item.vehiclePlate && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-200 text-slate-700">
                                            {item.vehiclePlate} {item.vehicleModel ? `• ${item.vehicleModel}` : ''}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                        {item.description || item.installmentLabel}
                                      </p>
                                    </div>
                                    <div className="shrink-0 font-mono font-bold text-rose-600 self-end xs:self-center pl-2 text-xs sm:text-sm">
                                      - {formatBRL(item.value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Display Mode 2: Compact Summary Table */}
                      {expenseBreakdownMode === 'table' && (
                        <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs max-h-[380px] sm:max-h-[460px] overflow-y-auto scrollbar-thin bg-white">
                          <table className="w-full text-left border-collapse text-xs font-sans">
                            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">Dia / Data</th>
                                <th className="p-2.5 hidden sm:table-cell">Dia da Semana</th>
                                <th className="p-2.5">Lançamentos Previstos</th>
                                <th className="p-2.5 text-right">Valor Total do Dia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {displayedDailyGroups.map((group) => (
                                <tr key={group.dateStr} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-1.5 font-black text-rose-700">
                                      Dia {String(group.dayNumber).padStart(2, '0')}
                                    </span>
                                    {group.formattedDate}
                                  </td>
                                  <td className="p-2.5 text-slate-600 hidden sm:table-cell font-medium">
                                    {group.dayName}
                                  </td>
                                  <td className="p-2.5 text-slate-700">
                                    <div className="space-y-0.5">
                                      <div className="font-semibold text-slate-800">
                                        {group.items.length} {group.items.length === 1 ? 'despesa' : 'despesas'}
                                      </div>
                                      <div className="text-[11px] text-slate-500 line-clamp-1">
                                        {group.items.map(it => it.title).join(', ')}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-black text-rose-600 whitespace-nowrap text-xs sm:text-sm">
                                    - {formatBRL(group.totalValue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                              <tr>
                                <td colSpan={2} className="p-2.5 text-slate-700 font-sans hidden sm:table-cell">
                                  Total Consolidado ({displayedDailyGroups.length} dias listados)
                                </td>
                                <td className="p-2.5 text-slate-700 font-sans sm:hidden">
                                  Total ({displayedDailyGroups.length} dias)
                                </td>
                                <td className="p-2.5 text-slate-500 text-[11px] font-mono sm:table-cell hidden">
                                  {displayedDailyGroups.reduce((acc, g) => acc + g.items.length, 0)} itens
                                </td>
                                <td className="p-2.5 text-right font-mono font-black text-rose-700 text-sm">
                                  - {formatBRL(displayedDailyGroups.reduce((acc, g) => acc + g.totalValue, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* SECTION 2: ASSETS AND LIABILITIES BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        
        {/* ASSETS MODULE (ATIVOS DE FROTA) */}
        <div id="financial-assets-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 sm:mb-6 gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-slate-800">Ativos da Frota (Veículos)</h3>
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1 self-start sm:self-auto shrink-0">
                <Car className="h-4 w-4 shrink-0" />
                <span>Total: {formatBRL(totalAssetsValue)}</span>
              </div>
            </div>

            {activeVehicles.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum veículo ativo cadastrado na frota.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {activeVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex flex-col xs:flex-row xs:items-center justify-between p-3 sm:p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-all gap-2.5">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="h-9 w-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 font-mono text-xs font-black shrink-0">
                        {vehicle.plate.slice(-4)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{vehicle.brandModel}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">Placa: {vehicle.plate}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end xs:self-auto shrink-0">
                      {editingVehicleId === vehicle.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="R$ 0,00"
                            className="bg-white border border-slate-200 outline-none text-xs px-2 py-1 rounded-lg w-24 sm:w-28 text-slate-700 font-mono"
                          />
                          <button
                            onClick={() => handleSaveEstimatedValue(vehicle.id)}
                            className="p-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all text-xs cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {formatBRL(vehicle.estimatedValue || 0)}
                            </span>
                            <button
                              onClick={() => {
                                setEditingVehicleId(vehicle.id);
                                setEditValue((vehicle.estimatedValue || 0).toString());
                              }}
                              className="text-slate-400 hover:text-brand-500 p-1 cursor-pointer"
                              title="Editar Valor de Mercado"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                          {vehicle.estimatedValueDate ? (
                            <p className="text-[9px] text-slate-400 font-mono">
                              Estimado em: {new Date(vehicle.estimatedValueDate).toLocaleDateString('pt-BR')}
                            </p>
                          ) : (
                            <p className="text-[9px] text-slate-400 font-mono">Sem data de estimativa</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-50 rounded-xl p-3 mt-4 border border-slate-100 flex items-start gap-2 text-slate-500">
            <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-[10px] leading-relaxed">
              O valor patrimonial líquido é um somatório volátil e serve para avaliar o capital imobilizado líquido da empresa.
            </p>
          </div>
        </div>

        {/* LIABILITIES MODULE (PASSIVOS E CONTAS AGENDADAS) */}
        <div id="financial-liabilities-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="pb-4 border-b border-slate-100 mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-800">Passivos e Obrigações Agendadas</h3>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => openForecastReportPage('despesas')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-semibold font-sans transition-colors cursor-pointer"
                  title="Ver projeção mês a mês dos próximos 12 meses"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span>Projeção 12 Meses</span>
                </button>
                <div className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center shrink-0">
                  <span>Total: {formatBRL(consolidatedLiabilitiesBreakdown.total + floatingLiabilitiesValue)}</span>
                </div>
              </div>
            </div>

            {/* CONSOLIDATED BREAKDOWN */}
            <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-2">Passivos Consolidados da Frota</h4>
            <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
              {/* FINANCING */}
              <div className="flex flex-col xs:flex-row xs:items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Financiamentos de Veículos</p>
                  <p className="text-[10px] text-slate-400">Prestações de leasing, cdc e faturamentos de bancos</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700 self-end xs:self-center shrink-0">
                  {formatBRL(consolidatedLiabilitiesBreakdown.financing)}
                </span>
              </div>

              {/* IPVA */}
              <div className="flex flex-col xs:flex-row xs:items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Parcelas de IPVA / Licenciamento</p>
                  <p className="text-[10px] text-slate-400">Impostos incidentes pendentes de pagamento anual</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700 self-end xs:self-center shrink-0">
                  {formatBRL(consolidatedLiabilitiesBreakdown.ipva)}
                </span>
              </div>

              {/* INSURANCE */}
              <div className="flex flex-col xs:flex-row xs:items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-700">Seguros Automotivos Agendados</p>
                  <p className="text-[10px] text-slate-400">Mensalidades, apólices de proteção e associados</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700 self-end xs:self-center shrink-0">
                  {formatBRL(consolidatedLiabilitiesBreakdown.insurance)}
                </span>
              </div>
            </div>

            {/* FLOATING LIABILITIES */}
            <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-2">Despesas Flutuantes Agendadas</h4>
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex flex-col xs:flex-row xs:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-700">Contas e Despesas Flutuantes</p>
                <p className="text-[10px] text-slate-400">Soma de parcelas pontuais que não compõem IPVA, Seguro ou Financiamento (ex: pneus, peças pontuais).</p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 shrink-0 self-end xs:self-center">
                {formatBRL(floatingLiabilitiesValue)}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 mt-4 border border-slate-100">
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              * O fluxo de caixa principal <strong>não é afetado</strong> por estes passivos futuros até que as parcelas vençam ou sejam efetivadas manualmente como despesas pagas no caixa de lançamentos.
            </p>
          </div>
        </div>

      </div>

      {/* SECTION 3: SIMPLIFIED MONTHLY PERFORMANCE BREAKDOWN */}
      <div id="financial-monthly-results-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-4 sm:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 sm:mb-6 gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-slate-800 font-sans">DRE Simplificado & Resultado Mensal</h3>
            <p className="text-[11px] text-slate-400">Visão consolidada de lucros operacionais baseada nas datas efetivadas das entradas e saídas.</p>
          </div>

          {/* YEAR FILTER */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-500 font-mono">Ano:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-700 cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredMonthlyResults.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Nenhuma transação lançada para o ano de {yearFilter}.
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
              <span>← Deslize lateralmente para ver todas as colunas →</span>
            </div>
            <div className="overflow-x-auto w-full pb-2 scrollbar-thin">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase font-mono tracking-widest text-slate-400">
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">Mês de Referência</th>
                    <th className="py-3 px-3 font-extrabold text-center whitespace-nowrap">Semanas Comerciais</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">Faturamento de Aluguéis (Qtd / Total)</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">Outras Receitas e Cauções Lqd.</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">Operações de Despesa / Saídas</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">Fórmula de Resultado Mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyResults.map((result) => {
                    const weeksCount = countMondaysInMonth(result.year, result.monthIndex);
                    
                    // Net caucao liquid effect
                    const netCaucaoMonthly = result.caucaoReceivedSum - result.caucaoDevolvidoSum - (result.caucaoRetainedSum || 0);
                    
                    // Monthly Result formula: revenues (alugueis + other receitas) + net caucao - expenses
                    const monthResultValue = result.revenuesSum + netCaucaoMonthly - result.expensesSum;
                    
                    // Other revenues
                    const otherRevenues = result.revenuesSum - result.installmentRentalSum;

                    return (
                      <tr key={result.monthKey} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-700">
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-slate-100 rounded-lg text-slate-500 font-mono uppercase text-[9px] font-bold">
                              {new Date(result.year, result.monthIndex, 1).toLocaleDateString('pt-BR', { month: 'short' })}
                            </span>
                            <span className="font-mono text-slate-800 font-bold">{result.monthKey}</span>
                          </div>
                        </td>
                        
                        <td className="py-3.5 px-3 text-center text-slate-500 font-mono whitespace-nowrap">
                          {weeksCount} semanas
                        </td>
                        
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="font-mono">
                            {formatBRL(result.installmentRentalSum)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {result.installmentRentalCount} faturamentos realizados
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="font-mono">
                            {formatBRL(otherRevenues + netCaucaoMonthly)}
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono leading-none">
                            Cauções líq: {formatBRL(netCaucaoMonthly)} | Outros: {formatBRL(otherRevenues)}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="font-mono text-rose-600">
                            -{formatBRL(result.expensesSum)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {result.expenseTransactionsCount} saídas registradas
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <span className={`inline-block px-3 py-1 rounded-full font-mono font-bold text-xs ${
                            monthResultValue >= 0 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-rose-50 text-rose-600 border border-rose-100'
                          }`}>
                            {monthResultValue >= 0 ? '+' : ''}{formatBRL(monthResultValue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
