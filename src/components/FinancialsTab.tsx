import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  Car, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Calculator, 
  Edit3, 
  Check, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  Clock
} from 'lucide-react';
import { Vehicle, FutureExpense, Transaction } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';

interface FinancialsTabProps {
  vehicles: Vehicle[];
  futureExpenses: FutureExpense[];
  transactions: Transaction[];
  onUpdateVehicle: (id: string, updatedFields: Partial<Vehicle>) => void;
}

export function FinancialsTab({ 
  vehicles, 
  futureExpenses, 
  transactions, 
  onUpdateVehicle 
}: FinancialsTabProps) {
  
  // Local state for editing vehicle estimated values
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

  // Helper for currency formatting
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // 1. CASH BALANCE (computed from all historical non-deleted transactions)
  const cashBalance = useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const effectiveTransactions = transactions.filter(t => t.date <= todayStr || t.status === 'realized');

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

    const netCaucao = caucoesReceived - caucoesReturned;
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
      expensesSum: number;
      installmentRentalCount: number;
      installmentRentalSum: number;
      expenseTransactionsCount: number;
    }> = {};

    transactions
      .filter(t => t.date <= todayStr || t.status === 'realized')
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
          expensesSum: 0,
          installmentRentalCount: 0,
          installmentRentalSum: 0,
          expenseTransactionsCount: 0
        };
      }

      const mData = resultsMap[monthKey];

      if (t.type === 'receita') {
        mData.revenuesSum += t.value;
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
    const effectiveTransactions = transactions.filter(t => t.date <= todayStr || t.status === 'realized');

    const revenueSum = effectiveTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const expenseSum = effectiveTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    return {
      revenueSum,
      expenseSum
    };
  }, [transactions]);

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* SECTION 1: HEADER SUMMARY AND CASH IN HAND */}
      <div className="space-y-6">
        
        {/* CASH BALANCE CARD - STANDS ALONE ABOVE */}
        <div id="financial-cash-card" className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 border border-blue-800/40 rounded-2xl p-6 text-white shadow-premium relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <DollarSign className="h-32 w-32 text-white" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs sm:text-sm tracking-wider uppercase text-blue-100 font-extrabold font-sans">
              Dinheiro em Caixa (Saldo Real)
            </span>
            <span className="p-2 sm:p-2.5 bg-white/10 rounded-xl text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
              <DollarSign className="h-6 w-6" />
            </span>
          </div>
          <div className="font-mono text-4xl sm:text-5xl lg:text-5xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)] select-all">
            {formatBRL(cashBalance)}
          </div>
          <p className="text-xs text-blue-200/90 mt-2 font-medium leading-relaxed">
            Saldo acumulado conciliado com todos os pagamentos e despesas efetivas lançadas.
          </p>
        </div>

        {/* BOTTOM METRICS TRIO IN CORRECT SEQUENCE: REVENUE -> EXPENSES -> RESULT */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* GENERAL BILLING CARD */}
          <div id="financial-billing-card" className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 rounded-2xl p-5 border border-emerald-250 border-emerald-200/80 shadow-premium flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-extrabold font-black">
                  Faturamento Geral Acumulado
                </span>
                <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <TrendingUp className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="font-mono text-2xl xl:text-3xl font-black text-emerald-600">
                {formatBRL(generalTotals.revenueSum)}
              </div>
            </div>
            <p className="text-[10px] text-emerald-700/80 mt-3 leading-relaxed font-semibold">
              Soma de todo o faturamento histórico de aluguéis e taxas de recarga recebidas.
            </p>
          </div>

          {/* GENERAL EXPENSES CARD */}
          <div id="financial-expenses-card" className="bg-gradient-to-br from-rose-50 to-rose-100/40 rounded-2xl p-5 border border-rose-250 border-rose-200/80 shadow-premium flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-rose-700 font-extrabold font-black">
                  Despesas Gerais Efetivadas
                </span>
                <span className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <TrendingDown className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="font-mono text-2xl xl:text-3xl font-black text-rose-800">
                {formatBRL(generalTotals.expenseSum)}
              </div>
            </div>
            <p className="text-[10px] text-rose-700/80 mt-3 leading-relaxed font-semibold">
              Total de gastos operacionais, IPVAs, seguros e financiamentos já liquidados.
            </p>
          </div>

          {/* NET RESULT CARD (RESULTADO ENTRE FATURAMENTO E DESPESAS) */}
          {(() => {
            const netResultValue = generalTotals.revenueSum - generalTotals.expenseSum;
            const isPositive = netResultValue >= 0;
            return (
              <div 
                id="financial-net-result" 
                className={`rounded-2xl p-5 border shadow-premium flex flex-col justify-between group transition-all duration-300 ${
                  isPositive 
                    ? 'bg-indigo-50/20 border-indigo-200/80 shadow-indigo-500/5' 
                    : 'bg-rose-50/30 border-rose-200/80 shadow-rose-500/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
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
                  <div className={`font-mono text-2xl xl:text-3xl font-black ${
                    isPositive ? 'text-indigo-600' : 'text-rose-600'
                  }`}>
                    {formatBRL(netResultValue)}
                  </div>
                </div>
                <p className={`text-[10px] mt-3 leading-relaxed font-semibold ${
                  isPositive ? 'text-indigo-700/80' : 'text-rose-700/80'
                }`}>
                  {isPositive ? '✓ Superávit Operacional Geral' : '⚠ Atenção: Defasagem Acumulada'}
                </p>
              </div>
            );
          })()}

        </div>
 
      </div>

      {/* SECTION 2: ASSETS AND LIABILITIES BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ASSETS MODULE (ATIVOS DE FROTA) */}
        <div id="financial-assets-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="font-display text-base font-bold text-slate-800">Ativos da Frota (Veículos)</h3>
                <p className="text-[11px] text-slate-400">Patrimônio estimado registrado em frota automotiva de locação.</p>
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1">
                <Car className="h-4 w-4" />
                <span>Total: {formatBRL(totalAssetsValue)}</span>
              </div>
            </div>

            {activeVehicles.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum veículo ativo cadastrado na frota.
              </div>
            ) : (
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {activeVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-all gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 font-mono text-xs font-black">
                        {vehicle.plate.slice(-4)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{vehicle.brandModel}</p>
                        <p className="text-[10px] font-mono text-slate-400">Placa: {vehicle.plate}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {editingVehicleId === vehicle.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="R$ 0,00"
                            className="bg-white border border-slate-200 outline-none text-xs px-2.5 py-1 rounded-lg w-28 text-slate-700 font-mono"
                          />
                          <button
                            onClick={() => handleSaveEstimatedValue(vehicle.id)}
                            className="p-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all text-xs"
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
                              className="text-slate-400 hover:text-brand-500 p-1"
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
            <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
            <p className="text-[10px] leading-relaxed">
              O valor patrimonial líquido é um somatório volátil e serve para avaliar o capital imobilizado líquido da empresa.
            </p>
          </div>
        </div>

        {/* LIABILITIES MODULE (PASSIVOS E CONTAS AGENDADAS) */}
        <div id="financial-liabilities-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100 mb-6 flex justify-between items-center">
              <div>
                <h3 className="font-display text-base font-bold text-slate-800">Passivos e Obrigações Agendadas</h3>
                <p className="text-[11px] text-slate-400">Total acumulado de parcelas e custos futuros pendentes de quitação.</p>
              </div>
              <div className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center">
                <span>Total: {formatBRL(consolidatedLiabilitiesBreakdown.total + floatingLiabilitiesValue)}</span>
              </div>
            </div>

            {/* CONSOLIDATED BREAKDOWN */}
            <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-2">Passivos Consolidados da Frota</h4>
            <div className="space-y-3 mb-6">
              {/* FINANCING */}
              <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-700">Financiamentos de Veículos</p>
                  <p className="text-[10px] text-slate-400">Prestações de leasing, cdc e faturamentos de bancos</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {formatBRL(consolidatedLiabilitiesBreakdown.financing)}
                </span>
              </div>

              {/* IPVA */}
              <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-700">Parcelas de IPVA / Licenciamento</p>
                  <p className="text-[10px] text-slate-400">Impostos incidentes pendentes de pagamento anual</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {formatBRL(consolidatedLiabilitiesBreakdown.ipva)}
                </span>
              </div>

              {/* INSURANCE */}
              <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-slate-700">Seguros Automotivos Agendados</p>
                  <p className="text-[10px] text-slate-400">Mensalidades, apólices de proteção e associados</p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {formatBRL(consolidatedLiabilitiesBreakdown.insurance)}
                </span>
              </div>
            </div>

            {/* FLOATING LIABILITIES */}
            <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-2">Despesas Flutuantes Agendadas</h4>
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">Contas e Despesas Flutuantes</p>
                <p className="text-[10px] text-slate-400">Soma de parcelas pontuais que não compõem IPVA, Seguro ou Financiamento (ex: pneus, peças pontuais).</p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 shrink-0 ml-3">
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
      <div id="financial-monthly-results-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-800 font-sans">DRE Simplificado & Resultado Mensal</h3>
            <p className="text-[11px] text-slate-400">Visão consolidada de lucros operacionais baseada nas datas efetivadas das entradas e saídas.</p>
          </div>

          {/* YEAR FILTER */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-405 font-mono">Ano:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-700"
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-mono tracking-widest text-slate-400">
                  <th className="py-3 px-3 font-extrabold">Mês de Referência</th>
                  <th className="py-3 px-3 font-extrabold text-center">Semanas Comerciais</th>
                  <th className="py-3 px-3 font-extrabold text-right">Faturamento de Aluguéis (Qtd / Total)</th>
                  <th className="py-3 px-3 font-extrabold text-right">Outras Receitas e Cauções Lqd.</th>
                  <th className="py-3 px-3 font-extrabold text-right">Operações de Despesa / Saídas</th>
                  <th className="py-3 py-3 font-extrabold text-right">Fórmula de Resultado Mensal</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyResults.map((result) => {
                  const weeksCount = countMondaysInMonth(result.year, result.monthIndex);
                  
                  // Net caucao liquid effect
                  const netCaucaoMonthly = result.caucaoReceivedSum - result.caucaoDevolvidoSum;
                  
                  // Monthly Result formula: revenues (alugueis + other receitas) + net caucao - expenses
                  const monthResultValue = result.revenuesSum + netCaucaoMonthly - result.expensesSum;
                  
                  // Other revenues
                  const otherRevenues = result.revenuesSum - result.installmentRentalSum;

                  return (
                    <tr key={result.monthKey} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-700">
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-slate-100 rounded-lg text-slate-500 font-mono uppercase text-[9px] font-bold">
                            {new Date(result.year, result.monthIndex, 1).toLocaleDateString('pt-BR', { month: 'short' })}
                          </span>
                          <span className="font-mono text-slate-800 font-bold">{result.monthKey}</span>
                        </div>
                      </td>
                      
                      <td className="py-4 px-3 text-center text-slate-450 font-mono">
                        {weeksCount} semanas
                      </td>
                      
                      <td className="py-4 px-3 text-right">
                        <div className="font-mono">
                          {formatBRL(result.installmentRentalSum)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {result.installmentRentalCount} faturamentos realizados
                        </div>
                      </td>

                      <td className="py-4 px-3 text-right">
                        <div className="font-mono">
                          {formatBRL(otherRevenues + netCaucaoMonthly)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono leading-none">
                          Cauções líq: {formatBRL(netCaucaoMonthly)} | Outros: {formatBRL(otherRevenues)}
                        </div>
                      </td>

                      <td className="py-4 px-3 text-right">
                        <div className="font-mono text-rose-600">
                          -{formatBRL(result.expensesSum)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {result.expenseTransactionsCount} saídas registradas
                        </div>
                      </td>

                      <td className="py-4 py-3 text-right">
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
        )}
      </div>

    </div>
  );
}
