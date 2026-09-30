import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  CalendarDays, 
  CalendarRange,
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal, 
  RotateCcw, 
  Layers, 
  Table, 
  LayoutList, 
  Search, 
  Printer, 
  Download, 
  Car, 
  Check, 
  Filter,
  DollarSign
} from 'lucide-react';
import { Vehicle, FutureExpense, Transaction, Rental } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { getEffectiveRentalPaymentWeekday, getWeekdayName } from './RentalsTab';
import { ProjectedRevenueItem, ProjectedExpenseItem } from './FutureExpensesForecastModal';

interface PeriodFilterAutonomousViewProps {
  onClose: () => void;
  vehicles: Vehicle[];
  futureExpenses: FutureExpense[];
  transactions: Transaction[];
  rentals: Rental[];
  formatBRL: (val: number) => string;
  initialStartDate?: string;
  initialEndDate?: string;
}

export const PeriodFilterAutonomousView: React.FC<PeriodFilterAutonomousViewProps> = ({
  onClose,
  vehicles,
  futureExpenses,
  transactions,
  rentals,
  formatBRL,
  initialStartDate,
  initialEndDate
}) => {
  const todayStr = getBrasiliaDateStr();
  const [currentYear, currentMonth] = todayStr.split('-').map(Number);

  // Default month: Current month or initialStartDate
  const defaultStart = initialStartDate || `${todayStr.substring(0, 7)}-01`;
  const defaultEnd = initialEndDate || (() => {
    const [y, m] = todayStr.split('-').map(Number);
    const d = new Date(y, m, 0).getDate();
    return `${todayStr.substring(0, 7)}-${String(d).padStart(2, '0')}`;
  })();

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [viewMode, setViewMode] = useState<'split' | 'timeline'>('split');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Array of all operating months (March 2026 onwards to next 12 months)
  const allOperationalMonths = useMemo(() => {
    const list: Array<{
      monthKey: string;
      label: string;
      shortLabel: string;
      isHistorical: boolean;
      totalRevenue: number;
      totalExpense: number;
      netValue: number;
    }> = [];

    const vehiclesMap = new Map<string, Vehicle>(vehicles.map(v => [v.id, v]));

    let endY = currentYear;
    let endM = currentMonth + 12;
    while (endM > 12) {
      endM -= 12;
      endY += 1;
    }

    let y = 2026;
    let m = 3; // March 2026

    while (y < endY || (y === endY && m <= endM)) {
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const isHistorical = monthKey <= todayStr.substring(0, 7);

      const dObj = new Date(y, m - 1, 1);
      const rawMonthName = dObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const label = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const shortMName = dObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
      const shortLabel = `${shortMName}/${String(y).slice(-2)}`;

      let rev = 0;
      let exp = 0;

      // Actual recorded transactions
      transactions.forEach(t => {
        if (t.date && t.date.startsWith(monthKey)) {
          const isRev = t.type?.toLowerCase() === 'receita' || 
                        (t.category && (t.category === 'Retenção de Caução' || t.category.toLowerCase().includes('aluguel') || t.category.toLowerCase().includes('locação')));
          if (isRev) {
            rev += t.value;
          } else if (t.type === 'despesa') {
            exp += t.value;
          }
        }
      });

      // Scheduled rental contracts active in this month
      const daysInMonth = new Date(y, m, 0).getDate();
      (rentals || []).filter(r => !r.isDeleted).forEach(r => {
        const veh = vehiclesMap.get(r.vehicleId);
        const weeklyRate = r.weeklyRate || veh?.weeklyRate || 0;
        if (weeklyRate <= 0) return;

        const targetWeekday = getEffectiveRentalPaymentWeekday(r);

        for (let day = 1; day <= daysInMonth; day++) {
          const curD = new Date(y, m - 1, day);
          if (curD.getDay() === targetWeekday) {
            const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
            const afterStart = !r.startDate || dateStr >= r.startDate;
            const beforeEnd = !r.endDate || dateStr <= r.endDate || r.status === 'active';

            if (afterStart && beforeEnd) {
              const hasRecorded = transactions.some(t => 
                (t.type === 'receita' || t.category?.toLowerCase().includes('aluguel')) &&
                t.vehicleId === r.vehicleId &&
                t.date &&
                Math.abs(new Date(t.date + 'T12:00:00Z').getTime() - new Date(dateStr + 'T12:00:00Z').getTime()) <= 3 * 86400000
              );
              if (!hasRecorded) {
                rev += weeklyRate;
              }
            }
          }
        }
      });

      // Future expenses installments
      futureExpenses.forEach(fe => {
        (fe.installments || []).forEach(inst => {
          if ((inst.status === 'pending' || !inst.status) && inst.dueDate && inst.dueDate.startsWith(monthKey)) {
            const alreadyRealized = inst.realizedTransactionId && transactions.some(t => t.id === inst.realizedTransactionId);
            if (!alreadyRealized) {
              exp += fe.value;
            }
          }
        });
      });

      list.push({
        monthKey,
        label,
        shortLabel,
        isHistorical,
        totalRevenue: rev,
        totalExpense: exp,
        netValue: rev - exp
      });

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    return list;
  }, [vehicles, rentals, futureExpenses, transactions, currentYear, currentMonth, todayStr]);

  // 2. Metadata for selected dates
  const selectionMeta = useMemo(() => {
    const sDate = startDate || defaultStart;
    const eDate = endDate || defaultEnd;
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
      selectionTitle = `Período: ${formattedStart} a ${formattedEnd}`;
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
      selectedDateSet
    };
  }, [startDate, endDate, defaultStart, defaultEnd]);

  // 3. Autonomous Financial Result (Revenues & Expenses in [startDate, endDate])
  const resultData = useMemo(() => {
    const { startDate: s, endDate: e } = selectionMeta;
    const vehiclesMap = new Map<string, Vehicle>(vehicles.map(v => [v.id, v]));

    // A. Revenues
    const revenuesItems: ProjectedRevenueItem[] = [];
    const txDatesByVehicle = new Map<string, string[]>();

    // 1. Transactions
    transactions.forEach(t => {
      const isRev = t.type?.toLowerCase() === 'receita' || 
                    (t.category && (t.category === 'Retenção de Caução' || t.category.toLowerCase().includes('aluguel') || t.category.toLowerCase().includes('locação')));
      if (isRev && t.date && t.date >= s && t.date <= e) {
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
          title: t.category || 'Receita Realizada',
          description: t.description || 'Receita realizada no período',
          category: t.category || 'Receita Operacional',
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

    // Helper: Check if transaction recorded within ±3 days
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

    // 2. Contracts (covering scheduled weeks in period without a duplicate transaction)
    (rentals || []).filter(r => !r.isDeleted).forEach(r => {
      const veh = vehiclesMap.get(r.vehicleId);
      const weeklyRate = r.weeklyRate || veh?.weeklyRate || 0;
      if (weeklyRate <= 0) return;

      const targetWeekday = getEffectiveRentalPaymentWeekday(r);
      const weekdayName = getWeekdayName(targetWeekday);

      const curr = new Date(s + 'T12:00:00Z');
      const end = new Date(e + 'T12:00:00Z');

      while (curr <= end) {
        if (curr.getUTCDay() === targetWeekday) {
          const dateStr = curr.toISOString().split('T')[0];
          const afterStart = !r.startDate || dateStr >= r.startDate;
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

    // B. Expenses
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
          if (inst.dueDate && inst.dueDate >= s && inst.dueDate <= e) {
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

    // From direct expense transactions
    transactions.forEach(t => {
      if (t.type === 'despesa' && t.date && t.date >= s && t.date <= e) {
        if (!realizedTxIds.has(t.id)) {
          const veh = t.vehicleId ? vehiclesMap.get(t.vehicleId) : undefined;
          expensesItems.push({
            id: `tx_${t.id}`,
            source: 'programada',
            title: t.category,
            description: t.description || 'Lançamento de despesa',
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
  }, [selectionMeta, vehicles, rentals, futureExpenses, transactions]);

  // 4. Breakdown by Month in Range (Evolução Consolidada Mês a Mês)
  const crossMonthBreakdown = useMemo(() => {
    if (!selectionMeta.isCrossMonth) return [];

    const monthMap = new Map<string, { label: string; revTotal: number; expTotal: number }>();

    // Pre-populate all months in the selected interval to guarantee complete chronological visibility
    const [startYear, startMonth] = selectionMeta.startDate.split('-').map(Number);
    const [endYear, endMonth] = selectionMeta.endDate.split('-').map(Number);

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

    resultData.revenuesItems.forEach(it => {
      const monthKey = it.dueDate.substring(0, 7);
      const cur = monthMap.get(monthKey) || { label: '', revTotal: 0, expTotal: 0 };
      cur.revTotal += it.value;
      monthMap.set(monthKey, cur);
    });

    resultData.expensesItems.forEach(it => {
      const monthKey = it.dueDate.substring(0, 7);
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
        shortLabel: `${shortLabel}/${String(y).slice(-2)}`,
        revTotal: data.revTotal,
        expTotal: data.expTotal,
        balance: data.revTotal - data.expTotal
      };
    });
  }, [selectionMeta.isCrossMonth, selectionMeta.startDate, selectionMeta.endDate, resultData]);

  // 5. Days with scheduled or recorded activity
  const activeDaysList = useMemo(() => {
    const { revenuesItems, expensesItems } = resultData;
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
  }, [resultData]);

  // Handlers for quick presets
  const handleSetExactMonth = (mKey: string) => {
    const [y, m] = mKey.split('-').map(Number);
    const daysInM = new Date(y, m, 0).getDate();
    setStartDate(`${mKey}-01`);
    setEndDate(`${mKey}-${String(daysInM).padStart(2, '0')}`);
  };

  const handleSetPreset = (preset: 'today' | 'current_month' | 'next_month' | 'last_30' | 'mar_to_oct_2026' | 'full_year_2026' | 'next_12_months') => {
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'current_month') {
      handleSetExactMonth(todayStr.substring(0, 7));
    } else if (preset === 'next_month') {
      let nextM = currentMonth + 1;
      let nextY = currentYear;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      handleSetExactMonth(`${nextY}-${String(nextM).padStart(2, '0')}`);
    } else if (preset === 'last_30') {
      const endD = new Date(todayStr + 'T12:00:00Z');
      const startD = new Date(endD.getTime() - 29 * 86400000);
      setStartDate(startD.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'mar_to_oct_2026') {
      // 8 Months period requested specifically by the user
      setStartDate('2026-03-01');
      setEndDate('2026-10-31');
    } else if (preset === 'full_year_2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else if (preset === 'next_12_months') {
      let nextM = currentMonth + 1;
      let nextY = currentYear;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      const startStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
      
      let endM = currentMonth + 12;
      let endY = currentYear;
      while (endM > 12) {
        endM -= 12;
        endY += 1;
      }
      const daysInEnd = new Date(endY, endM, 0).getDate();
      const endStr = `${endY}-${String(endM).padStart(2, '0')}-${String(daysInEnd).padStart(2, '0')}`;
      
      setStartDate(startStr);
      setEndDate(endStr);
    }
  };

  const handleSelectDay = (dateStr: string) => {
    if (startDate === dateStr && endDate === dateStr) {
      handleSetExactMonth(dateStr.substring(0, 7));
    } else {
      setStartDate(dateStr);
      setEndDate(dateStr);
    }
  };

  // CSV Export for the active period
  const handleExportCSV = () => {
    let csv = `EXTRATO DETALHADO DO FILTRO POR DIA/PERÍODO\n`;
    csv += `Período Analisado;${selectionMeta.formattedStart} a ${selectionMeta.formattedEnd} (${selectionMeta.daysCount} dias)\n`;
    csv += `Total de Receitas;${formatBRL(resultData.revenuesTotal)}\n`;
    csv += `Total de Despesas;${formatBRL(resultData.expensesTotal)}\n`;
    csv += `Saldo Líquido;${formatBRL(resultData.balance)}\n\n`;

    csv += `Data;Tipo;Origem;Título;Categoria;Placa;Motorista / Destino;Valor (R$)\n`;

    resultData.revenuesItems.forEach(it => {
      csv += `${it.dueDate};Receita;${it.source === 'contrato' ? 'Contrato Semanal' : 'Lançamento/Programada'};"${it.title}";"${it.category}";"${it.vehiclePlate || 'N/D'}";"${it.tenantName || 'N/D'}";"${formatBRL(it.value)}"\n`;
    });

    resultData.expensesItems.forEach(it => {
      csv += `${it.dueDate};Despesa;${it.source === 'parcelamento' ? 'Parcelamento Futuro' : 'Fixa/Avulsa'};"${it.title}";"${it.category}";"${it.vehiclePlate || 'Geral'}";"N/D";"-${formatBRL(it.value)}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extrato_Periodo_${selectionMeta.startDate}_a_${selectionMeta.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items by search query
  const filteredRevenues = useMemo(() => {
    if (!searchQuery.trim()) return resultData.revenuesItems;
    const q = searchQuery.toLowerCase();
    return resultData.revenuesItems.filter(it => 
      (it.title && it.title.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q)) ||
      (it.tenantName && it.tenantName.toLowerCase().includes(q)) ||
      (it.vehiclePlate && it.vehiclePlate.toLowerCase().includes(q)) ||
      (it.description && it.description.toLowerCase().includes(q))
    );
  }, [resultData.revenuesItems, searchQuery]);

  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return resultData.expensesItems;
    const q = searchQuery.toLowerCase();
    return resultData.expensesItems.filter(it => 
      (it.title && it.title.toLowerCase().includes(q)) ||
      (it.category && it.category.toLowerCase().includes(q)) ||
      (it.vehiclePlate && it.vehiclePlate.toLowerCase().includes(q)) ||
      (it.description && it.description.toLowerCase().includes(q))
    );
  }, [resultData.expensesItems, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-full pb-16">
      
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-colors cursor-pointer mb-2 shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar ao Financeiro Geral</span>
          </button>
          
          <h2 className="text-xl sm:text-2xl font-black font-display text-slate-900 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <span>Filtro por Dia/Período</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              Tela Autônoma
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-1">
            Apuração aprofundada: consulte o resultado líquido, extrato detalhado e consolidação mensal de qualquer dia pontual ou período entre meses.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition-all"
            title="Imprimir extrato do período"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs cursor-pointer transition-all"
            title="Exportar dados do período em formato CSV/Excel"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 2. CARD DE CONTROLES DO FILTRO DE DATAS (ERGONOMIA TOTAL & INTERVALO LIVRE) */}
      <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-premium space-y-4">
        
        {/* Presets Rápidos */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono block">
            Atalhos de Período Pré-Configurados:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleSetPreset('today')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('current_month')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('next_month')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Próximo Mês
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('last_30')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Últimos 30 Dias
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('mar_to_oct_2026')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <CalendarRange className="h-3.5 w-3.5 text-indigo-600" />
              <span>Março a Outubro/2026 (8 Meses)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('full_year_2026')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Ano Vigente (2026)
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('next_12_months')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Projeção 12 Meses
            </button>
          </div>
        </div>

        {/* Inputs de Data Inicial e Data Final */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 font-mono">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 font-mono">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <span className="text-xs font-mono font-black px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
              {selectionMeta.daysCount} {selectionMeta.daysCount === 1 ? 'dia' : 'dias'}
              {selectionMeta.isCrossMonth && ' • Multi-mês'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleSetPreset('current_month')}
            className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Redefinir para o mês vigente"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Redefinir</span>
          </button>
        </div>

        {/* Linha do Tempo Cronológica Completa de Meses (Março/2026 até Projeção Futura) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <span>Linha do Tempo de Meses Operacionais (2026/2027):</span>
              <span className="text-slate-400 font-normal hidden sm:inline">clique para selecionar um mês diretamente</span>
            </span>
            <span className="text-indigo-800 font-bold truncate">
              {selectionMeta.selectionTitle}
            </span>
          </div>

          <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <div className="flex items-end justify-between gap-1 sm:gap-1.5 min-w-[640px]">
              {allOperationalMonths.map((m) => {
                const isSelected = !selectionMeta.isCrossMonth
                  ? m.monthKey === selectionMeta.startDate.substring(0, 7)
                  : (m.monthKey >= selectionMeta.startDate.substring(0, 7) && m.monthKey <= selectionMeta.endDate.substring(0, 7));

                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => handleSetExactMonth(m.monthKey)}
                    className={`flex-1 flex flex-col items-center gap-1 p-1 rounded-lg transition-all cursor-pointer focus:outline-none min-w-[34px] ${
                      isSelected 
                        ? 'bg-indigo-100 ring-2 ring-indigo-500 shadow-xs' 
                        : 'hover:bg-slate-100'
                    }`}
                    title={`${m.label}: Receitas ${formatBRL(m.totalRevenue)} | Despesas ${formatBRL(m.totalExpense)} | Saldo ${formatBRL(m.netValue)}`}
                  >
                    <div className="w-full h-8 bg-slate-200/70 rounded-xs flex flex-col justify-end p-0.5 overflow-hidden">
                      <div
                        style={{ height: '100%' }}
                        className={`w-full rounded-xs transition-all duration-200 ${
                          isSelected
                            ? 'bg-indigo-600'
                            : m.netValue >= 0 ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                    </div>
                    <span className={`text-[9px] font-mono leading-none ${
                      isSelected 
                        ? 'text-indigo-950 font-black underline' 
                        : 'text-slate-600 font-semibold'
                    }`}>
                      {m.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* 3. PAINEL DE DESTAQUE DAS MÉTRICAS DO PERÍODO */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-indigo-500/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 font-sans">
                  Resultado Consolidado do Período
                </span>
                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                  {selectionMeta.selectionTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                {selectionMeta.selectionSubtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5">
          {/* Receitas */}
          <div className="bg-slate-800/90 rounded-xl p-3.5 border border-emerald-500/30 shadow-inner">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Receitas do Período
              </span>
              <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded font-mono text-emerald-300 font-bold">
                {resultData.revenuesItems.length} rec.
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              + {formatBRL(resultData.revenuesTotal)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate font-sans">
              {resultData.revenuesDriversSummary}
            </p>
          </div>

          {/* Despesas */}
          <div className="bg-slate-800/90 rounded-xl p-3.5 border border-rose-500/30 shadow-inner">
            <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" />
                Despesas do Período
              </span>
              <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.2 rounded font-mono text-rose-300 font-bold">
                {resultData.expensesItems.length} obrig.
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-rose-400 tracking-tight">
              - {formatBRL(resultData.expensesTotal)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 truncate font-sans">
              {resultData.expensesSummary}
            </p>
          </div>

          {/* Saldo Líquido */}
          <div className={`rounded-xl p-3.5 border shadow-inner ${
            resultData.balance >= 0
              ? 'bg-emerald-950/80 border-emerald-500/60'
              : 'bg-rose-950/80 border-rose-500/60'
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className={resultData.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                Saldo Líquido Apurado
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                resultData.balance >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
              }`}>
                {resultData.balance >= 0 ? 'Superávit' : 'Déficit'}
              </span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${
              resultData.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {resultData.balance >= 0 ? '+ ' : ''}
              {formatBRL(resultData.balance)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 font-sans">
              {resultData.balance >= 0 ? 'Resultado operacional positivo no recorte' : 'Necessidade de aporte ou cobertura de caixa'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. EVOLUÇÃO CONSOLIDADA MÊS A MÊS NO PERÍODO COMPLEXO (TOTALMENTE CONCILIADA) */}
      {selectionMeta.isCrossMonth && crossMonthBreakdown.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-900/10 via-slate-50 to-indigo-50/30 border-2 border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                  <span>Evolução Consolidada Mês a Mês ({crossMonthBreakdown.length} Meses no Período)</span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    Recorte Multi-Mês
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 font-sans">
                  Demonstração detalhada de cada mês dentro do intervalo selecionado ({selectionMeta.formattedStart} a {selectionMeta.formattedEnd}).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-1">
            {crossMonthBreakdown.map((mb) => {
              const isSuperavit = mb.balance >= 0;
              return (
                <div
                  key={mb.monthKey}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-bold font-sans text-slate-800">
                      {mb.label}
                    </span>
                    <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                      isSuperavit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    }`}>
                      {isSuperavit ? 'Superávit' : 'Déficit'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1 text-[11px]">
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                        Receitas:
                      </span>
                      <span className="font-bold text-emerald-700">
                        + {formatBRL(mb.revTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1 text-[11px]">
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                        Despesas:
                      </span>
                      <span className="font-bold text-rose-600">
                        - {formatBRL(mb.expTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-bold">
                      <span className="text-slate-700 text-[11px]">Saldo Líquido:</span>
                      <span className={isSuperavit ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                        {isSuperavit ? '+ ' : ''}{formatBRL(mb.balance)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetExactMonth(mb.monthKey)}
                    className="w-full text-center py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer border border-indigo-100"
                  >
                    Ver somente este mês →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. DIAS COM ATIVIDADE FINANCEIRA (CHIPS INTERATIVOS) */}
      {activeDaysList.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Dias com Movimentação no Período ({activeDaysList.length} dias):</span>
            </span>
            <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
              Clique em qualquer dia para filtrar apenas aquela data
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {activeDaysList.map((d) => {
              const isExactSingleDay = startDate === d.dateStr && endDate === d.dateStr;
              const isInActiveSet = selectionMeta.selectedDateSet.has(d.dateStr);

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => handleSelectDay(d.dateStr)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isExactSingleDay
                      ? 'bg-indigo-700 text-white font-bold shadow-xs ring-2 ring-indigo-300'
                      : isInActiveSet
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold'
                        : 'bg-white text-slate-600 hover:bg-indigo-50/50 border border-slate-200 opacity-70'
                  }`}
                  title={`${d.formattedDate} (${d.dayName}) - Rec: ${formatBRL(d.revTotal)} | Desp: ${formatBRL(d.expTotal)}`}
                >
                  <span className="font-bold">
                    {d.shortFormattedDate} ({d.shortDayName})
                  </span>
                  {d.revTotal > 0 && (
                    <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      +{formatBRL(d.revTotal)}
                    </span>
                  )}
                  {d.expTotal > 0 && (
                    <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                      -{formatBRL(d.expTotal)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. EXTRATO DETALHADO DOS LANÇAMENTOS DO PERÍODO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 font-display flex items-center gap-2">
              <CalendarDays className="h-4.5 w-4.5 text-indigo-600" />
              <span>Extrato Detalhado de Lançamentos ({resultData.revenuesItems.length + resultData.expensesItems.length} itens)</span>
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Transações e obrigações apuradas estritamente dentro do intervalo de {selectionMeta.formattedStart} a {selectionMeta.formattedEnd}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Campo de Busca Rápida */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar motorista, placa, categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-60 shadow-2xs"
              />
            </div>

            {/* Alternador de Visualização */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'split' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutList className="h-3 w-3" />
                <span>Lado a Lado</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'timeline' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="h-3 w-3" />
                <span>Tabela Diária</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coluna de Receitas */}
            <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-emerald-50/90 px-3.5 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 font-sans">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  Receitas ({filteredRevenues.length})
                </span>
                <span className="font-mono text-sm font-black text-emerald-800">
                  + {formatBRL(filteredRevenues.reduce((s, i) => s + i.value, 0))}
                </span>
              </div>
              <div className="p-2 space-y-1.5 max-h-[440px] overflow-y-auto scrollbar-thin">
                {filteredRevenues.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-sans">
                    Nenhum recebimento encontrado para os critérios selecionados.
                  </div>
                ) : (
                  filteredRevenues.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 truncate">{item.title}</span>
                          <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            {item.dueDate ? `${item.dueDate.split('-')[2]}/${item.dueDate.split('-')[1]}/${item.dueDate.split('-')[0]}` : ''}
                          </span>
                          {item.vehiclePlate && (
                            <span className="text-[9px] font-mono bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-bold">
                              {item.vehiclePlate}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.tenantName ? `Motorista: ${item.tenantName} • ` : ''}{item.description || item.installmentLabel}
                        </p>
                      </div>
                      <div className="shrink-0 font-mono font-bold text-emerald-700 text-right">
                        + {formatBRL(item.value)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coluna de Despesas */}
            <div className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-rose-50/90 px-3.5 py-2.5 border-b border-rose-200 flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5 font-sans">
                  <TrendingDown className="h-4 w-4 text-rose-700" />
                  Despesas & Obrigações ({filteredExpenses.length})
                </span>
                <span className="font-mono text-sm font-black text-rose-700">
                  - {formatBRL(filteredExpenses.reduce((s, i) => s + i.value, 0))}
                </span>
              </div>
              <div className="p-2 space-y-1.5 max-h-[440px] overflow-y-auto scrollbar-thin">
                {filteredExpenses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-sans">
                    Nenhuma despesa encontrada para os critérios selecionados.
                  </div>
                ) : (
                  filteredExpenses.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-rose-50/40 border border-rose-100 hover:bg-rose-50 flex items-center justify-between text-xs transition-colors">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 truncate">{item.title}</span>
                          <span className="font-mono text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                            {item.dueDate ? `${item.dueDate.split('-')[2]}/${item.dueDate.split('-')[1]}/${item.dueDate.split('-')[0]}` : ''}
                          </span>
                          <span className="text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.2 rounded">
                            {item.category}
                          </span>
                          {item.vehiclePlate && (
                            <span className="text-[9px] font-mono bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-bold">
                              {item.vehiclePlate}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {item.description || item.installmentLabel}
                        </p>
                      </div>
                      <div className="shrink-0 font-mono font-bold text-rose-600 text-right">
                        - {formatBRL(item.value)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Tabela Diária Consolidada */
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[460px] overflow-y-auto scrollbar-thin bg-white">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3">Dia / Data</th>
                  <th className="p-3">Dia da Semana</th>
                  <th className="p-3 text-right">Receitas</th>
                  <th className="p-3 text-right">Despesas</th>
                  <th className="p-3 text-right">Saldo do Dia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDaysList.filter(d => selectionMeta.selectedDateSet.has(d.dateStr)).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Nenhum lançamento para o recorte selecionado.
                    </td>
                  </tr>
                ) : (
                  activeDaysList
                    .filter(d => selectionMeta.selectedDateSet.has(d.dateStr))
                    .map((d) => (
                      <tr key={d.dateStr} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-1.5 font-black text-indigo-900">
                            Dia {String(d.dayNumber).padStart(2, '0')}
                          </span>
                          {d.formattedDate}
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {d.dayName}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {d.revTotal > 0 ? `+ ${formatBRL(d.revTotal)}` : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                          {d.expTotal > 0 ? `- ${formatBRL(d.expTotal)}` : '—'}
                        </td>
                        <td className={`p-3 text-right font-mono font-black text-xs sm:text-sm ${
                          d.balance >= 0 ? 'text-emerald-800' : 'text-rose-700'
                        }`}>
                          {d.balance >= 0 ? '+ ' : ''}{formatBRL(d.balance)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                <tr>
                  <td colSpan={2} className="p-3 text-slate-800 font-sans">
                    Total do Recorte Selecionado
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-800 text-xs sm:text-sm">
                    + {formatBRL(resultData.revenuesTotal)}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-rose-700 text-xs sm:text-sm">
                    - {formatBRL(resultData.expensesTotal)}
                  </td>
                  <td className={`p-3 text-right font-mono font-black text-sm ${
                    resultData.balance >= 0 ? 'text-emerald-800' : 'text-rose-700'
                  }`}>
                    {resultData.balance >= 0 ? '+ ' : ''}{formatBRL(resultData.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
