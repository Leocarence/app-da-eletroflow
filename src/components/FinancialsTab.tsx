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
  ArrowRight
} from 'lucide-react';
import { Vehicle, FutureExpense, Transaction, Rental } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { 
  FutureExpensesForecastModal, 
  MonthProjectionData, 
  ProjectedExpenseItem,
  MonthRevenueProjectionData,
  ProjectedRevenueItem
} from './FutureExpensesForecastModal';

interface FinancialsTabProps {
  vehicles: Vehicle[];
  futureExpenses: FutureExpense[];
  transactions: Transaction[];
  rentals?: Rental[];
  onUpdateVehicle: (id: string, updatedFields: Partial<Vehicle>) => void;
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
  const [subView, setSubView] = useState<'overview' | 'forecast_report'>('overview');
  const [forecastReportTab, setForecastReportTab] = useState<'despesas' | 'receitas' | 'comparativo'>('despesas');
  const [forecastViewTab, setForecastViewTab] = useState<'both' | 'despesas' | 'receitas'>('both');

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

      // Month boundaries & billing Mondays
      const daysInMonth = new Date(y, m, 0).getDate();
      const monthStartDateStr = `${monthKey}-01`;
      const monthEndDateStr = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

      const mondaysInMonth: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(y, m - 1, day);
        if (d.getDay() === 1) { // 1 = Monday
          mondaysInMonth.push(`${monthKey}-${String(day).padStart(2, '0')}`);
        }
      }
      const billingCycles = mondaysInMonth.length > 0 ? mondaysInMonth : [
        `${monthKey}-05`,
        `${monthKey}-12`,
        `${monthKey}-19`,
        `${monthKey}-26`
      ];

      // 1. Revenues from Active Rental Contracts
      activeRentals.forEach(r => {
        const veh = vehiclesMap.get(r.vehicleId);
        const weeklyRate = r.weeklyRate || veh?.weeklyRate || 0;
        if (weeklyRate <= 0) return;

        // Se o contrato começa após o encerramento deste mês avaliado, ainda não é faturado nele
        if (r.startDate && r.startDate > monthEndDateStr) return;

        // Se o contrato começou no decorrer deste mês futuro, contabiliza apenas ciclos a partir de startDate
        const validCycles = billingCycles.filter(cycleDate => {
          if (r.startDate && cycleDate < r.startDate) return false;
          return true;
        });

        const activeWeeksCount = validCycles.length > 0 ? validCycles.length : billingCycles.length;

        if (activeWeeksCount > 0) {
          const totalRentForMonth = activeWeeksCount * weeklyRate;
          items.push({
            id: `rev_rental_${r.id}_${monthKey}`,
            source: 'contrato',
            title: `Aluguel: ${r.tenantName}`,
            description: `Contrato de locação ativa (${activeWeeksCount} semanas a ${formatBRL(weeklyRate)}/sem)`,
            category: 'Locação Semanal',
            dueDate: validCycles[0] || `${monthKey}-05`,
            installmentLabel: `${activeWeeksCount} semanas faturadas`,
            value: totalRentForMonth,
            vehicleId: r.vehicleId,
            vehiclePlate: veh?.plate,
            vehicleModel: veh?.brandModel,
            tenantName: r.tenantName
          });
        }
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

  // Independent active selected months for in-panel interactive forecast display
  const [selectedExpenseMonthKey, setSelectedExpenseMonthKey] = useState<string>('');
  const [selectedRevenueMonthKey, setSelectedRevenueMonthKey] = useState<string>('');

  // Breakdown lists visibility state (collapsed by default, toggled via arrow button)
  const [showExpenseItems, setShowExpenseItems] = useState<boolean>(false);
  const [showRevenueItems, setShowRevenueItems] = useState<boolean>(false);

  const activeExpenseMonthKey = selectedExpenseMonthKey || next12MonthsProjection[0]?.monthKey || '';
  const activeRevenueMonthKey = selectedRevenueMonthKey || next12MonthsRevenueProjection[0]?.monthKey || '';

  const activeExpenseMonthData = useMemo(() => {
    return next12MonthsProjection.find(m => m.monthKey === activeExpenseMonthKey) || next12MonthsProjection[0];
  }, [next12MonthsProjection, activeExpenseMonthKey]);

  const activeRevenueMonthData = useMemo(() => {
    return next12MonthsRevenueProjection.find(m => m.monthKey === activeRevenueMonthKey) || next12MonthsRevenueProjection[0];
  }, [next12MonthsRevenueProjection, activeRevenueMonthKey]);

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

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in w-full max-w-full overflow-hidden">
      
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
                <p className={`text-[10px] mt-2 sm:mt-3 leading-relaxed font-semibold ${
                  isPositive ? 'text-indigo-700/80' : 'text-rose-700/80'
                }`}>
                  {isPositive ? '✓ Superávit Operacional Geral' : '⚠ Atenção: Defasagem Acumulada'}
                </p>
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
            {/* Subtab Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs overflow-x-auto scrollbar-none w-full sm:w-auto">
              <button
                id="forecast-tab-both"
                type="button"
                onClick={() => setForecastViewTab('both')}
                className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  forecastViewTab === 'both'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ver Ambas
              </button>
              <button
                id="forecast-tab-despesas"
                type="button"
                onClick={() => setForecastViewTab('despesas')}
                className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  forecastViewTab === 'despesas'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="sm:hidden">Despesas</span>
                <span className="hidden sm:inline">Expectativa de Despesas</span>
              </button>
              <button
                id="forecast-tab-receitas"
                type="button"
                onClick={() => setForecastViewTab('receitas')}
                className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  forecastViewTab === 'receitas'
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="sm:hidden">Receitas</span>
                <span className="hidden sm:inline">Expectativa de Receitas</span>
              </button>
            </div>

            {/* Full Report Page Navigation Button */}
            <button
              type="button"
              id="open-full-report-page-btn"
              onClick={() => openForecastReportPage('comparativo')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer w-full sm:w-auto shrink-0"
              title="Acessar página de relatório completo das projeções (12 meses)"
            >
              <span>Relatório Completo</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* 1. EXPECTATIVA DE DESPESAS (VISUAL REFINADO, CLARO E ALTO CONTRASTE) */}
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
                                : isNext 
                                  ? 'bg-rose-400' 
                                  : hasVal 
                                    ? 'bg-slate-400 group-hover/bar:bg-rose-400' 
                                    : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono leading-none ${
                          isSelected 
                            ? 'text-rose-800 font-black underline' 
                            : isNext 
                              ? 'text-rose-600 font-bold' 
                              : 'text-slate-600 font-semibold'
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
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-colors shrink-0 ml-2 bg-rose-50/80 text-rose-700 group-hover/expToggle:bg-rose-100">
                  <span>{showExpenseItems ? 'Ocultar' : 'Ver'}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showExpenseItems ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showExpenseItems && (
                <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1 animate-fade-in">
                  {activeExpenseMonthData?.items.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                      Nenhuma despesa agendada para este mês.
                    </div>
                  ) : (
                    activeExpenseMonthData.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col xs:flex-row xs:items-center justify-between p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 transition-colors text-xs gap-2"
                      >
                        <div className="flex items-start xs:items-center gap-2.5 min-w-0">
                          <div className="shrink-0 flex flex-col items-center justify-center w-11 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-mono">
                            <span className="text-[8px] text-slate-400 uppercase leading-tight font-sans">Venc.</span>
                            <span className="text-[11px] font-bold leading-tight text-slate-800">
                              {item.dueDate ? item.dueDate.split('-').slice(1).reverse().join('/') : '--'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 truncate">{item.title}</span>
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
                        </div>
                        <div className="shrink-0 font-mono font-bold text-rose-600 self-end xs:self-center pl-2">
                          - {formatBRL(item.value)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. EXPECTATIVA DE RECEITAS (LOCALIZADA ABAIXO, VISUAL CLARO E ALTO CONTRASTE) */}
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
                                : isNext 
                                  ? 'bg-emerald-500' 
                                  : hasVal 
                                    ? 'bg-emerald-400/80 group-hover/bar:bg-emerald-500' 
                                    : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono leading-none ${
                          isSelected 
                            ? 'text-emerald-900 font-black underline' 
                            : isNext 
                              ? 'text-emerald-800 font-bold' 
                              : 'text-slate-600 font-semibold'
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
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-sans transition-colors shrink-0 ml-2 bg-emerald-50/80 text-emerald-700 group-hover/revToggle:bg-emerald-100">
                  <span>{showRevenueItems ? 'Ocultar' : 'Ver'}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showRevenueItems ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showRevenueItems && (
                <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1 animate-fade-in">
                  {activeRevenueMonthData?.items.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                      Nenhuma receita estimada para este mês.
                    </div>
                  ) : (
                    activeRevenueMonthData.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex flex-col xs:flex-row xs:items-center justify-between p-2.5 sm:p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 transition-colors text-xs gap-2"
                      >
                        <div className="flex items-start xs:items-center gap-2.5 min-w-0">
                          <div className="shrink-0 flex flex-col items-center justify-center w-11 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-mono">
                            <span className="text-[8px] text-slate-400 uppercase leading-tight font-sans">Ciclo</span>
                            <span className="text-[11px] font-bold leading-tight text-emerald-800">
                              {item.dueDate ? item.dueDate.split('-').slice(1).reverse().join('/') : '--'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 truncate">{item.title}</span>
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
                        </div>
                        <div className="shrink-0 font-mono font-bold text-emerald-700 self-end xs:self-center pl-2">
                          + {formatBRL(item.value)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. BALANÇO OPERACIONAL PROJETADO (DRE SÍNTESE DO MÊS SELECIONADO) */}
        {forecastViewTab === 'both' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs overflow-hidden">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-bold text-slate-700 w-full sm:w-auto">
                {activeExpenseMonthKey === activeRevenueMonthKey
                  ? `Previsão Líquida (${activeExpenseMonthData?.label}):`
                  : `Previsão Comparada (Rec: ${activeRevenueMonthData?.shortLabel} vs Desp: ${activeExpenseMonthData?.shortLabel}):`}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px] sm:text-xs" title={`Receitas de ${activeRevenueMonthData?.label}`}>
                  +{formatBRL(activeRevenueMonthData?.totalValue || 0)}
                  {activeExpenseMonthKey !== activeRevenueMonthKey && (
                    <span className="text-[9px] font-sans font-normal text-emerald-800 ml-1">({activeRevenueMonthData?.shortLabel})</span>
                  )}
                </span>
                <span className="text-slate-400 font-mono">−</span>
                <span className="text-rose-600 font-mono font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[11px] sm:text-xs" title={`Despesas de ${activeExpenseMonthData?.label}`}>
                  {formatBRL(activeExpenseMonthData?.totalValue || 0)}
                  {activeExpenseMonthKey !== activeRevenueMonthKey && (
                    <span className="text-[9px] font-sans font-normal text-rose-700 ml-1">({activeExpenseMonthData?.shortLabel})</span>
                  )}
                </span>
                <span className="text-slate-400 font-mono">=</span>
                <span className={`font-mono font-black px-1.5 py-0.5 rounded text-[11px] sm:text-xs ${
                  ((activeRevenueMonthData?.totalValue || 0) - (activeExpenseMonthData?.totalValue || 0)) >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {((activeRevenueMonthData?.totalValue || 0) - (activeExpenseMonthData?.totalValue || 0)) >= 0 ? '+' : ''}
                  {formatBRL((activeRevenueMonthData?.totalValue || 0) - (activeExpenseMonthData?.totalValue || 0))}
                </span>
              </div>

              {activeExpenseMonthKey !== activeRevenueMonthKey && (
                <button
                  type="button"
                  onClick={() => setSelectedRevenueMonthKey(activeExpenseMonthKey)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-semibold ml-1 cursor-pointer"
                  title="Alinhar receitas com o mês selecionado nas despesas"
                >
                  Sincronizar receitas
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => openForecastReportPage('comparativo')}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 self-start sm:self-auto cursor-pointer shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 w-full sm:w-auto justify-end sm:justify-start"
            >
              <span>Ver DRE Comparativo (12 Meses)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
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
