import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  CalendarDays, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  ArrowLeft,
  Filter, 
  Search, 
  Download, 
  TrendingDown, 
  TrendingUp,
  Scale,
  AlertCircle, 
  CheckCircle2, 
  Car, 
  Layers, 
  DollarSign,
  Users
} from 'lucide-react';
import { Vehicle } from '../types';

export interface ProjectedExpenseItem {
  id: string;
  source: 'parcelamento' | 'programada';
  title: string;
  description: string;
  category: string;
  dueDate: string; // YYYY-MM-DD
  installmentNumber?: number;
  installmentsCount?: number;
  installmentLabel: string;
  value: number;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
}

export interface MonthProjectionData {
  index: number; // 1 to 12
  year: number;
  month: number; // 1 to 12
  monthKey: string; // YYYY-MM
  label: string; // "Outubro de 2026"
  shortLabel: string; // "Out/26"
  isNextMonth: boolean;
  totalValue: number;
  items: ProjectedExpenseItem[];
}

export interface ProjectedRevenueItem {
  id: string;
  source: 'contrato' | 'programada';
  title: string;
  description: string;
  category: string;
  dueDate: string; // YYYY-MM-DD
  installmentLabel: string;
  value: number;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  tenantName?: string;
}

export interface MonthRevenueProjectionData {
  index: number;
  year: number;
  month: number;
  monthKey: string;
  label: string;
  shortLabel: string;
  isNextMonth: boolean;
  totalValue: number;
  items: ProjectedRevenueItem[];
}

interface FutureExpensesForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthsProjection?: MonthProjectionData[];
  monthsExpenseProjection?: MonthProjectionData[];
  monthsRevenueProjection?: MonthRevenueProjectionData[];
  vehicles: Vehicle[];
  formatBRL: (val: number) => string;
  initialTab?: 'despesas' | 'receitas' | 'comparativo';
  isPageView?: boolean;
}

export function FutureExpensesForecastModal({
  isOpen,
  onClose,
  monthsProjection,
  monthsExpenseProjection,
  monthsRevenueProjection = [],
  vehicles,
  formatBRL,
  initialTab = 'despesas',
  isPageView = false
}: FutureExpensesForecastModalProps) {
  // Resolved expense projection list
  const expensesList = monthsExpenseProjection || monthsProjection || [];

  // Active view tab inside modal
  const [activeTab, setActiveTab] = useState<'despesas' | 'receitas' | 'comparativo'>(initialTab);

  // Synchronize tab on modal open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Filters & search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  
  // Expanded state for each month
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    expensesList.forEach((m, idx) => {
      initial[m.monthKey] = idx === 0;
    });
    return initial;
  });

  // Extract distinct expense categories
  const availableExpenseCategories = useMemo(() => {
    const set = new Set<string>();
    expensesList.forEach(m => {
      m.items.forEach(i => {
        if (i.category) set.add(i.category);
      });
    });
    return Array.from(set).sort();
  }, [expensesList]);

  // Extract distinct revenue categories
  const availableRevenueCategories = useMemo(() => {
    const set = new Set<string>();
    monthsRevenueProjection.forEach(m => {
      m.items.forEach(i => {
        if (i.category) set.add(i.category);
      });
    });
    return Array.from(set).sort();
  }, [monthsRevenueProjection]);

  // Filtered expenses
  const filteredExpensesMonths = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return expensesList.map(month => {
      const filteredItems = month.items.filter(item => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }
        if (selectedVehicleId !== 'all') {
          if (selectedVehicleId === 'general') {
            if (item.vehicleId) return false;
          } else if (item.vehicleId !== selectedVehicleId) {
            return false;
          }
        }
        if (term) {
          const matchTitle = item.title.toLowerCase().includes(term);
          const matchDesc = item.description.toLowerCase().includes(term);
          const matchPlate = item.vehiclePlate?.toLowerCase().includes(term);
          const matchModel = item.vehicleModel?.toLowerCase().includes(term);
          const matchCat = item.category.toLowerCase().includes(term);
          if (!matchTitle && !matchDesc && !matchPlate && !matchModel && !matchCat) {
            return false;
          }
        }
        return true;
      });

      const totalValue = filteredItems.reduce((sum, item) => sum + item.value, 0);
      return {
        ...month,
        items: filteredItems,
        totalValue
      };
    });
  }, [expensesList, selectedCategory, selectedVehicleId, searchTerm]);

  // Filtered revenues
  const filteredRevenuesMonths = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return monthsRevenueProjection.map(month => {
      const filteredItems = month.items.filter(item => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }
        if (selectedVehicleId !== 'all') {
          if (selectedVehicleId === 'general') {
            if (item.vehicleId) return false;
          } else if (item.vehicleId !== selectedVehicleId) {
            return false;
          }
        }
        if (term) {
          const matchTitle = item.title.toLowerCase().includes(term);
          const matchDesc = item.description.toLowerCase().includes(term);
          const matchPlate = item.vehiclePlate?.toLowerCase().includes(term);
          const matchModel = item.vehicleModel?.toLowerCase().includes(term);
          const matchCat = item.category.toLowerCase().includes(term);
          const matchTenant = item.tenantName?.toLowerCase().includes(term);
          if (!matchTitle && !matchDesc && !matchPlate && !matchModel && !matchCat && !matchTenant) {
            return false;
          }
        }
        return true;
      });

      const totalValue = filteredItems.reduce((sum, item) => sum + item.value, 0);
      return {
        ...month,
        items: filteredItems,
        totalValue
      };
    });
  }, [monthsRevenueProjection, selectedCategory, selectedVehicleId, searchTerm]);

  // Comparative DRE (month-by-month revenue vs expense)
  const comparativeMonths = useMemo(() => {
    const list = [];
    const count = Math.max(expensesList.length, monthsRevenueProjection.length, 12);
    for (let i = 0; i < count; i++) {
      const expM = expensesList[i];
      const revM = monthsRevenueProjection[i];
      const monthKey = expM?.monthKey || revM?.monthKey || `month_${i + 1}`;
      const label = expM?.label || revM?.label || `Mês ${i + 1}`;
      const shortLabel = expM?.shortLabel || revM?.shortLabel || `M${i + 1}`;
      const isNextMonth = i === 0;

      const revenues = revM?.totalValue || 0;
      const expenses = expM?.totalValue || 0;
      const netResult = revenues - expenses;
      const margin = revenues > 0 ? (netResult / revenues) * 100 : 0;

      list.push({
        index: i + 1,
        monthKey,
        label,
        shortLabel,
        isNextMonth,
        revenues,
        expenses,
        netResult,
        margin
      });
    }
    return list;
  }, [expensesList, monthsRevenueProjection]);

  // Overall calculations for expenses
  const expenseStats = useMemo(() => {
    const total12Months = filteredExpensesMonths.reduce((sum, m) => sum + m.totalValue, 0);
    const averageMonthly = total12Months / 12;
    const nextMonth = filteredExpensesMonths[0] || { totalValue: 0, items: [] };
    const totalItems = filteredExpensesMonths.reduce((sum, m) => sum + m.items.length, 0);

    let maxMonth = filteredExpensesMonths[0];
    filteredExpensesMonths.forEach(m => {
      if (m.totalValue > (maxMonth?.totalValue || 0)) {
        maxMonth = m;
      }
    });

    return {
      total12Months,
      averageMonthly,
      nextMonthTotal: nextMonth.totalValue,
      nextMonthItemsCount: nextMonth.items.length,
      nextMonthLabel: nextMonth.label,
      totalItems,
      maxMonth
    };
  }, [filteredExpensesMonths]);

  // Overall calculations for revenues
  const revenueStats = useMemo(() => {
    const total12Months = filteredRevenuesMonths.reduce((sum, m) => sum + m.totalValue, 0);
    const averageMonthly = total12Months / 12;
    const nextMonth = filteredRevenuesMonths[0] || { totalValue: 0, items: [] };
    const totalItems = filteredRevenuesMonths.reduce((sum, m) => sum + m.items.length, 0);

    let maxMonth = filteredRevenuesMonths[0];
    filteredRevenuesMonths.forEach(m => {
      if (m.totalValue > (maxMonth?.totalValue || 0)) {
        maxMonth = m;
      }
    });

    return {
      total12Months,
      averageMonthly,
      nextMonthTotal: nextMonth.totalValue,
      nextMonthItemsCount: nextMonth.items.length,
      nextMonthLabel: nextMonth.label,
      totalItems,
      maxMonth
    };
  }, [filteredRevenuesMonths]);

  // Max value for scaling
  const maxExpenseValue = useMemo(() => {
    return Math.max(...filteredExpensesMonths.map(m => m.totalValue), 100);
  }, [filteredExpensesMonths]);

  const maxRevenueValue = useMemo(() => {
    return Math.max(...filteredRevenuesMonths.map(m => m.totalValue), 100);
  }, [filteredRevenuesMonths]);

  // Toggle single month expansion
  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  const expandAll = () => {
    const updated: Record<string, boolean> = {};
    expensesList.forEach(m => {
      updated[m.monthKey] = true;
    });
    monthsRevenueProjection.forEach(m => {
      updated[m.monthKey] = true;
    });
    setExpandedMonths(updated);
  };

  const collapseAll = () => {
    setExpandedMonths({});
  };

  // CSV Export
  const handleExportCSV = () => {
    if (activeTab === 'receitas') {
      let csv = 'Mês Referência;Data/Vencimento;Tipo/Origem;Descrição;Locatário;Placa;Modelo;Valor Previsto (R$)\n';
      filteredRevenuesMonths.forEach(m => {
        m.items.forEach(item => {
          const row = [
            `"${m.label}"`,
            `"${item.dueDate}"`,
            `"${item.category}"`,
            `"${item.description || item.title}"`,
            `"${item.tenantName || '-'}"`,
            `"${item.vehiclePlate || 'Geral'}"`,
            `"${item.vehicleModel || 'Geral da Frota'}"`,
            `"${item.value.toFixed(2).replace('.', ',')}"`
          ];
          csv += row.join(';') + '\n';
        });
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `projecao_receitas_12_meses.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (activeTab === 'comparativo') {
      let csv = 'Mês Referência;Receitas Previstas (R$);Despesas Previstas (R$);Resultado Líquido (R$);Margem (%)\n';
      comparativeMonths.forEach(m => {
        const row = [
          `"${m.label}"`,
          `"${m.revenues.toFixed(2).replace('.', ',')}"`,
          `"${m.expenses.toFixed(2).replace('.', ',')}"`,
          `"${m.netResult.toFixed(2).replace('.', ',')}"`,
          `"${m.margin.toFixed(1).replace('.', ',')}%"`
        ];
        csv += row.join(';') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dre_comparativo_12_meses.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Default: despesas
    let csv = 'Mês Referência;Data Vencimento;Categoria;Descrição;Origem/Parcela;Placa;Modelo;Valor (R$)\n';
    filteredExpensesMonths.forEach(m => {
      m.items.forEach(item => {
        const row = [
          `"${m.label}"`,
          `"${item.dueDate}"`,
          `"${item.category}"`,
          `"${item.description || item.title}"`,
          `"${item.installmentLabel}"`,
          `"${item.vehiclePlate || 'Geral'}"`,
          `"${item.vehicleModel || 'Geral da Frota'}"`,
          `"${item.value.toFixed(2).replace('.', ',')}"`
        ];
        csv += row.join(';') + '\n';
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `projecao_despesas_12_meses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen && !isPageView) return null;

  const contentCard = (
    <div 
      id={isPageView ? "future-forecast-report-card" : "future-forecast-modal-card"}
      className={`bg-white rounded-2xl border border-slate-200 w-full flex flex-col overflow-hidden text-slate-800 ${
        isPageView ? 'shadow-premium' : 'shadow-2xl max-w-5xl max-h-[92vh]'
      }`}
    >
      {/* HEADER */}
      <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs border ${
            activeTab === 'receitas' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
              : activeTab === 'comparativo'
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-rose-50 border-rose-200 text-rose-600'
          }`}>
            {activeTab === 'receitas' ? (
              <TrendingUp className="h-6 w-6" />
            ) : activeTab === 'comparativo' ? (
              <Scale className="h-6 w-6" />
            ) : (
              <CalendarDays className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-display">
                {activeTab === 'receitas' 
                  ? 'Expectativa de Receitas — Próximos 12 Meses' 
                  : activeTab === 'comparativo'
                    ? 'DRE Comparativo Projetado — Próximos 12 Meses'
                    : 'Expectativa de Despesas — Próximos 12 Meses'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono border ${
                activeTab === 'receitas'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : activeTab === 'comparativo'
                    ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}>
                Projeção Mês a Mês
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'receitas'
                ? 'Previsão contratual da frota ativa e recebimentos programados no fluxo financeiro.'
                : activeTab === 'comparativo'
                  ? 'Confronto direto entre receitas estimadas e despesas previstas com cálculo de margem.'
                  : 'Previsão individualizada mês a mês contemplando parcelamentos e despesas programadas.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="future-forecast-export-btn"
            type="button"
            onClick={handleExportCSV}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Exportar projeção em planilha CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {isPageView ? (
            <button
              id="future-forecast-close-btn"
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              title="Voltar ao Painel Financeiro"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Voltar ao Financeiro</span>
              <span className="sm:hidden">Voltar</span>
            </button>
          ) : (
            <button
              id="future-forecast-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

        {/* MODAL / PAGE BODY */}
        <div className={`p-4 sm:p-6 space-y-6 ${isPageView ? '' : 'flex-1 overflow-y-auto'}`}>

          {/* TAB SELECTOR NAVIGATION */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1 w-full sm:w-auto">
              <button
                type="button"
                id="forecast-tab-despesas"
                onClick={() => setActiveTab('despesas')}
                className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'despesas'
                    ? 'bg-white text-rose-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                <span>Despesas Previstas</span>
              </button>

              <button
                type="button"
                id="forecast-tab-receitas"
                onClick={() => setActiveTab('receitas')}
                className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'receitas'
                    ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>Receitas Estimadas</span>
              </button>

              <button
                type="button"
                id="forecast-tab-comparativo"
                onClick={() => setActiveTab('comparativo')}
                className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'comparativo'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Scale className="h-3.5 w-3.5 text-indigo-500" />
                <span>DRE Comparativo</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-400 self-end sm:self-center">
              Horizonte de 12 Meses
            </div>
          </div>

          {/* VIEW 1: DESPESAS PREVISTAS */}
          {activeTab === 'despesas' && (
            <div className="space-y-6">
              {/* TOP KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. MÊS SEGUINTE */}
                <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-700 block">
                    Custo Previsto (Mês Seguinte)
                  </span>
                  <div className="text-2xl font-black font-mono text-rose-700 mt-1">
                    {formatBRL(expenseStats.nextMonthTotal)}
                  </div>
                  <span className="text-[11px] text-slate-600 mt-1 block">
                    {expenseStats.nextMonthLabel} ({expenseStats.nextMonthItemsCount} compromissos)
                  </span>
                </div>

                {/* 2. TOTAL 12 MESES */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Total Previsto (12 Meses)
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {formatBRL(expenseStats.total12Months)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Soma integral do horizonte anual
                  </span>
                </div>

                {/* 3. MÉDIA MENSAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Média Mensal Prevista
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-800 mt-1">
                    {formatBRL(expenseStats.averageMonthly)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Média ponderada por mês
                  </span>
                </div>

                {/* 4. MÊS DE PICO */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Mês de Maior Saída (Pico)
                  </span>
                  <div className="text-xl font-black font-mono text-slate-800 mt-1 truncate">
                    {expenseStats.maxMonth ? formatBRL(expenseStats.maxMonth.totalValue) : 'R$ 0,00'}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block truncate">
                    {expenseStats.maxMonth?.label || 'Nenhum'}
                  </span>
                </div>
              </div>

              {/* INTERACTIVE 12-MONTH TIMELINE BAR CHART */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-rose-600" />
                    Histograma de Despesas Previstas (Mês a Mês)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    1º Mês: <strong className="text-rose-700">{filteredExpensesMonths[0]?.shortLabel} ({formatBRL(filteredExpensesMonths[0]?.totalValue || 0)})</strong>
                  </span>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end pt-2 pb-1 h-36">
                  {filteredExpensesMonths.map(m => {
                    const isNext = m.isNextMonth;
                    const heightPercent = maxExpenseValue > 0 
                      ? Math.max((m.totalValue / maxExpenseValue) * 100, 8) 
                      : 8;
                    const isExpanded = !!expandedMonths[m.monthKey];

                    return (
                      <div 
                        key={m.monthKey}
                        onClick={() => toggleMonth(m.monthKey)}
                        className="flex flex-col items-center h-full justify-end group/bar cursor-pointer"
                        title={`${m.label}: ${formatBRL(m.totalValue)} (${m.items.length} itens) - Clique para alternar`}
                      >
                        <div className="text-[10px] font-mono font-bold text-slate-600 mb-1 opacity-0 group-hover/bar:opacity-100 transition-opacity truncate max-w-full text-center">
                          {formatBRL(m.totalValue).replace(',00', '')}
                        </div>

                        <div className="w-full bg-slate-200 rounded-t-md h-24 flex flex-col justify-end p-0.5 overflow-hidden">
                          <div 
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-xs transition-all duration-300 ${
                              isNext 
                                ? 'bg-rose-500 shadow-sm' 
                                : isExpanded 
                                  ? 'bg-rose-400' 
                                  : m.totalValue > 0 
                                    ? 'bg-slate-400 group-hover/bar:bg-rose-400' 
                                    : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        <div className="mt-1.5 flex flex-col items-center">
                          <span className={`text-[10px] font-mono leading-none ${
                            isNext ? 'font-black text-rose-700' : 'text-slate-600 font-semibold'
                          }`}>
                            {m.shortLabel.split('/')[0]}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">
                            '{m.shortLabel.split('/')[1]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FILTERS & SEARCH TOOLBAR */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por descrição, categoria, placa ou modelo..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800"
                  />
                  {searchTerm && (
                    <button 
                      type="button"
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      <option value="all">Todas as Categorias</option>
                      {availableExpenseCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vehicle Filter */}
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="all">Todos os Veículos</option>
                    <option value="general">Custos Gerais (Sem Veículo)</option>
                    {vehicles.filter(v => !v.isDeleted).map(v => (
                      <option key={v.id} value={v.id}>{v.brandModel} ({v.plate})</option>
                    ))}
                  </select>

                  {/* Expand / Collapse All */}
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    >
                      Expandir Todos
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    >
                      Recolher
                    </button>
                  </div>
                </div>
              </div>

              {/* INDIVIDUALIZED 12-MONTH LIST (ACCORDION) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
                  <span>Cronograma Individualizado Mês a Mês (1º ao 12º Mês)</span>
                  <span>{filteredExpensesMonths.length} meses projetados</span>
                </div>

                {filteredExpensesMonths.map(month => {
                  const isExpanded = !!expandedMonths[month.monthKey];
                  const hasItems = month.items.length > 0;
                  const isNext = month.isNextMonth;

                  return (
                    <div
                      key={month.monthKey}
                      className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                        isNext 
                          ? 'border-rose-300 bg-rose-50/20 shadow-xs' 
                          : isExpanded
                            ? 'border-slate-300 bg-white shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* MONTH ACCORDION HEADER */}
                      <button
                        type="button"
                        onClick={() => toggleMonth(month.monthKey)}
                        className={`w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 transition-colors ${
                          isNext 
                            ? 'bg-rose-50/70 hover:bg-rose-50' 
                            : isExpanded 
                              ? 'bg-slate-50/80 hover:bg-slate-100/70' 
                              : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg text-xs font-mono font-bold ${
                            isNext 
                              ? 'bg-rose-600 text-white shadow-xs' 
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {month.index}º
                          </span>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm sm:text-base">
                                {month.label}
                              </span>
                              {isNext && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-rose-100 text-rose-700 border border-rose-200">
                                  Próximo Mês
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {month.items.length} {month.items.length === 1 ? 'despesa programada' : 'despesas programadas'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-500 block uppercase">
                              Total do Mês
                            </span>
                            <span className={`font-mono text-base sm:text-lg font-black ${
                              month.totalValue > 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}>
                              {formatBRL(month.totalValue)}
                            </span>
                          </div>

                          <div className="p-1 rounded-lg text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* MONTH ITEMS LIST */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white space-y-2 animate-fade-in">
                          {!hasItems ? (
                            <div className="text-center py-6 text-xs text-slate-400 font-sans">
                              Nenhuma despesa prevista para este mês com os filtros atuais.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {month.items.map(item => (
                                <div 
                                  key={item.id}
                                  className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 p-2 rounded-lg transition-colors"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold shrink-0 mt-0.5 border ${
                                      item.source === 'parcelamento' 
                                        ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    }`}>
                                      {item.source === 'parcelamento' ? 'Parcelamento' : 'Programada'}
                                    </span>

                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-800">
                                          {item.title}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                          {item.installmentLabel}
                                        </span>
                                      </div>

                                      {item.description && (
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          {item.description}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                                        <span className="flex items-center gap-1 font-mono">
                                          <Calendar className="h-3 w-3 text-slate-400" />
                                          Vencimento: {item.dueDate}
                                        </span>

                                        {item.vehiclePlate && (
                                          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700">
                                            <Car className="h-3 w-3 text-slate-400" />
                                            {item.vehicleModel || 'Veículo'}: {item.vehiclePlate}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right shrink-0">
                                    <span className="font-mono text-sm font-black text-rose-600">
                                      {formatBRL(item.value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: RECEITAS PREVISTAS */}
          {activeTab === 'receitas' && (
            <div className="space-y-6">
              {/* TOP KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. MÊS SEGUINTE */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-800 block">
                    Receita Prevista (Mês Seguinte)
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
                    {formatBRL(revenueStats.nextMonthTotal)}
                  </div>
                  <span className="text-[11px] text-slate-600 mt-1 block">
                    {revenueStats.nextMonthLabel} ({revenueStats.nextMonthItemsCount} lançamentos previstos)
                  </span>
                </div>

                {/* 2. TOTAL 12 MESES */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Total Previsto (12 Meses)
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {formatBRL(revenueStats.total12Months)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Faturamento estimado da frota
                  </span>
                </div>

                {/* 3. MÉDIA MENSAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Média Mensal de Faturamento
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-800 mt-1">
                    {formatBRL(revenueStats.averageMonthly)}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Média de entradas por mês
                  </span>
                </div>

                {/* 4. MÊS DE PICO */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-600 block">
                    Mês de Maior Receita (Pico)
                  </span>
                  <div className="text-xl font-black font-mono text-slate-800 mt-1 truncate">
                    {revenueStats.maxMonth ? formatBRL(revenueStats.maxMonth.totalValue) : 'R$ 0,00'}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block truncate">
                    {revenueStats.maxMonth?.label || 'Nenhum'}
                  </span>
                </div>
              </div>

              {/* INTERACTIVE 12-MONTH TIMELINE BAR CHART */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Histograma de Receitas Previstas (Mês a Mês)
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    1º Mês: <strong className="text-emerald-700">{filteredRevenuesMonths[0]?.shortLabel} ({formatBRL(filteredRevenuesMonths[0]?.totalValue || 0)})</strong>
                  </span>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end pt-2 pb-1 h-36">
                  {filteredRevenuesMonths.map(m => {
                    const isNext = m.isNextMonth;
                    const heightPercent = maxRevenueValue > 0 
                      ? Math.max((m.totalValue / maxRevenueValue) * 100, 8) 
                      : 8;
                    const isExpanded = !!expandedMonths[m.monthKey];

                    return (
                      <div 
                        key={m.monthKey}
                        onClick={() => toggleMonth(m.monthKey)}
                        className="flex flex-col items-center h-full justify-end group/bar cursor-pointer"
                        title={`${m.label}: ${formatBRL(m.totalValue)} (${m.items.length} itens) - Clique para alternar`}
                      >
                        <div className="text-[10px] font-mono font-bold text-slate-600 mb-1 opacity-0 group-hover/bar:opacity-100 transition-opacity truncate max-w-full text-center">
                          {formatBRL(m.totalValue).replace(',00', '')}
                        </div>

                        <div className="w-full bg-slate-200 rounded-t-md h-24 flex flex-col justify-end p-0.5 overflow-hidden">
                          <div 
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-xs transition-all duration-300 ${
                              isNext 
                                ? 'bg-emerald-500 shadow-sm' 
                                : isExpanded 
                                  ? 'bg-emerald-400' 
                                  : m.totalValue > 0 
                                    ? 'bg-emerald-300/80 group-hover/bar:bg-emerald-400' 
                                    : 'bg-slate-300'
                            }`}
                          />
                        </div>

                        <div className="mt-1.5 flex flex-col items-center">
                          <span className={`text-[10px] font-mono leading-none ${
                            isNext ? 'font-black text-emerald-700' : 'text-slate-600 font-semibold'
                          }`}>
                            {m.shortLabel.split('/')[0]}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">
                            '{m.shortLabel.split('/')[1]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FILTERS & SEARCH TOOLBAR */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por locatário, veículo, placa ou descrição..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                  {searchTerm && (
                    <button 
                      type="button"
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="all">Todas as Categorias</option>
                      {availableRevenueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vehicle Filter */}
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">Todos os Veículos</option>
                    <option value="general">Geral (Sem Veículo)</option>
                    {vehicles.filter(v => !v.isDeleted).map(v => (
                      <option key={v.id} value={v.id}>{v.brandModel} ({v.plate})</option>
                    ))}
                  </select>

                  {/* Expand / Collapse All */}
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    >
                      Expandir Todos
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                    >
                      Recolher
                    </button>
                  </div>
                </div>
              </div>

              {/* INDIVIDUALIZED 12-MONTH LIST (ACCORDION) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
                  <span>Cronograma de Receitas Mês a Mês (1º ao 12º Mês)</span>
                  <span>{filteredRevenuesMonths.length} meses projetados</span>
                </div>

                {filteredRevenuesMonths.map(month => {
                  const isExpanded = !!expandedMonths[month.monthKey];
                  const hasItems = month.items.length > 0;
                  const isNext = month.isNextMonth;

                  return (
                    <div
                      key={month.monthKey}
                      className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                        isNext 
                          ? 'border-emerald-300 bg-emerald-50/20 shadow-xs' 
                          : isExpanded
                            ? 'border-slate-300 bg-white shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* MONTH ACCORDION HEADER */}
                      <button
                        type="button"
                        onClick={() => toggleMonth(month.monthKey)}
                        className={`w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 transition-colors ${
                          isNext 
                            ? 'bg-emerald-50/70 hover:bg-emerald-50' 
                            : isExpanded 
                              ? 'bg-slate-50/80 hover:bg-slate-100/70' 
                              : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg text-xs font-mono font-bold ${
                            isNext 
                              ? 'bg-emerald-600 text-white shadow-xs' 
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {month.index}º
                          </span>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm sm:text-base">
                                {month.label}
                              </span>
                              {isNext && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Próximo Mês
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {month.items.length} {month.items.length === 1 ? 'receita projetada' : 'receitas projetadas'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-500 block uppercase">
                              Total do Mês
                            </span>
                            <span className={`font-mono text-base sm:text-lg font-black ${
                              month.totalValue > 0 ? 'text-emerald-700' : 'text-slate-400'
                            }`}>
                              {formatBRL(month.totalValue)}
                            </span>
                          </div>

                          <div className="p-1 rounded-lg text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* MONTH ITEMS LIST */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white space-y-2 animate-fade-in">
                          {!hasItems ? (
                            <div className="text-center py-6 text-xs text-slate-400 font-sans">
                              Nenhuma receita prevista para este mês com os filtros atuais.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {month.items.map(item => (
                                <div 
                                  key={item.id}
                                  className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 p-2 rounded-lg transition-colors"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold shrink-0 mt-0.5 border ${
                                      item.source === 'contrato' 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    }`}>
                                      {item.source === 'contrato' ? 'Locação Ativa' : 'Programada'}
                                    </span>

                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-800">
                                          {item.title}
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                          {item.installmentLabel}
                                        </span>
                                      </div>

                                      {item.description && (
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          {item.description}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                                        {item.tenantName && (
                                          <span className="flex items-center gap-1 font-sans text-slate-600 font-medium">
                                            <Users className="h-3 w-3 text-slate-400" />
                                            Locatário: <strong>{item.tenantName}</strong>
                                          </span>
                                        )}

                                        {item.vehiclePlate && (
                                          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700">
                                            <Car className="h-3 w-3 text-slate-400" />
                                            {item.vehicleModel || 'Veículo'}: {item.vehiclePlate}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right shrink-0">
                                    <span className="font-mono text-sm font-black text-emerald-700">
                                      +{formatBRL(item.value)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: DRE COMPARATIVO (RECEITAS VS DESPESAS) */}
          {activeTab === 'comparativo' && (
            <div className="space-y-6">
              {/* DRE TABLE */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h4 className="text-xs font-bold font-sans text-slate-800 uppercase tracking-wider">
                    Demonstrativo Comparativo Mês a Mês
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    12 meses projetados
                  </span>
                </div>

                <div className="w-full overflow-hidden">
                  <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span>← Deslize lateralmente para ver a tabela completa →</span>
                  </div>
                  <div className="overflow-x-auto w-full pb-2 scrollbar-thin">
                    <table className="w-full text-xs text-left min-w-[650px]">
                    <thead className="bg-slate-50 text-slate-600 font-mono uppercase text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-4">Mês Referência</th>
                        <th className="py-2.5 px-4 text-right">Receitas Previstas</th>
                        <th className="py-2.5 px-4 text-right">Despesas Previstas</th>
                        <th className="py-2.5 px-4 text-right">Resultado Projetado</th>
                        <th className="py-2.5 px-4 text-right">Margem %</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparativeMonths.map((m) => {
                        const isPos = m.netResult >= 0;
                        return (
                          <tr key={m.monthKey} className={`hover:bg-slate-50/60 transition-colors ${
                            m.isNextMonth ? 'bg-indigo-50/20 font-bold' : ''
                          }`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-400 text-[10px]">{m.index}º</span>
                                <span className="text-slate-800 font-semibold">{m.label}</span>
                                {m.isNextMonth && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold font-mono">
                                    Próximo
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                              {formatBRL(m.revenues)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                              {formatBRL(m.expenses)}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${
                              isPos ? 'text-indigo-600' : 'text-rose-600'
                            }`}>
                              {isPos ? '+' : ''}{formatBRL(m.netResult)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {m.revenues > 0 ? `${m.margin.toFixed(1)}%` : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPos 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {isPos ? 'Superávit' : 'Déficit'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            * Valores calculados com base em contratos ativos e despesas/receitas cadastradas.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {isPageView ? (
                <>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar ao Financeiro</span>
                </>
              ) : (
                <span>Fechar</span>
              )}
            </button>
          </div>
        </div>

      </div>
  );

  if (isPageView) {
    return (
      <div 
        id="future-forecast-report-page"
        className="w-full space-y-5 animate-fade-in pb-16"
      >
        {/* TOP NAVIGATION BREADCRUMB & BACK BUTTON */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="future-forecast-page-back-top-btn"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-brand-500 hover:text-white text-slate-800 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs group"
              title="Voltar ao Painel Financeiro"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span>Voltar ao Financeiro</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Navegação</span>
              <span className="text-xs font-semibold text-slate-700">Painel Financeiro &gt; Relatório Completo de Projeções (12 Meses)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              id="future-forecast-export-btn-page"
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Exportar projeção em planilha CSV"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Exportar Planilha (CSV)</span>
            </button>
          </div>
        </div>

        {contentCard}
      </div>
    );
  }

  return (
    <div 
      id="future-forecast-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {contentCard}
    </div>
  );
}
