import React, { useState } from 'react';
import { Vehicle, Rental, Transaction } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { formatPhoneNumber } from '../utils/phoneUtils';
import { 
  Plus, Car, User, Key, CheckCircle, AlertTriangle, Play, Calendar, 
  DollarSign, X, Check, Trash2, Milestone, ArrowLeft, TrendingUp, 
  Wrench, ShieldCheck, History, NotebookTabs, ArrowUpRight, ArrowDownRight,
  Edit3, Download
} from 'lucide-react';
import { exportVehicleCSV } from '../utils/exportUtils';
import { isMaintenanceTransaction, isOccasionalAcquisitionTransaction } from '../utils/transactions';

interface VehiclesTabProps {
  vehicles: Vehicle[];
  rentals: Rental[];
  transactions: Transaction[];
  futureExpenses?: any[];
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (id: string, updatedFields: Partial<Vehicle>) => void;
  onUpdateVehicleStatus: (id: string, status: Vehicle['status']) => void;
  onDeleteVehicle: (id: string, purgeHistory: boolean) => void;
  currentUser?: any;
  onAddTransaction?: (t: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction?: (id: string, updatedFields: Partial<Transaction>) => void;
  onDeleteTransaction?: (id: string) => void;
}

/**
 * Calculates the vacancy (desocupação) rate for a vehicle.
 * Start counting from acquisitionDate + 15 days grace period (carência).
 * Evaluates all days from acquisitionDate up to today.
 */
function calculateVacancyForVehicle(vehicle: Vehicle, rentalsList: Rental[]) {
  console.log('--- DIAGNÓSTICO DE DADOS ---');
  console.log('1. DATA DE HOJE RETORNADA:', getBrasiliaDateStr());
  console.log('2. VEÍCULO AVALIADO:', vehicle.brandModel || vehicle.plate, '| STATUS:', vehicle.status);
  console.log('3. CONTRATOS RECEBIDOS:', rentalsList.filter(r => r.vehicleId === vehicle.id));

  // 1. Filtrar apenas aluguéis válidos.
  // Removemos 'cancelled' / 'cancelado' ou deletados para evitar ocupação fantasma.
  const vRentals = rentalsList.filter(r => 
    r.vehicleId === vehicle.id && 
    !r.isDeleted && 
    (r.status as string) !== 'cancelled' &&
    (r.status as string) !== 'cancelado'
  );

  // 2. Encontrar a data do primeiro aluguel (earliestRentalStart)
  let earliestRentalStart: string | null = null;
  vRentals.forEach(r => {
    if (r.startDate) {
      if (!earliestRentalStart || r.startDate < earliestRentalStart) {
        earliestRentalStart = r.startDate;
      }
    }
  });

  // 3. Definir a data de início da contagem (acquisitionDate ou fallback)
  let acqDateStr = vehicle.acquisitionDate;
  if (!acqDateStr) {
    acqDateStr = earliestRentalStart || '';
  } else if (earliestRentalStart && earliestRentalStart < acqDateStr) {
    acqDateStr = earliestRentalStart;
  }

  // Se não há data alguma, zera os retornos
  if (!acqDateStr) {
    return {
      percentage: null,
      vacantDays: 0,
      totalCountableDays: 0,
      periodLabel: '—',
      isGracePeriod: false,
      graceDaysRemaining: 0
    };
  }

  // Helper para converter string YYYY-MM-DD com segurança para UTC (meia-noite)
  const parseDateToUTC = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  const acqUtc = parseDateToUTC(acqDateStr);
  const todayStr = getBrasiliaDateStr();
  const todayUtc = parseDateToUTC(todayStr);

  if (acqUtc > todayUtc) {
    return {
      percentage: null,
      vacantDays: 0,
      totalCountableDays: 0,
      periodLabel: '—',
      isGracePeriod: false,
      graceDaysRemaining: 0
    };
  }

  const [ay] = acqDateStr.split('-');
  const [ty] = todayStr.split('-');
  const periodLabel = ay === ty ? `${ay}` : `${ay}/${ty}`;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysSinceAcq = Math.floor((todayUtc - acqUtc) / MS_PER_DAY);

  // Flag para a UI saber se hoje o carro está no período de carência inicial
  const hasRentalsOnOrBeforeToday = vRentals.some(r => r.startDate && r.startDate <= todayStr);
  const isGracePeriod = daysSinceAcq < 15 && !hasRentalsOnOrBeforeToday;

  let vacantDays = 0;
  let totalCountableDays = 0;

  // 4. Loop varrendo dia a dia
  let currUtc = acqUtc;
  while (currUtc <= todayUtc) {
    const d = new Date(currUtc);
    const cy = d.getUTCFullYear();
    const cm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const cd = String(d.getUTCDate()).padStart(2, '0');
    const currentStr = `${cy}-${cm}-${cd}`;

    const diffDays = Math.round((currUtc - acqUtc) / MS_PER_DAY);

    // Regra da carência de 15 dias ANTES do primeiro aluguel
    const isInitialGraceDay = diffDays < 15 && (!earliestRentalStart || currentStr < earliestRentalStart);

    if (isInitialGraceDay) {
      currUtc += MS_PER_DAY;
      continue;
    }

    // --- LÓGICA DE OCUPAÇÃO: RESPEITA CONTRATOS ATIVOS PRORROGADOS E CONTRATOS ENCERRADOS ---
    const isRented = vRentals.some(r => {
      // 1. O contrato tem que ter começado neste dia ou antes
      if (!r.startDate || r.startDate > currentStr) return false;

      // 2. Se o contrato foi formalmente encerrado/concluído:
      if (r.status === 'completed' || (r.status as string) === 'terminated') {
        // A ocupação encerrou estritamente na data de término/encerramento
        return r.endDate ? currentStr <= r.endDate : false;
      }
      
      // 3. Se o contrato está ATIVO (status === 'active'):
      // O veículo continua alugado e ocupado, mesmo após a data estimada inicial do contrato
      // ter vencido, já que o contrato é prorrogado automaticamente por prazo indeterminado.
      return true;
    });

    if (isRented) {
      totalCountableDays++;
    } else {
      vacantDays++;
      totalCountableDays++;
    }

    currUtc += MS_PER_DAY;
  }

  const percentage = totalCountableDays > 0 ? (vacantDays / totalCountableDays) * 100 : 0;

  return {
    percentage: percentage === 0 ? 0 : Number(percentage.toFixed(2)),
    vacantDays,
    totalCountableDays,
    periodLabel,
    isGracePeriod,
    graceDaysRemaining: Math.max(0, 15 - daysSinceAcq)
  };
}

export default function VehiclesTab({
  vehicles,
  rentals,
  transactions,
  futureExpenses = [],
  onAddVehicle,
  onUpdateVehicle,
  onUpdateVehicleStatus,
  onDeleteVehicle,
  currentUser,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction
}: VehiclesTabProps) {
  const isSocio = currentUser?.role === 'socio';
  // Modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Custom interactive delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePurgeChoice, setDeletePurgeChoice] = useState<'preserve' | 'purge'>('preserve');

  // Dedicated Maintenance History modal states
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);

  // Add/Edit transaction states for dynamic fleet expense complementation
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txType, setTxType] = useState<'receita' | 'despesa' | 'caucao_recebido' | 'caucao_devolvido'>('despesa');
  const [txValue, setTxValue] = useState<number | ''>('');
  const [txCategory, setTxCategory] = useState('Manutenção');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(getBrasiliaDateStr());

  // Edit vehicle state
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const [editVehId, setEditVehId] = useState('');
  const [editVehBrandModel, setEditVehBrandModel] = useState('');
  const [editVehPlate, setEditVehPlate] = useState('');
  const [editVehWeeklyRate, setEditVehWeeklyRate] = useState(1300);
  const [editVehDepositValue, setEditVehDepositValue] = useState(2600);
  const [editVehMileage, setEditVehMileage] = useState<number | ''>('');
  const [editVehMileageDate, setEditVehMileageDate] = useState('');
  const [editVehAcquisitionDate, setEditVehAcquisitionDate] = useState('');

  // Local draft states for monthly KM aferição and monthly notes (prevents firing save on every keystroke)
  const [monthlyKmDrafts, setMonthlyKmDrafts] = useState<Record<string, string>>({});
  const [monthlyNoteDrafts, setMonthlyNoteDrafts] = useState<Record<string, string>>({});
  const [quickKmInput, setQuickKmInput] = useState<string>('');
  const [quickKmDate, setQuickKmDate] = useState<string>(getBrasiliaDateStr());
  const [considerVehicleFinancing, setConsiderVehicleFinancing] = useState<boolean>(true);

  const openEditVehicleModal = (v: Vehicle) => {
    setEditVehId(v.id);
    setEditVehBrandModel(v.brandModel || '');
    setEditVehPlate(v.plate || '');
    setEditVehWeeklyRate(v.weeklyRate || 0);
    setEditVehDepositValue(v.depositValue || 0);
    setEditVehMileage(v.mileage || '');
    setEditVehMileageDate(v.mileageDate || getBrasiliaDateStr());
    setEditVehAcquisitionDate(v.acquisitionDate || getBrasiliaDateStr());
    setShowEditVehicle(true);
  };

  const submitEditVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehBrandModel || !editVehPlate) return;
    onUpdateVehicle(editVehId, {
      brandModel: editVehBrandModel,
      plate: editVehPlate.toUpperCase(),
      weeklyRate: Number(editVehWeeklyRate),
      depositValue: Number(editVehDepositValue),
      mileage: editVehMileage === '' ? undefined : Number(editVehMileage),
      mileageDate: editVehMileageDate || undefined,
      acquisitionDate: editVehAcquisitionDate || undefined
    });
    setShowEditVehicle(false);
  };
  
  // Form states - Add Vehicle
  const [brandModel, setBrandModel] = useState('');
  const [plate, setPlate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState(1300);
  const [depositValue, setDepositValue] = useState(2600);
  const [status, setStatus] = useState<Vehicle['status']>('available');
  const [acquisitionDate, setAcquisitionDate] = useState(getBrasiliaDateStr());

  const submitAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandModel || !plate) return;
    onAddVehicle({
      brandModel,
      plate: plate.toUpperCase(),
      weeklyRate: Number(weeklyRate),
      depositValue: Number(depositValue),
      status,
      acquisitionDate
    });
    // Reset
    setBrandModel('');
    setPlate('');
    setWeeklyRate(1300);
    setDepositValue(2600);
    setStatus('available');
    setAcquisitionDate(getBrasiliaDateStr());
    setShowAddVehicle(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Find selected vehicle
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Helper classifiers for vehicle expenses (strictly mutually exclusive, read-only)
  const isVehFinancingExpense = (t: Transaction) => {
    if (!t || t.type !== 'despesa' || isOccasionalAcquisitionTransaction(t)) return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return (
      cat.includes('financiamento') ||
      desc.includes('financiamento') ||
      desc.includes('leasing') ||
      desc.includes('cdc banco')
    );
  };

  const isVehInsuranceExpense = (t: Transaction) => {
    if (!t || t.type !== 'despesa' || isVehFinancingExpense(t)) return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return cat.includes('seguro') || desc.includes('seguro');
  };

  const isVehTaxExpense = (t: Transaction) => {
    if (!t || t.type !== 'despesa' || isVehFinancingExpense(t) || isVehInsuranceExpense(t)) return false;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return (
      cat.includes('ipva') ||
      cat.includes('imposto') ||
      cat.includes('taxa') ||
      cat.includes('licenciamento') ||
      cat.includes('emplacamento') ||
      desc.includes('ipva') ||
      desc.includes('imposto') ||
      desc.includes('licenciamento') ||
      desc.includes('emplacamento') ||
      desc.includes('taxa') ||
      desc.includes('multa')
    );
  };

  const isVehMechanicalExpense = (t: Transaction) => {
    if (!t || t.type !== 'despesa' || isVehFinancingExpense(t) || isVehInsuranceExpense(t) || isVehTaxExpense(t)) {
      return false;
    }
    const cat = (t.category || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    return (
      cat.includes('manuten') ||
      cat.includes('oficina') ||
      cat.includes('revis') ||
      cat.includes('reparo') ||
      cat.includes('peça') ||
      cat.includes('pneu') ||
      cat.includes('alinhamento') ||
      cat.includes('mecanic') ||
      desc.includes('manuten') ||
      desc.includes('oficina') ||
      desc.includes('reparo') ||
      desc.includes('revis') ||
      desc.includes('conserto') ||
      desc.includes('peça') ||
      desc.includes('óleo') ||
      desc.includes('oleo') ||
      desc.includes('pneu') ||
      desc.includes('alinhamento') ||
      desc.includes('balanceamento') ||
      desc.includes('estabilizadora') ||
      desc.includes('barra axial') ||
      desc.includes('mecanic') ||
      desc.includes('eletricista') ||
      desc.includes('borracheiro') ||
      desc.includes('insulfilm') ||
      desc.includes('lava-jato') ||
      desc.includes('desbloqueio') ||
      desc.includes('tag rastreio') ||
      desc.includes('carregador')
    );
  };

  // Statistics & History calculation for SELECTED VEHICLE
  const getVehicleData = (v: Vehicle) => {
    // Current active rental
    const activeRent = rentals.find(r => r.vehicleId === v.id && r.status === 'active');
    
    // Past rentals
    const pastRentals = rentals.filter(r => r.vehicleId === v.id && r.status === 'completed');

    const todayStr = getBrasiliaDateStr();

    // Transactions associated with this vehicle (using linked vehicleId)
    const vehicleTransactions = transactions
      .filter(t => t.vehicleId === v.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    // For calculations, only sum items with date <= today
    const effectiveVehicleTransactions = vehicleTransactions.filter(t => t.date <= todayStr);

    // Financial calculations
    const totalRevenues = effectiveVehicleTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const allRecordedExpenses = effectiveVehicleTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    const occasionalOutlayExpenses = effectiveVehicleTransactions
      .filter(t => isOccasionalAcquisitionTransaction(t))
      .reduce((sum, t) => sum + t.value, 0);

    // Recurring expenses of the vehicle (excluding occasional freight/purchase/consortium withdrawals)
    const totalExpenses = Math.max(0, allRecordedExpenses - occasionalOutlayExpenses);

    const depositsReceived = effectiveVehicleTransactions
      .filter(t => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const depositsReturned = effectiveVehicleTransactions
      .filter(t => t.type === 'caucao_devolvido')
      .reduce((sum, t) => sum + t.value, 0);

    const netDepositInHand = depositsReceived - depositsReturned;
    const netProfit = totalRevenues - totalExpenses;

    const financingExpenses = effectiveVehicleTransactions
      .filter(isVehFinancingExpense)
      .reduce((sum, t) => sum + t.value, 0);

    const insuranceExpenses = effectiveVehicleTransactions
      .filter(t => !isOccasionalAcquisitionTransaction(t) && isVehInsuranceExpense(t))
      .reduce((sum, t) => sum + t.value, 0);

    const taxExpenses = effectiveVehicleTransactions
      .filter(t => !isOccasionalAcquisitionTransaction(t) && isVehTaxExpense(t))
      .reduce((sum, t) => sum + t.value, 0);

    const mechanicalExpenses = effectiveVehicleTransactions
      .filter(t => !isOccasionalAcquisitionTransaction(t) && isVehMechanicalExpense(t))
      .reduce((sum, t) => sum + t.value, 0);

    const otherExpenses = Math.max(
      0,
      Number((totalExpenses - (mechanicalExpenses + financingExpenses + taxExpenses + insuranceExpenses)).toFixed(2))
    );

    // Operational result excluding financing installments
    const operationalExpensesExclFinancing = Math.max(0, totalExpenses - financingExpenses);
    const operationalProfit = totalRevenues - operationalExpensesExclFinancing;

    return {
      activeRent,
      pastRentals,
      vehicleTransactions,
      totalRevenues,
      totalExpenses,
      occasionalOutlayExpenses,
      netDepositInHand,
      netProfit,
      operationalProfit,
      operationalExpensesExclFinancing,
      mechanicalExpenses,
      financingExpenses,
      taxExpenses,
      insuranceExpenses,
      otherExpenses
    };
  };

  if (selectedVehicle) {
    const {
      activeRent,
      pastRentals,
      vehicleTransactions,
      totalRevenues,
      totalExpenses,
      netDepositInHand,
      netProfit,
      operationalProfit,
      mechanicalExpenses,
      financingExpenses,
      taxExpenses,
      insuranceExpenses,
      otherExpenses
    } = getVehicleData(selectedVehicle);

    const formatPct = (val: number) => {
      if (totalRevenues <= 0) return '0,0%';
      return `${((val / totalRevenues) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    };

    const netMarginPct = totalRevenues > 0 ? (netProfit / totalRevenues) * 100 : 0;
    const operationalMarginPct = totalRevenues > 0 ? (operationalProfit / totalRevenues) * 100 : 0;
    const displayedProfit = considerVehicleFinancing ? netProfit : operationalProfit;
    const displayedMarginPct = considerVehicleFinancing ? netMarginPct : operationalMarginPct;
    const alternateProfit = considerVehicleFinancing ? operationalProfit : netProfit;
    const alternateMarginPct = considerVehicleFinancing ? operationalMarginPct : netMarginPct;
    const mechanicalPct = totalRevenues > 0 ? (mechanicalExpenses / totalRevenues) * 100 : 0;
    const financingPct = totalRevenues > 0 ? (financingExpenses / totalRevenues) * 100 : 0;
    const fixedAndOtherExpenses = insuranceExpenses + taxExpenses + otherExpenses;
    const fixedAndOtherPct = totalRevenues > 0 ? (fixedAndOtherExpenses / totalRevenues) * 100 : 0;
    const consideredExpensesTotal = considerVehicleFinancing ? totalExpenses : Math.max(0, totalExpenses - financingExpenses);
    const totalExpensesPct = totalRevenues > 0 ? (consideredExpensesTotal / totalRevenues) * 100 : 0;

    // Calculate days left in active rent if any
    let daysLeft: number | null = null;
    if (activeRent) {
      const today = new Date();
      const endDateObj = new Date(activeRent.endDate + 'T00:00:00');
      const msDiff = endDateObj.getTime() - today.getTime();
      daysLeft = Math.ceil(msDiff / (1000 * 3600 * 24));
    }

    // Regra de Integridade Estrita: O fato de o veículo estar liberado para locação ou alugado
    // é estritamente atrelado a ele possuir um contrato ativo vigente.
    const hasActiveRental = Boolean(activeRent);
    const effectiveStatus: Vehicle['status'] = selectedVehicle.status === 'maintenance'
      ? 'maintenance'
      : (hasActiveRental ? 'rented' : 'available');

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-premium">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedVehicleId(null)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all"
              title="Voltar para a Frota"
              id="back-to-fleet-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-md font-bold border border-brand-100">
                  {selectedVehicle.plate}
                </span>
                <h2 className="font-display font-bold text-slate-800 text-lg sm:text-xl">
                  {selectedVehicle.brandModel}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Visualizando individualização completa das informações do veículo.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportVehicleCSV(selectedVehicle, rentals, transactions, { totalRevenues, totalExpenses, netProfit, netDepositInHand })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 shadow-premium"
              title="Exportar Extrato Completo"
            >
              <Download className="h-4 w-4" />
              <span>Exportar Extrato</span>
            </button>
            {!isSocio ? (
              <div className="flex items-center gap-2">
                {selectedVehicle.status !== 'maintenance' ? (
                  <button
                    onClick={() => onUpdateVehicleStatus(selectedVehicle.id, 'maintenance')}
                    className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all border border-amber-200/60 cursor-pointer"
                    title={activeRent ? `Colocar na oficina (Contrato com ${activeRent.tenantName} permanece ativo)` : 'Enviar veículo para oficina/manutenção'}
                  >
                    <Wrench className="h-4 w-4 text-amber-600" />
                    {activeRent ? 'Oficina (Carro Alugado)' : 'Oficina / Manutenção'}
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdateVehicleStatus(selectedVehicle.id, activeRent ? 'rented' : 'available')}
                    className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all border border-emerald-200/60 cursor-pointer"
                    title={activeRent ? `Concluir manutenção e retornar veículo para o contrato ativo com ${activeRent.tenantName}` : 'Liberar carro disponível para novas locações'}
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    {activeRent ? 'Concluir Oficina (Voltar para Alugado)' : 'Liberar Carro (Disponível)'}
                  </button>
                )}
                <button
                  onClick={() => openEditVehicleModal(selectedVehicle)}
                  className="p-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                  title="Editar Veículo"
                >
                  <Edit3 className="h-4 w-4 text-slate-550" />
                  <span>Editar Veículo</span>
                </button>
                <button
                  onClick={() => {
                    setDeletePurgeChoice('preserve');
                    setShowDeleteModal(true);
                  }}
                  className="p-1 px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-500 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                  title="Excluir Veículo"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Excluir Veículo</span>
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Visualização (Alterações bloqueadas para sócio)</span>
            )}
          </div>
        </div>

        {/* STATS OVERVIEW CARDS (SEPARATING WORKSHOP/REPAIRS FROM FINANCING) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Status Atual</span>
                {effectiveStatus === 'available' && (
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponível
                  </span>
                )}
                {effectiveStatus === 'rented' && (
                  <span className="text-xs font-bold bg-brand-50 text-brand-500 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-brand-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span> Alugado
                  </span>
                )}
                {effectiveStatus === 'maintenance' && (
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> {activeRent ? `Na Oficina (${activeRent.tenantName})` : 'Em Manutenção'}
                  </span>
                )}
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                <Car className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400">
              Taxa Sugerida: <strong className="text-slate-700">{formatCurrency(selectedVehicle.weeklyRate)} / sem</strong>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Faturamento (Aluguéis)</span>
                <span className="text-lg font-bold font-mono text-emerald-600">{formatCurrency(totalRevenues)}</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400">
              100% da receita bruta do veículo
            </div>
          </div>

          <div className="bg-white rounded-xl border border-rose-100/80 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1">Oficina, Reparos e Revisão</span>
                <span className="text-lg font-bold font-mono text-rose-600">{formatCurrency(mechanicalExpenses)}</span>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-1">
              <span className="text-[11px] text-slate-400">
                <strong className="text-rose-600 font-mono">{formatPct(mechanicalExpenses)}</strong> da receita
              </span>
              <button
                type="button"
                onClick={() => setMaintenanceVehicle(selectedVehicle)}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Wrench className="h-3 w-3 text-amber-600" />
                Histórico
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-indigo-100/80 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1">Financiamento (Parcelas)</span>
                <span className="text-lg font-bold font-mono text-indigo-600">{formatCurrency(financingExpenses)}</span>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400">
              <strong className="text-indigo-600 font-mono">{formatPct(financingExpenses)}</strong> da receita (aquisição)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Caução com a Empresa</span>
                <span className="text-lg font-bold font-mono text-amber-500">{formatCurrency(netDepositInHand)}</span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400">
              Valor de depósito em custódia
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Quilometragem Estimada</span>
                <span className="text-lg font-bold font-mono text-brand-600">
                  {selectedVehicle.mileage !== undefined && selectedVehicle.mileage !== null && typeof selectedVehicle.mileage === 'number' ? `${selectedVehicle.mileage.toLocaleString('pt-BR')} KM` : 'N/D'}
                </span>
              </div>
              <div className="p-2 bg-brand-50 rounded-lg text-brand-500">
                <Milestone className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400 truncate" title={selectedVehicle.mileageDate ? `Data do cadastro: ${selectedVehicle.mileageDate}` : 'Sem data registrada'}>
              Aferido em: <strong className="text-slate-700">{selectedVehicle.mileageDate ? new Date(selectedVehicle.mileageDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</strong>
            </div>
          </div>
        </div>

        {/* BOX DE RESULTADO FINANCEIRO SIMPLIFICADO E EM PERCENTUAIS (COM DESTAQUE NA MARGEM LÍQUIDA) */}
        <div
          id="vehicle-simplified-financial-result-box"
          className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-premium-lg"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/90">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  Resultado Financeiro Simplificado
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Placa {selectedVehicle.plate}
                </span>
              </div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white mt-1.5 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Demonstrativo Simplificado em Percentuais & Margem Líquida
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Separação estrita entre custos de oficina/reparos/revisão, parcelas de financiamento e margem líquida real do veículo.
              </p>
            </div>

            {/* HIGHLIGHT BOX: MARGEM LÍQUIDA DO VEÍCULO + CHECKBOX FINANCIAMENTO */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <label
                htmlFor="toggle-vehicle-financing"
                className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer select-none transition-all ${
                  considerVehicleFinancing
                    ? 'bg-indigo-950/70 border-indigo-400/50 text-indigo-100'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                <input
                  id="toggle-vehicle-financing"
                  type="checkbox"
                  checked={considerVehicleFinancing}
                  onChange={(e) => setConsiderVehicleFinancing(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                />
                <div className="text-left">
                  <span className="text-xs font-bold block text-white leading-tight">
                    Considerar Financiamentos
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    {considerVehicleFinancing ? 'Ref. s/ financ.: ' : 'Ref. c/ financ.: '}
                    {alternateMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ({formatCurrency(alternateProfit)})
                  </span>
                </div>
              </label>

              <div className={`px-5 py-3 rounded-xl border-2 shadow-lg text-left sm:text-right ${
                displayedProfit >= 0
                  ? 'bg-emerald-500/15 border-emerald-400/60 shadow-emerald-950/50'
                  : 'bg-rose-500/15 border-rose-400/60 shadow-rose-950/50'
              }`}>
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-200 block">
                  ★ {considerVehicleFinancing ? 'Margem Líquida (C/ Financ.)' : 'Margem Operacional (S/ Financ.)'}
                </span>
                <div className="flex items-baseline sm:justify-end gap-2.5 mt-0.5">
                  <span className={`font-mono text-2xl sm:text-3xl font-black tracking-tight ${
                    displayedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {displayedProfit >= 0 ? '+' : ''}{displayedMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>
                  <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${
                    displayedProfit >= 0 ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'
                  }`}>
                    {formatCurrency(displayedProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SIMPLIFIED BREAKDOWN CARDS WITH PERCENTAGES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-5">
            {/* 1. Receita Bruta */}
            <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">1. Receita de Aluguéis</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  100,0%
                </span>
              </div>
              <div className="mt-2">
                <span className="font-mono text-base sm:text-lg font-bold text-emerald-400 block">
                  +{formatCurrency(totalRevenues)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Base total de faturamento (100%)
                </span>
              </div>
            </div>

            {/* 2. Custos de Reparo, Oficina e Revisão */}
            <div className="bg-slate-800/50 border border-rose-500/30 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-rose-200 uppercase tracking-wider">2. Oficina e Revisão</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  -{formatPct(mechanicalExpenses)}
                </span>
              </div>
              <div className="mt-2">
                <span className="font-mono text-base sm:text-lg font-bold text-rose-400 block">
                  -{formatCurrency(mechanicalExpenses)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Reparos, peças, pneus e revisões
                </span>
              </div>
            </div>

            {/* 3. Financiamento (Aquisição) */}
            <div className={`bg-slate-800/50 border rounded-xl p-3.5 flex flex-col justify-between ${
              considerVehicleFinancing ? 'border-indigo-500/30' : 'border-slate-700/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">3. Financiamento</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  -{formatPct(financingExpenses)}
                </span>
              </div>
              <div className="mt-2">
                <span className="font-mono text-base sm:text-lg font-bold text-indigo-300 block">
                  -{formatCurrency(financingExpenses)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {considerVehicleFinancing ? 'Parcelas fixas consideradas' : 'Desconsiderado na margem atual'}
                </span>
              </div>
            </div>

            {/* 4. Seguro, IPVA e Outros */}
            <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wider">4. Seguro / IPVA / Outros</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  -{formatPct(fixedAndOtherExpenses)}
                </span>
              </div>
              <div className="mt-2">
                <span className="font-mono text-base sm:text-lg font-bold text-amber-300 block">
                  -{formatCurrency(fixedAndOtherExpenses)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate" title={`Seguro: ${formatCurrency(insuranceExpenses)} | IPVA/Taxas: ${formatCurrency(taxExpenses)} | Outros: ${formatCurrency(otherExpenses)}`}>
                  Seg: {formatPct(insuranceExpenses)} • IPVA/Tx: {formatPct(taxExpenses)}{otherExpenses > 0 ? ` • Out: ${formatPct(otherExpenses)}` : ''}
                </span>
              </div>
            </div>

            {/* 5. Resultado Líquido & Margem Líquida */}
            <div className={`rounded-xl p-3.5 flex flex-col justify-between border ${
              displayedProfit >= 0
                ? 'bg-emerald-950/60 border-emerald-500/50'
                : 'bg-rose-950/60 border-rose-500/50'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-white uppercase tracking-wider">
                  5. {considerVehicleFinancing ? 'Margem C/ Financ.' : 'Margem S/ Financ.'}
                </span>
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                  displayedProfit >= 0
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-rose-400 text-slate-950'
                }`}>
                  {displayedProfit >= 0 ? '+' : ''}{displayedMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </span>
              </div>
              <div className="mt-2">
                <span className={`font-mono text-base sm:text-lg font-black block ${
                  displayedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {displayedProfit >= 0 ? '+' : ''}{formatCurrency(displayedProfit)}
                </span>
                <span className="text-[10px] text-slate-300 block mt-0.5">
                  Custos Considerados: {formatCurrency(consideredExpensesTotal)} ({totalExpensesPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                </span>
              </div>
            </div>
          </div>

          {/* PROPORTIONAL REVENUE DISTRIBUTION BAR */}
          {totalRevenues > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5 font-sans">
                <span className="font-semibold">Distribuição Percentual da Receita do Veículo:</span>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"></span>
                    Oficina/Revisão ({mechanicalPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block"></span>
                    Financiamento ({financingPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"></span>
                    Seguro/IPVA/Outros ({fixedAndOtherPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block"></span>
                    Margem Líquida ({netMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                  </span>
                </div>
              </div>
              <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, mechanicalPct))}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Oficina, Reparos e Revisão: ${formatCurrency(mechanicalExpenses)} (${formatPct(mechanicalExpenses)})`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, financingPct))}%` }}
                  className="bg-indigo-500 h-full transition-all duration-500"
                  title={`Financiamento: ${formatCurrency(financingExpenses)} (${formatPct(financingExpenses)})`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, fixedAndOtherPct))}%` }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Seguro, IPVA e Outros: ${formatCurrency(fixedAndOtherExpenses)} (${formatPct(fixedAndOtherExpenses)})`}
                />
                {netMarginPct > 0 && (
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, netMarginPct))}%` }}
                    className="bg-emerald-400 h-full transition-all duration-500"
                    title={`Margem Líquida: ${formatCurrency(netProfit)} (${formatPct(netProfit)})`}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* GRID SECTION: ACTIVE LEASE AND DETAILS vs TRANSACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Contract Info Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <User className="h-4 w-4 text-brand-500" />
                Locatário & Contrato Ativo
              </h3>

              {activeRent ? (
                <div className="space-y-4">
                  <div className="p-3 bg-brand-50/50 rounded-xl space-y-2 border border-brand-100/50">
                    <div>
                      <span className="text-[10px] text-slate-450 font-semibold block">NOME DO MOTORISTA</span>
                      <span className="text-sm font-bold text-slate-800">{activeRent.tenantName}</span>
                    </div>
                    {activeRent.phone && (
                      <div>
                        <span className="text-[10px] text-slate-450 font-semibold block">TELEFONE DE CONTATO</span>
                        <span className="text-xs font-semibold font-mono text-slate-700">{formatPhoneNumber(activeRent.phone)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Taxa do Contrato:</span>
                      <span className="font-bold text-slate-700 font-mono">{formatCurrency(activeRent.weeklyRate)}/sem</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Caução Retido:</span>
                      <span className="font-bold text-slate-700 font-mono">{formatCurrency(activeRent.depositValue)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Data de Início:</span>
                      <span className="font-semibold text-slate-700 font-mono">
                        {new Date(activeRent.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Vencimento Esperado:</span>
                      <span className="font-semibold text-slate-700 font-mono">
                        {new Date(activeRent.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1.5">
                      <span className="text-slate-500 font-medium">Prazo Restante:</span>
                      {daysLeft !== null && daysLeft > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {daysLeft} dias estimativos
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                          Prazo Indeterminado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  Este veículo não possui nenhum contrato ativo no momento.
                </div>
              )}
            </div>

            {/* PERFORMANCE ANALYSIS */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Desempenho Financeiro Detalhado
                </h3>
                <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-full border ${
                  netProfit >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  Margem: {netProfit >= 0 ? '+' : ''}{netMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                </span>
              </div>
              
              <div className="space-y-3.5">
                {/* Result header */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 rounded-lg text-center border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-sans">Receitas Acumuladas</span>
                    <span className="text-xs font-bold font-mono text-emerald-600">{formatCurrency(totalRevenues)}</span>
                    <span className="text-[9px] font-mono text-slate-400 block">100,0%</span>
                  </div>
                  <div className="p-2.5 bg-brand-50/50 rounded-lg text-center border border-brand-100/50">
                    <span className="text-[10px] text-brand-600 font-semibold block font-sans">Resultado Líquido</span>
                    <span className={`text-xs font-black font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(netProfit)}
                    </span>
                    <span className={`text-[9px] font-mono font-bold block ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Margem Líquida: {netMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-100 pt-3 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Custos Separados por Natureza</h4>

                  {/* Mechanical mechanicalExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Custos de Oficina, Reparo e Revisão</span>
                      <span className="text-[9px] text-slate-400 font-sans">Manutenção mecânica, peças e pneus (sem financiamento)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-600 font-mono text-xs block">{formatCurrency(mechanicalExpenses)}</span>
                      <span className="text-[9px] font-mono text-slate-400">{formatPct(mechanicalExpenses)} da receita</span>
                    </div>
                  </div>

                  {/* Financing financingExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Financiamento (Aquisição)</span>
                      <span className="text-[9px] text-slate-400 font-sans">Parcelas bancárias / consórcio do veículo</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600 font-mono text-xs block">{formatCurrency(financingExpenses)}</span>
                      <span className="text-[9px] font-mono text-slate-400">{formatPct(financingExpenses)} da receita</span>
                    </div>
                  </div>

                  {/* Insurance insuranceExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Seguro Veicular</span>
                      <span className="text-[9px] text-slate-400 font-sans">Apólices e proteção individualizada</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-blue-600 font-mono text-xs block">{formatCurrency(insuranceExpenses)}</span>
                      <span className="text-[9px] font-mono text-slate-400">{formatPct(insuranceExpenses)} da receita</span>
                    </div>
                  </div>

                  {/* Taxes taxExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Impostos / IPVA / Emplacamento</span>
                      <span className="text-[9px] text-slate-400 font-sans">IPVA, licenciamento e taxas estaduais</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-600 font-mono text-xs block">{formatCurrency(taxExpenses)}</span>
                      <span className="text-[9px] font-mono text-slate-400">{formatPct(taxExpenses)} da receita</span>
                    </div>
                  </div>

                  {/* Other otherExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Outras Despesas</span>
                      <span className="text-[9px] text-slate-400 font-sans">Frete, contratos e gastos diversos</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-500 font-mono text-xs block">{formatCurrency(otherExpenses)}</span>
                      <span className="text-[9px] font-mono text-slate-400">{formatPct(otherExpenses)} da receita</span>
                    </div>
                  </div>
                </div>

                {/* Substats */}
                <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 text-[11px] border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Resultado Operacional (Sem Financ.):</span>
                    <strong className="text-indigo-700 font-mono">
                      {formatCurrency(operationalProfit)} ({operationalMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Comprometimento c/ Oficina e Revisão:</span>
                    <strong className="text-rose-600 font-mono">
                      {formatPct(mechanicalExpenses)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Comprometimento c/ Financiamento:</span>
                    <strong className="text-indigo-600 font-mono">
                      {formatPct(financingExpenses)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Histórico de Locações:</span>
                    <strong className="text-slate-700">{pastRentals.length} encerrada(s)</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* HISTÓRICO DE QUILOMETRAGEM */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2 pb-1 border-b border-slate-50">
                <Milestone className="h-4.5 w-4.5 text-indigo-500" />
                Histórico de Quilometragem
              </h3>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {selectedVehicle.mileageHistory && selectedVehicle.mileageHistory.length > 0 ? (
                  selectedVehicle.mileageHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100/30 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 font-mono text-xs">{entry.mileage.toLocaleString('pt-BR')} KM</span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded font-bold bg-indigo-55 bg-indigo-50 text-indigo-600 uppercase tracking-wider">
                            {entry.source || 'Ajuste Manual'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-450 block">{entry.notes || 'Alteração registrada'}</span>
                      </div>
                      <span className="font-mono text-[9px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    Nenhum histórico de alteração de quilometragem registrado ainda.
                    {selectedVehicle.mileage !== undefined && selectedVehicle.mileage !== null && (
                      <p className="text-[10px] text-slate-500 mt-1 not-italic">
                        KM atual no cadastro: <strong className="font-mono text-indigo-600">{selectedVehicle.mileage.toLocaleString('pt-BR')} KM</strong> em {selectedVehicle.mileageDate ? new Date(selectedVehicle.mileageDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'data de cadastro'}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Individual Register Transactions Ledger */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-50">
                <div>
                  <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-500" />
                    Extrato Financeiro Individualizado ({vehicleTransactions.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Lançamentos de caixa e transações vinculados a este veículo específico.</p>
                </div>
                {!isSocio && (
                  <button
                    onClick={() => {
                      setEditingTx(null);
                      setTxType('despesa');
                      setTxValue('');
                      setTxCategory('Manutenção');
                      setTxDescription('');
                      setTxDate(getBrasiliaDateStr());
                      setShowAddTxModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Lançar Transação
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {vehicleTransactions.map((t) => {
                  const increment = t.type === 'receita' || t.type === 'caucao_recebido';
                  const isFuture = t.date > getBrasiliaDateStr();
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl text-xs transition-all duration-250 border group ${
                        isFuture 
                          ? 'bg-slate-50/70 border-slate-100/90 text-slate-400 opacity-65 font-mono italic' 
                          : 'bg-slate-50 hover:bg-slate-100/50 border-slate-100/30'
                      }`}
                    >
                      <div className="truncate pr-3 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isFuture ? 'text-slate-400 italic font-mono' : 'text-slate-700'}`}>
                            {isFuture && <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.2 rounded mr-1 uppercase font-semibold font-sans not-italic">Previsto</span>}
                            {t.description}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            isFuture ? 'bg-slate-100 text-slate-400 border border-slate-200/50' :
                            t.type === 'receita' ? 'bg-emerald-50 text-emerald-600' :
                            t.type === 'despesa' ? 'bg-rose-50 text-rose-600' :
                            t.type === 'caucao_recebido' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-150 text-slate-600'
                          }`}>
                            {isFuture ? 'PREVISTO' :
                             t.type === 'receita' ? 'ALUGUEL' :
                             t.type === 'despesa' ? `DESPESA - ${t.category.toUpperCase()}` :
                             t.type === 'caucao_recebido' ? 'CAUÇÃO IN' : 'CAUÇÃO OUT'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span className="font-mono">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          <span>•</span>
                          <span>{t.category}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-3">
                        <span className={`font-mono ${isFuture ? 'text-slate-400 font-normal italic' : increment ? 'text-emerald-500 font-bold' : 'text-rose-500 font-normal'}`}>
                          {increment ? '+' : '-'} {formatCurrency(t.value)}
                        </span>
                        {!isSocio && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTx(t);
                                setTxType(t.type);
                                setTxValue(t.value);
                                setTxCategory(t.category);
                                setTxDescription(t.description);
                                setTxDate(t.date);
                                setShowAddTxModal(true);
                              }}
                              className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded transition-all"
                              title="Editar Lançamento"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Tem certeza que deseja remover este lançamento do extrato?')) {
                                  onDeleteTransaction?.(t.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-50 text-rose-550 hover:text-rose-750 rounded transition-all"
                              title="Excluir Lançamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {vehicleTransactions.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Nenhum lançamento no extrato para este veículo ainda.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
              <span>Transações rastreadas no caixa administrativo da empresa para a placa {selectedVehicle.plate}.</span>
            </div>
          </div>
        </div>

        {/* SEÇÃO ADICIONAL: PRESTAÇÃO DE CONTAS INTEGRADA & ANÁLISE DE EFICIÊNCIA OPERACIONAL */}
        {(() => {
          // Dynamic month extraction
          const monthsSet = new Set<string>();
          vehicleTransactions.forEach(t => {
            if (t.date) {
              monthsSet.add(t.date.substring(0, 7)); // YYYY-MM
            }
          });

          const vRentals = rentals.filter(r => r.vehicleId === selectedVehicle.id && !r.isDeleted);
          vRentals.forEach(r => {
            if (r.startDate) monthsSet.add(r.startDate.substring(0, 7));
            if (r.endDate) monthsSet.add(r.endDate.substring(0, 7));
          });

          if (selectedVehicle.monthlyMileages) {
            Object.keys(selectedVehicle.monthlyMileages).forEach(m => monthsSet.add(m));
          }

          // Fallback to current month if empty
          const currentMonthStr = getBrasiliaDateStr().substring(0, 7);
          monthsSet.add(currentMonthStr);
          const sortedMonths = Array.from(monthsSet).sort();

          const getMonthNamePortuguese = (mStr: string) => {
            const [year, month] = mStr.split('-');
            const monthIdx = parseInt(month, 10) - 1;
            const monthNames = [
              'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
              'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
            ];
            return `${monthNames[monthIdx] || month} / ${year}`;
          };

          // Pre-calculate monthly rows so we can show non-redundant analytical KPIs at the top
          let totalEntradasAll = 0;
          let totalCustosAll = 0;
          let totalMechanicalAll = 0;
          let totalFinancingAll = 0;
          let totalOtherCostsAll = 0;
          let profitableMonthsCount = 0;
          let activeFinancialMonthsCount = 0;

          const monthlyRowsData = sortedMonths.map((mStr, idx) => {
            const mTransactions = vehicleTransactions.filter(t => t.date.startsWith(mStr));
            const mEntradas = mTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.value, 0);
            const mCustos = mTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.value, 0);
            const mMechanical = mTransactions.filter(isVehMechanicalExpense).reduce((sum, t) => sum + t.value, 0);
            const mFinancing = mTransactions.filter(isVehFinancingExpense).reduce((sum, t) => sum + t.value, 0);
            const mOtherCosts = Math.max(0, Number((mCustos - mMechanical - mFinancing).toFixed(2)));
            const mRentabilidade = mEntradas - mCustos;
            const mMarginPct = mEntradas > 0 ? (mRentabilidade / mEntradas) * 100 : 0;

            totalEntradasAll += mEntradas;
            totalCustosAll += mCustos;
            totalMechanicalAll += mMechanical;
            totalFinancingAll += mFinancing;
            totalOtherCostsAll += mOtherCosts;

            if (mEntradas > 0 || mCustos > 0) {
              activeFinancialMonthsCount += 1;
              if (mRentabilidade > 0) profitableMonthsCount += 1;
            }

            const savedKm = selectedVehicle.monthlyMileages?.[mStr];
            // Find previous recorded monthly mileage for delta calculation
            let prevSavedKm: number | undefined = undefined;
            for (let p = idx - 1; p >= 0; p--) {
              const candidate = selectedVehicle.monthlyMileages?.[sortedMonths[p]];
              if (candidate !== undefined && candidate > 0) {
                prevSavedKm = candidate;
                break;
              }
            }
            const kmDelta = (savedKm !== undefined && prevSavedKm !== undefined && savedKm >= prevSavedKm)
              ? savedKm - prevSavedKm
              : null;

            return {
              mStr,
              mTransactions,
              mEntradas,
              mCustos,
              mMechanical,
              mFinancing,
              mOtherCosts,
              mRentabilidade,
              mMarginPct,
              savedKm,
              kmDelta
            };
          });

          const monthsDivisor = Math.max(1, activeFinancialMonthsCount || sortedMonths.length);
          const avgMonthlyRevenue = totalEntradasAll / monthsDivisor;
          const avgMonthlyNetProfit = (totalEntradasAll - totalCustosAll) / monthsDivisor;

          // Calculate total tracked KM for efficiency per KM metrics
          const recordedMileages = Object.values(selectedVehicle.monthlyMileages || {}).filter((v): v is number => typeof v === 'number' && v > 0);
          if (selectedVehicle.mileage && selectedVehicle.mileage > 0) {
            recordedMileages.push(selectedVehicle.mileage);
          }
          if (selectedVehicle.mileageHistory && selectedVehicle.mileageHistory.length > 0) {
            selectedVehicle.mileageHistory.forEach(h => {
              if (h.mileage > 0) recordedMileages.push(h.mileage);
            });
          }
          const maxRecordedKm = recordedMileages.length > 0 ? Math.max(...recordedMileages) : 0;
          const minRecordedKm = recordedMileages.length > 1 ? Math.min(...recordedMileages) : 0;
          const trackedKmSpan = (maxRecordedKm > minRecordedKm && minRecordedKm > 0)
            ? (maxRecordedKm - minRecordedKm)
            : maxRecordedKm;

          const mechanicalCostPerKm = trackedKmSpan > 0 ? totalMechanicalAll / trackedKmSpan : 0;
          const netProfitPerKm = trackedKmSpan > 0 ? (totalEntradasAll - totalCustosAll) / trackedKmSpan : 0;

          // Associated future expenses (installment contracts, financing, insurance, IPVA)
          const associatedFutureExpenses = futureExpenses.filter(fe => fe.vehicleId === selectedVehicle.id);

          // Vacancy & Break-even calculations (non-redundant operational metrics)
          const vacancyMetrics = calculateVacancyForVehicle(selectedVehicle, rentals);
          const totalTrackedDays = vacancyMetrics.totalCountableDays || 0;
          const rentedDaysCount = Math.max(0, totalTrackedDays - vacancyMetrics.vacantDays);
          const occupancyRatePct = totalTrackedDays > 0 ? (rentedDaysCount / totalTrackedDays) * 100 : (activeRent ? 100 : 0);

          // Fixed monthly obligation estimate based on active installment contracts or historical average
          const monthlyFixedInstallments = associatedFutureExpenses.reduce((sum, fe) => {
            const hasPending = fe.installments?.some((inst: any) => inst.status === 'pending' || inst.status === 'pendente');
            return sum + (hasPending ? fe.value : 0);
          }, 0);
          const effectiveMonthlyFixedCost = monthlyFixedInstallments > 0
            ? monthlyFixedInstallments
            : ((totalFinancingAll + totalOtherCostsAll) / monthsDivisor);
          const weeklyRateRef = activeRent?.weeklyRate || selectedVehicle.weeklyRate || 650;
          const estimatedIdleCost = (vacancyMetrics.vacantDays / 7) * weeklyRateRef;
          const breakEvenWeeksPerMonth = weeklyRateRef > 0 ? (effectiveMonthlyFixedCost / weeklyRateRef) : 0;

          // Helper to commit KM measurement (both quick bar and monthly row)
          const handleCommitMonthlyKm = (mStr: string, rawVal: string) => {
            const trimmed = rawVal.trim();
            const currentMileages = { ...(selectedVehicle.monthlyMileages || {}) };
            if (trimmed === '') {
              delete currentMileages[mStr];
              onUpdateVehicle(selectedVehicle.id, { monthlyMileages: currentMileages });
              return;
            }
            const numericKm = Number(trimmed);
            if (!Number.isFinite(numericKm) || numericKm < 0) return;

            currentMileages[mStr] = numericKm;
            const updates: Partial<Vehicle> = {
              monthlyMileages: currentMileages
            };
            // Also sync main vehicle odometer if this is the latest month or higher than current mileage
            if (mStr >= currentMonthStr || numericKm >= (selectedVehicle.mileage || 0)) {
              updates.mileage = numericKm;
              updates.mileageDate = getBrasiliaDateStr();
            }
            onUpdateVehicle(selectedVehicle.id, updates);
          };

          const handleQuickKmSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const numericKm = Number(quickKmInput);
            if (!Number.isFinite(numericKm) || numericKm <= 0) return;
            const targetDate = quickKmDate || getBrasiliaDateStr();
            const targetMonth = targetDate.substring(0, 7);
            const currentMileages = { ...(selectedVehicle.monthlyMileages || {}), [targetMonth]: numericKm };

            onUpdateVehicle(selectedVehicle.id, {
              mileage: numericKm,
              mileageDate: targetDate,
              monthlyMileages: currentMileages
            });
            setMonthlyKmDrafts(prev => ({
              ...prev,
              [`${selectedVehicle.id}_${targetMonth}`]: String(numericKm)
            }));
            setQuickKmInput('');
          };

          return (
            <div className="mt-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 shadow-premium-lg space-y-6">
              {/* HEADER + AFERIÇÃO RÁPIDA DE HODÔMETRO */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-widest font-mono">
                    Inteligência Operacional & Competência Mensal
                  </span>
                  <h4 className="font-display font-bold text-slate-100 text-lg mt-1.5 flex items-center gap-2">
                    <NotebookTabs className="h-5 w-5 text-indigo-400" />
                    Evolução Mensal, Aferição de KM e Passivos - {selectedVehicle.brandModel.toUpperCase()}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    Indicadores de produtividade por quilômetro, fechamento mensal por competência, amortização de contratos e ponto de equilíbrio.
                  </p>
                </div>

                {/* WIDGET FUNCIONAL DE AFERIÇÃO DE KM ATUAL */}
                <form
                  onSubmit={handleQuickKmSubmit}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5 self-start lg:self-auto"
                >
                  <div className="flex items-center gap-2 pr-1">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Milestone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Hodômetro Atual: <strong className="text-slate-100 font-mono">{selectedVehicle.mileage ? `${selectedVehicle.mileage.toLocaleString('pt-BR')} km` : 'Não aferido'}</strong>
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {selectedVehicle.mileageDate
                          ? `Última aferição em ${new Date(selectedVehicle.mileageDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                          : 'Registre a quilometragem atual do veículo'}
                      </span>
                    </div>
                  </div>
                  {!isSocio && (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quickKmInput}
                        onChange={(e) => setQuickKmInput(e.target.value)}
                        placeholder={selectedVehicle.mileage ? `Ex: ${selectedVehicle.mileage + 500}` : 'Novo KM'}
                        className="bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 w-28 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={quickKmDate}
                        onChange={(e) => setQuickKmDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none"
                        title="Data da aferição"
                      />
                      <button
                        type="submit"
                        disabled={!quickKmInput || Number(quickKmInput) <= 0}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aferir KM
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* FAIXA DE INDICADORES ANALÍTICOS INÉDITOS (NÃO REDUNDANTES COM O TOPO) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Faturamento Médio Mensal
                  </span>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                    {formatCurrency(avgMonthlyRevenue)}<span className="text-xs font-normal text-slate-500"> / mês</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Baseado em {monthsDivisor} {monthsDivisor === 1 ? 'mês apurado' : 'meses apurados'}
                  </span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Resultado Líquido Médio
                  </span>
                  <div className={`text-base font-bold font-mono mt-1 ${avgMonthlyNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {avgMonthlyNetProfit >= 0 ? '+' : ''}{formatCurrency(avgMonthlyNetProfit)}<span className="text-xs font-normal text-slate-500"> / mês</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {profitableMonthsCount} de {monthsDivisor} meses fecharam no azul
                  </span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Custo de Oficina por KM
                  </span>
                  <div className="text-base font-bold font-mono text-rose-400 mt-1">
                    {trackedKmSpan > 0 ? `${formatCurrency(mechanicalCostPerKm)} / km` : 'Aferir KM'}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {trackedKmSpan > 0
                      ? `Base: ${trackedKmSpan.toLocaleString('pt-BR')} km monitorados`
                      : 'Registre o hodômetro para calcular R$/km'}
                  </span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Ponto de Equilíbrio Mensal
                  </span>
                  <div className="text-base font-bold font-mono text-indigo-300 mt-1">
                    {effectiveMonthlyFixedCost > 0
                      ? `${breakEvenWeeksPerMonth.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sem. aluguel`
                      : '0,0 sem. (Sem Custo Fixo)'}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Custo fixo est.: {formatCurrency(effectiveMonthlyFixedCost)}/mês (ref. {formatCurrency(weeklyRateRef)}/sem)
                  </span>
                </div>
              </div>

              {/* GRELHA MÊS A MÊS */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    Fechamento Mensal por Competência & Evolução de Hodômetro
                  </h5>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Digite o KM do mês e clique em <strong className="text-indigo-300">Aferir</strong> (ou pressione Enter) para gravar no histórico.
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                        <th className="p-3">Mês de Competência</th>
                        <th className="p-3 text-right">Entradas (Aluguéis)</th>
                        <th className="p-3 text-right">Oficina / Revisão</th>
                        <th className="p-3 text-right">Financiamento</th>
                        <th className="p-3 text-right">Seguro / IPVA / Outros</th>
                        <th className="p-3 text-right">Resultado & Margem</th>
                        <th className="p-3 text-center w-52">Aferição de KM Mensal</th>
                        <th className="p-3">Anotações Gerenciais do Mês</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-sans">
                      {monthlyRowsData.map((row) => {
                        const {
                          mStr,
                          mEntradas,
                          mMechanical,
                          mFinancing,
                          mOtherCosts,
                          mRentabilidade,
                          mMarginPct,
                          savedKm,
                          kmDelta
                        } = row;

                        const kmDraftKey = `${selectedVehicle.id}_${mStr}`;
                        const currentKmDraft = monthlyKmDrafts[kmDraftKey] !== undefined
                          ? monthlyKmDrafts[kmDraftKey]
                          : (savedKm !== undefined ? String(savedKm) : '');
                        const isKmDirty = currentKmDraft !== (savedKm !== undefined ? String(savedKm) : '');

                        const savedNote = selectedVehicle.monthlyNotes?.[mStr] || '';
                        const currentNoteDraft = monthlyNoteDrafts[kmDraftKey] !== undefined
                          ? monthlyNoteDrafts[kmDraftKey]
                          : savedNote;
                        const isNoteDirty = currentNoteDraft !== savedNote;

                        return (
                          <tr key={mStr} className="hover:bg-slate-900/30 transition-colors">
                            <td className="p-3 font-semibold text-slate-300 uppercase whitespace-nowrap">
                              {getMonthNamePortuguese(mStr)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                              {mEntradas > 0 ? `+${formatCurrency(mEntradas)}` : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right font-mono text-rose-400 whitespace-nowrap">
                              {mMechanical > 0 ? `-${formatCurrency(mMechanical)}` : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right font-mono text-indigo-300 whitespace-nowrap">
                              {mFinancing > 0 ? `-${formatCurrency(mFinancing)}` : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right font-mono text-amber-300 whitespace-nowrap">
                              {mOtherCosts > 0 ? `-${formatCurrency(mOtherCosts)}` : formatCurrency(0)}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className={`font-mono font-bold ${mRentabilidade > 0 ? 'text-emerald-400' : mRentabilidade < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                {mRentabilidade > 0 ? '+' : ''}{formatCurrency(mRentabilidade)}
                              </div>
                              {mEntradas > 0 && (
                                <span className={`text-[10px] font-mono ${mMarginPct >= 0 ? 'text-emerald-500/80' : 'text-rose-400/80'}`}>
                                  Margem: {mMarginPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-center font-mono text-xs w-24 px-2 py-1 text-slate-100 focus:outline-none"
                                    value={currentKmDraft}
                                    placeholder="KM do mês"
                                    disabled={isSocio}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setMonthlyKmDrafts(prev => ({ ...prev, [kmDraftKey]: val }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCommitMonthlyKm(mStr, currentKmDraft);
                                      }
                                    }}
                                  />
                                  {!isSocio && (
                                    <button
                                      type="button"
                                      onClick={() => handleCommitMonthlyKm(mStr, currentKmDraft)}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        isKmDirty
                                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                                          : savedKm !== undefined
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                      title="Confirmar e salvar aferição de quilometragem deste mês"
                                    >
                                      {isKmDirty ? 'Aferir' : savedKm !== undefined ? 'Aferido' : 'Aferir'}
                                    </button>
                                  )}
                                </div>
                                {kmDelta !== null && kmDelta > 0 && (
                                  <span className="text-[10px] font-mono text-indigo-300">
                                    +{kmDelta.toLocaleString('pt-BR')} km rodados no mês
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-left px-2.5 py-1 text-xs w-full text-slate-200 focus:outline-none placeholder-slate-600"
                                  value={currentNoteDraft}
                                  placeholder="Adicionar observação gerencial para este mês..."
                                  disabled={isSocio}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setMonthlyNoteDrafts(prev => ({ ...prev, [kmDraftKey]: val }));
                                  }}
                                  onBlur={() => {
                                    if (isNoteDirty) {
                                      const currentNotes = { ...(selectedVehicle.monthlyNotes || {}), [mStr]: currentNoteDraft };
                                      onUpdateVehicle(selectedVehicle.id, { monthlyNotes: currentNotes });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && isNoteDirty) {
                                      e.preventDefault();
                                      const currentNotes = { ...(selectedVehicle.monthlyNotes || {}), [mStr]: currentNoteDraft };
                                      onUpdateVehicle(selectedVehicle.id, { monthlyNotes: currentNotes });
                                    }
                                  }}
                                />
                                {!isSocio && isNoteDirty && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentNotes = { ...(selectedVehicle.monthlyNotes || {}), [mStr]: currentNoteDraft };
                                      onUpdateVehicle(selectedVehicle.id, { monthlyNotes: currentNotes });
                                    }}
                                    className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase cursor-pointer shrink-0"
                                  >
                                    Salvar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {/* TOTAL ROW */}
                      <tr className="bg-slate-900/80 font-bold border-t border-slate-700">
                        <td className="p-3 text-slate-200">TOTAL ACUMULADO</td>
                        <td className="p-3 text-right font-mono text-emerald-400">+{formatCurrency(totalEntradasAll)}</td>
                        <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(totalMechanicalAll)}</td>
                        <td className="p-3 text-right font-mono text-indigo-300">-{formatCurrency(totalFinancingAll)}</td>
                        <td className="p-3 text-right font-mono text-amber-300">-{formatCurrency(totalOtherCostsAll)}</td>
                        <td className={`p-3 text-right font-mono ${totalEntradasAll - totalCustosAll >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalEntradasAll - totalCustosAll >= 0 ? '+' : ''}{formatCurrency(totalEntradasAll - totalCustosAll)}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-300">
                          {selectedVehicle.mileage ? `${selectedVehicle.mileage.toLocaleString('pt-BR')} KM` : '-'}
                        </td>
                        <td className="p-3 text-indigo-300 font-sans text-xs">
                          {netProfitPerKm !== 0 && trackedKmSpan > 0
                            ? `Rentabilidade líquida de ${formatCurrency(netProfitPerKm)} por KM monitorado.`
                            : `Média líquida de ${formatCurrency(avgMonthlyNetProfit)}/mês nos períodos apurados.`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAINÉIS INFERIORES NÃO REDUNDANTES: AMORTIZAÇÃO DE CONTRATOS & TAXA DE OCUPAÇÃO / HISTÓRICO DE KM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* CARD 1: PROGRESSO DE AMORTIZAÇÃO DE PASSIVOS E CONTRATOS PARCELADOS */}
                <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-3.5 font-sans">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      Amortização de Contratos & Passivos Vinculados
                    </h5>
                    <span className="text-[10px] font-mono text-slate-400">
                      {associatedFutureExpenses.length} {associatedFutureExpenses.length === 1 ? 'contrato' : 'contratos'}
                    </span>
                  </div>

                  {associatedFutureExpenses.length > 0 ? (
                    <div className="space-y-3 text-xs">
                      {associatedFutureExpenses.map(fe => {
                        const totalInstallments = fe.installments?.length || fe.installmentsCount || 1;
                        const paidInstallments = fe.installments
                          ? fe.installments.filter((i: any) => i.status === 'realized' || i.status === 'pago').length
                          : 0;
                        const pendingInstallments = Math.max(0, totalInstallments - paidInstallments);
                        const totalContractValue = fe.value * totalInstallments;
                        const paidValue = paidInstallments * fe.value;
                        const remainingDebt = pendingInstallments * fe.value;
                        const progressPct = totalInstallments > 0 ? Math.min(100, (paidInstallments / totalInstallments) * 100) : 0;
                        const nextPending = fe.installments
                          ?.filter((i: any) => i.status === 'pending' || i.status === 'pendente')
                          .sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate))[0];

                        return (
                          <div key={fe.id} className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-200 truncate">
                                {fe.description || fe.category}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shrink-0">
                                {paidInstallments}/{totalInstallments} pagas ({progressPct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Parcela</span>
                                <span className="font-mono text-slate-300 font-semibold">{formatCurrency(fe.value)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Quitado</span>
                                <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(paidValue)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-500 block text-[10px]">Saldo a Pagar</span>
                                <span className="font-mono text-rose-400 font-semibold">{formatCurrency(remainingDebt)}</span>
                              </div>
                            </div>
                            {nextPending && (
                              <div className="text-[10px] text-amber-300/90 font-mono pt-1 border-t border-slate-800/60 flex justify-between">
                                <span>Próximo vencimento (Parcela {nextPending.installmentNumber || nextPending.number}/{totalInstallments}):</span>
                                <span>{new Date(nextPending.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              </div>
                            )}
                            {!nextPending && totalContractValue > 0 && (
                              <div className="text-[10px] text-emerald-400 font-mono pt-1 border-t border-slate-800/60">
                                Contrato 100% quitado ({formatCurrency(totalContractValue)})
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-6 text-center italic border border-dashed border-slate-800 rounded-lg">
                      Nenhum contrato parcelado (Financiamento, Seguro ou IPVA) vinculado a este veículo em Despesas Futuras.
                    </div>
                  )}
                </div>

                {/* CARD 2: EFICIÊNCIA DE OCUPAÇÃO E ÚLTIMAS AFERIÇÕES DE HODÔMETRO */}
                <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-4 flex flex-col justify-between font-sans">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-amber-400" />
                        Eficiência de Ocupação & Histórico de Aferições de KM
                      </h5>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Ocupação: {occupancyRatePct.toFixed(1)}%
                      </span>
                    </div>

                    {/* Ocupação vs Ociosidade */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Dias Alugados</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">{rentedDaysCount} dias</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Dias Parados</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">{vacancyMetrics.vacantDays} dias</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block">Custo Ociosidade</span>
                        <span className="font-mono font-bold text-rose-400 text-sm">{formatCurrency(estimatedIdleCost)}</span>
                      </div>
                    </div>

                    {/* Últimas Aferições de KM Registradas */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Últimas Aferições de Hodômetro Registradas
                      </span>
                      {(selectedVehicle.mileageHistory && selectedVehicle.mileageHistory.length > 0) ? (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {selectedVehicle.mileageHistory.slice(0, 4).map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-[11px] bg-slate-900/40 border border-slate-800/60 rounded px-2.5 py-1"
                            >
                              <span className="text-slate-400 truncate max-w-[180px]">{entry.notes || 'Aferição de Hodômetro'}</span>
                              <div className="flex items-center gap-3 font-mono shrink-0">
                                <span className="text-slate-500 text-[10px]">
                                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-indigo-300 font-semibold">
                                  {entry.mileage.toLocaleString('pt-BR')} km
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">
                          Nenhuma aferição anterior registrada no histórico. Utilize o botão "Aferir KM" acima ou na tabela mensal.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-400 italic border-t border-slate-800/60 pt-2 flex items-center justify-between font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      Dados sincronizados com o livro-caixa e controle de frota
                    </span>
                    <span>{vRentals.length} {vRentals.length === 1 ? 'contrato histórico' : 'contratos históricos'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL: CUSTOM DELETE CONFIRMATION WITH OPTIONS */}
        {showDeleteModal && selectedVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans relative overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-rose-500" />
                    Excluir Veículo
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Confirmar saída do veículo: <strong className="text-slate-600 font-semibold">{selectedVehicle.brandModel} ({selectedVehicle.plate})</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 my-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Escolha o método de exclusão. Os dados gerados enquanto o veículo existia podem ser preservados ou completamente expurgados do livro-caixa:
                </p>

                {/* Choices */}
                <div className="grid grid-cols-1 gap-3">
                  {/* Option 1: Preserve History */}
                  <div
                    onClick={() => setDeletePurgeChoice('preserve')}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex gap-3.5 items-start ${
                      deletePurgeChoice === 'preserve'
                        ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/10'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/45'
                    }`}
                  >
                    <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'preserve' ? 'bg-emerald-105 bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700">Preservar Lançamentos Financeiros (Recomendado)</span>
                      <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                        O veículo é removido da frota visível e novas locações para ele ficam desabilitadas. No entanto, <strong>todas as receitas passadas, despesas registradas e cauções de seus contratos continuarão constando no caixa geral</strong> para garantir relatórios corretos de períodos passados.
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Purge History */}
                  <div
                    onClick={() => setDeletePurgeChoice('purge')}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex gap-3.5 items-start ${
                      deletePurgeChoice === 'purge'
                        ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/10'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/45'
                    }`}
                  >
                    <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'purge' ? 'bg-rose-100 text-rose-650 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700">Apagar Todo o Histórico (Excepcional)</span>
                      <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                        Exclui permanentemente o veículo, todos os seus contratos e <strong>purga retroativamente todos os lançamentos de caixa vinculados</strong> (receitas de aluguéis e depósitos caução) como se o veículo nunca tivesse existido. <span className="text-rose-500 font-semibold">Esta operação é irreversível!</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-55 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteVehicle(selectedVehicle.id, deletePurgeChoice === 'purge');
                    setShowDeleteModal(false);
                    setSelectedVehicleId(null);
                  }}
                  className={`px-4 py-2 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium ${
                    deletePurgeChoice === 'purge'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                      : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/10'
                  }`}
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT VEHICLE */}
        {showEditVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
              {/* Header */}
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">Editar Veículo</h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">Corrija ou atualize as informações deste veículo.</p>
                </div>
                <button
                  onClick={() => setShowEditVehicle(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={submitEditVehicle} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Marca / Modelo</label>
                    <input
                      type="text"
                      required
                      value={editVehBrandModel}
                      onChange={(e) => setEditVehBrandModel(e.target.value)}
                      className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="Ex: BYD Dolphin Mini"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Placa</label>
                    <input
                      type="text"
                      required
                      value={editVehPlate}
                      onChange={(e) => setEditVehPlate(e.target.value)}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755 placeholder:font-sans uppercase"
                      placeholder="Ex: TYU0E16"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Taxa Sugerida (Semanal)</label>
                    <input
                      type="number"
                      required
                      value={editVehWeeklyRate}
                      onChange={(e) => setEditVehWeeklyRate(Number(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-205 border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="R$ 1300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Caução de Entrada</label>
                    <input
                      type="number"
                      required
                      value={editVehDepositValue}
                      onChange={(e) => setEditVehDepositValue(Number(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-205 border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="R$ 2600"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Data de Entrega do Veículo (Aquisição)</label>
                    <input
                      type="date"
                      required
                      value={editVehAcquisitionDate}
                      onChange={(e) => setEditVehAcquisitionDate(e.target.value)}
                      className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    />
                  </div>

                  <div className="col-span-2 border-t border-dashed border-slate-100 pt-3">
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Aferição de Quilometragem</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">KM Estimado</label>
                    <input
                      type="number"
                      value={editVehMileage}
                      onChange={(e) => setEditVehMileage(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-205 border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="Ex: 8000"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Data do Registro</label>
                    <input
                      type="date"
                      required={editVehMileage !== ''}
                      value={editVehMileageDate}
                      onChange={(e) => setEditVehMileageDate(e.target.value)}
                      className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-205 border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditVehicle(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD/EDIT TRANSACTION (IN SELECTED VEHICLE VIEW) */}
        {showAddTxModal && selectedVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans text-slate-800">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">
                    {editingTx ? 'Editar Lançamento' : 'Novo Lançamento'}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    {editingTx ? 'Altere os dados da transação financeira.' : 'Adicione uma transação para este veículo.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddTxModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (txValue === '') return;
                const txData = {
                  date: txDate,
                  type: txType,
                  value: Number(txValue),
                  category: txCategory,
                  description: txDescription,
                  vehicleId: selectedVehicle.id
                };
                if (editingTx) {
                  onUpdateTransaction?.(editingTx.id, txData);
                } else {
                  onAddTransaction?.(txData);
                }
                setShowAddTxModal(false);
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo de Lançamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTxType('despesa');
                          setTxCategory('Manutenção');
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                          txType === 'despesa'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-350'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Despesa / Custo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTxType('receita');
                          setTxCategory('Aluguel');
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                          txType === 'receita'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-350'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Receita / Aluguel
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-sans text-slate-850"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={txValue}
                      onChange={(e) => setTxValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-mono text-slate-850"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Categoria</label>
                    {txType === 'despesa' ? (
                      <select
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white font-sans text-slate-850"
                      >
                        <option value="Manutenção">Manutenção / Oficina</option>
                        <option value="Seguro">Seguro Veicular</option>
                        <option value="IPVA">IPVA / Impostos</option>
                        <option value="Financiamento">Financiamento</option>
                        <option value="Combustível">Combustível / Carga</option>
                        <option value="Acessórios">Acessórios / Estética</option>
                        <option value="Outros">Outros</option>
                      </select>
                    ) : (
                      <select
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white font-sans text-slate-850"
                      >
                        <option value="Aluguel">Aluguel Semanal</option>
                        <option value="Ajuste de Saldo">Ajuste de Saldo / Cobrança</option>
                        <option value="Outros">Outros</option>
                      </select>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Descrição / Justificativa</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Troca de pastilhas de freio dianteiras"
                      value={txDescription}
                      onChange={(e) => setTxDescription(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-sans text-slate-850"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4 font-sans">
                  <button
                    type="button"
                    onClick={() => setShowAddTxModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold shadow-premium"
                  >
                    {editingTx ? 'Salvar Alterações' : 'Lançar Transação'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: HISTÓRICO DE MANUTENÇÃO DEDICADO DO VEÍCULO (IN SELECTED VEHICLE VIEW) */}
        {maintenanceVehicle && (() => {
          const vehicleMaintenanceList = (transactions || [])
            .filter(t => {
              if (!t || typeof t !== 'object') return false;
              const matchesVehicle = 
                t.vehicleId === maintenanceVehicle.id || 
                (Boolean(maintenanceVehicle.plate) && Boolean(t.description) && t.description.includes(maintenanceVehicle.plate));
              return matchesVehicle && isVehMechanicalExpense(t);
            })
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

          const totalSpent = vehicleMaintenanceList.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
          const count = vehicleMaintenanceList.length;
          const avg = count > 0 ? totalSpent / count : 0;
          const lastDate = count > 0 ? vehicleMaintenanceList[0].date : null;

          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-premium-2xl border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-b border-amber-100 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-850 text-base flex items-center gap-2">
                        Histórico de Manutenções
                        <span className="font-mono text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-200">
                          {maintenanceVehicle.plate}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        {maintenanceVehicle.brandModel} • KM Estimado: {maintenanceVehicle.mileage ? `${maintenanceVehicle.mileage.toLocaleString('pt-BR')} KM` : 'Não registrado'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId(maintenanceVehicle.id);
                        setEditingTx(null);
                        setTxType('despesa');
                        setTxCategory('Manutenção');
                        setTxDescription('');
                        setTxValue('');
                        setTxDate(getBrasiliaDateStr());
                        setShowAddTxModal(true);
                        setMaintenanceVehicle(null);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Nova Manutenção</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaintenanceVehicle(null)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50/60 border-b border-slate-100 shrink-0">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Gasto</span>
                    <span className="text-sm font-bold font-mono text-rose-600 block mt-0.5">
                      {formatCurrency(totalSpent)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Intervenções</span>
                    <span className="text-sm font-bold font-mono text-slate-800 block mt-0.5">
                      {count} {count === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média por Reparo</span>
                    <span className="text-sm font-bold font-mono text-amber-700 block mt-0.5">
                      {formatCurrency(avg)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Última Revisão</span>
                    <span className="text-xs font-semibold font-mono text-slate-700 block mt-1">
                      {lastDate ? formatDateBR(lastDate) : 'Nenhuma'}
                    </span>
                  </div>
                </div>

                <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
                  {vehicleMaintenanceList.length > 0 ? (
                    <div className="space-y-2">
                      {vehicleMaintenanceList.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg mt-0.5 shrink-0 border border-amber-100">
                              <Wrench className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-850 text-xs sm:text-sm">
                                  {item.description}
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                  {item.category}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                                Data: {formatDateBR(item.date)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <span className="font-mono font-bold text-xs sm:text-sm text-rose-600">
                              - {formatCurrency(item.value)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVehicleId(maintenanceVehicle.id);
                                  setEditingTx(item);
                                  setTxType(item.type);
                                  setTxValue(item.value);
                                  setTxCategory(item.category);
                                  setTxDescription(item.description);
                                  setTxDate(item.date);
                                  setShowAddTxModal(true);
                                  setMaintenanceVehicle(null);
                                }}
                                className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                                title="Editar registro de manutenção"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onDeleteTransaction && window.confirm(`Tem certeza que deseja excluir a despesa de manutenção "${item.description}"?`)) {
                                    onDeleteTransaction(item.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir despesa de manutenção"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <div className="p-3 bg-amber-50 rounded-2xl text-amber-500 mb-3 border border-amber-100">
                        <Wrench className="h-8 w-8 stroke-[1.5]" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">Nenhuma manutenção registrada</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Este veículo ainda não possui despesas mecânicas ou revisões lançadas no livro-caixa.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVehicleId(maintenanceVehicle.id);
                          setEditingTx(null);
                          setTxType('despesa');
                          setTxCategory('Manutenção');
                          setTxDescription('');
                          setTxValue('');
                          setTxDate(getBrasiliaDateStr());
                          setShowAddTxModal(true);
                          setMaintenanceVehicle(null);
                        }}
                        className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Lançar Primeira Manutenção
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
                  <span>Histórico individualizado por veículo • Eletroflow Frota</span>
                  <button
                    type="button"
                    onClick={() => setMaintenanceVehicle(null)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Header Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-premium">
        <div>
          <h2 className="font-display font-bold text-slate-800 text-xl">Gestão da Frota</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cadastre seus carros de frota, configure valores e visualize relatórios individualizados.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isSocio && (
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all shadow-md shadow-brand-500/10"
              id="open-add-car-modal-btn"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Novo Carro
            </button>
          )}
        </div>
      </div>

      {/* PAINEL DE METRICAS E INDICADORES DA FROTA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="fleet-metrics-panel">
        
        {/* COL 1: TAXA DE DESOCUPAÇÃO DOS VEÍCULOS (NOW ON THE LEFT WITH HIGHER VISUAL EMPHASIS) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border-2 border-brand-100 p-6 shadow-premium-lg flex flex-col justify-between" id="vacancy-rate-card">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-brand-500 text-white rounded-xl shadow-md shadow-brand-500/10">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-base leading-tight">
                  Taxa de Desocupação da Frota
                </h3>
                <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                  Métricas em tempo real sobre ociosidade e disponibilidade
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 font-sans mb-4 leading-relaxed">
              Métricas calculadas a partir da entrega do veículo até hoje, desconsiderando a carência dos primeiros 15 dias.
            </p>

            {/* Consolidated Fleet Vacancy Rate Summary Box */}
            {(() => {
              const activeVehicles = vehicles.filter(v => !v.isDeleted);
              let fleetTotalVacantDays = 0;
              let fleetTotalCountableDays = 0;
              let fleetVehiclesWithDate = 0;
              let fleetVehiclesInGrace = 0;

              activeVehicles.forEach(v => {
                const calc = calculateVacancyForVehicle(v, rentals);
                if (calc.isGracePeriod) {
                  fleetVehiclesInGrace++;
                } else if (calc.totalCountableDays > 0) {
                  fleetTotalVacantDays += calc.vacantDays;
                  fleetTotalCountableDays += calc.totalCountableDays;
                  fleetVehiclesWithDate++;
                }
              });

              const fleetVacancyPercentage = fleetTotalCountableDays > 0 
                ? (fleetTotalVacantDays / fleetTotalCountableDays) * 100 
                : 0;

              return (
                <div className="bg-slate-50 border-2 border-brand-100/60 rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Taxa Consolidada da Frota</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl sm:text-4xl font-extrabold font-display tracking-tight leading-none ${
                        fleetVehiclesWithDate === 0 
                          ? 'text-slate-400' 
                          : fleetVacancyPercentage > 30 
                            ? 'text-rose-600' 
                            : fleetVacancyPercentage > 10 
                              ? 'text-amber-600' 
                              : 'text-emerald-600'
                      }`}>
                        {fleetVehiclesWithDate === 0 ? '—' : `${fleetVacancyPercentage.toFixed(1)}%`}
                      </span>
                      {fleetVehiclesWithDate > 0 && (
                        <span className="text-xs text-slate-600 font-bold font-sans">
                          ({fleetTotalVacantDays} de {fleetTotalCountableDays} dias desocupados)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-left sm:text-right text-[11px] text-slate-600 font-medium border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4 shrink-0 flex flex-row sm:flex-col gap-x-3 gap-y-1">
                    <div>Avaliados: <strong className="text-slate-900 font-bold font-mono">{fleetVehiclesWithDate}</strong></div>
                    {fleetVehiclesInGrace > 0 && (
                      <div className="text-indigo-600">Carência: <strong className="font-bold font-mono">{fleetVehiclesInGrace}</strong></div>
                    )}
                    <div>Sem data: <strong className="text-slate-900 font-bold font-mono">{activeVehicles.length - fleetVehiclesWithDate - fleetVehiclesInGrace}</strong></div>
                  </div>
                </div>
              );
            })()}

            {/* List of vehicles and vacancy rates */}
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
              {vehicles.filter(v => !v.isDeleted).length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Nenhum veículo cadastrado para avaliar.</p>
              ) : (
                vehicles.filter(v => !v.isDeleted).map(v => {
                  const calc = calculateVacancyForVehicle(v, rentals);
                  
                  // Formatar a data de aquisição para o padrão BR
                  const formatDateBR = (dateStr?: string) => {
                    if (!dateStr) return '—';
                    const parts = dateStr.split('-');
                    if (parts.length !== 3) return dateStr;
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                  };

                  return (
                    <div key={v.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display font-extrabold text-slate-900 text-sm">{v.brandModel}</span>
                          <span className="font-mono text-xs bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">{v.plate}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-sans">
                          Entrega do veículo: <span className="font-bold text-slate-700 font-mono">{formatDateBR(v.acquisitionDate)}</span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        {calc.percentage === null ? (
                          <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-lg">Sem data de entrega</span>
                        ) : calc.isGracePeriod ? (
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            Carência (mais {calc.graceDaysRemaining} dias)
                          </span>
                        ) : (
                          <div className="flex flex-col sm:items-end justify-center">
                            <div className="text-[11px] text-slate-500 font-sans font-semibold mb-0.5">
                              Desocupação ({calc.periodLabel}):
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-sm font-extrabold ${calc.percentage > 30 ? 'text-rose-600' : calc.percentage > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {calc.percentage.toFixed(1)}%
                              </span>
                              <span className="text-[11px] text-slate-600 font-sans font-semibold">
                                ({calc.vacantDays} {calc.vacantDays === 1 ? 'dia' : 'dias'} desocupado)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COL 2: OCUPAÇÃO DA FROTA (NOW ON THE RIGHT SIDE) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between" id="fleet-occupancy-card">
          <div>
            <h3 className="font-display font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
              <Car className="h-4 w-4 text-indigo-500" />
              Ocupação e Frota Ativa
            </h3>

            {/* Progress wheel bar indicator */}
            <div className="my-5">
              <div className="flex justify-between items-end mb-2 text-xs text-slate-500 font-semibold">
                <span>Relação de Alocação</span>
                <span>
                  {vehicles.filter(v => !v.isDeleted && rentals.some(r => r.vehicleId === v.id && !r.isDeleted && r.status === 'active')).length} de {vehicles.filter(v => !v.isDeleted).length} carros
                </span>
              </div>

              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${vehicles.filter(v => !v.isDeleted).length > 0 ? (vehicles.filter(v => !v.isDeleted && rentals.some(r => r.vehicleId === v.id && !r.isDeleted && r.status === 'active')).length / vehicles.filter(v => !v.isDeleted).length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Micro list status indicators */}
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between text-xs font-semibold py-1.5 border-b border-dashed border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Disponíveis
                </span>
                <span className="text-slate-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-mono">
                  {vehicles.filter(v => !v.isDeleted && v.status !== 'maintenance' && !rentals.some(r => r.vehicleId === v.id && !r.isDeleted && r.status === 'active')).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold py-1.5 border-b border-dashed border-slate-100">
                <span className="text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Em Contratos Ativos
                </span>
                <span className="text-slate-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-mono">
                  {vehicles.filter(v => !v.isDeleted && rentals.some(r => r.vehicleId === v.id && !r.isDeleted && r.status === 'active')).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold py-1.5">
                <span className="text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Na Oficina (Manutenção)
                </span>
                <span className="text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-mono">
                  {vehicles.filter(v => !v.isDeleted && v.status === 'maintenance').length}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Vehicles Inventory Section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4">
        <div className="flex items-center justify-between pb-1Raw pb-1 border-b border-slate-50">
          <h3 className="font-display font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Milestone className="h-4 w-4 text-slate-500" />
            Veículos Registrados ({vehicles.filter(v => !v.isDeleted).length})
          </h3>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Clique no carro para detalhes da individualização</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.filter(v => !v.isDeleted).map((v) => {
            const activeRent = rentals.find(r => r.vehicleId === v.id && !r.isDeleted && r.status === 'active');
            const effectiveStatus: Vehicle['status'] = v.status === 'maintenance'
              ? 'maintenance'
              : (activeRent ? 'rented' : 'available');
            
            // Generate visual styles based on status
            let cardBg = '';
            let statusBadge = null;
            let iconColor = '';

            if (effectiveStatus === 'available') {
              cardBg = 'bg-white hover:bg-emerald-50/35 border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/40';
              iconColor = 'text-emerald-500 bg-emerald-50';
              statusBadge = (
                <span className="text-[10px] font-medium bg-emerald-50/75 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span> Disponível
                </span>
              );
            } else if (effectiveStatus === 'rented') {
              cardBg = 'bg-white hover:bg-blue-50/35 border-blue-100 hover:border-blue-300 hover:shadow-blue-100/40';
              iconColor = 'text-blue-600 bg-blue-50';
              statusBadge = (
                <span className="text-[10px] font-medium bg-blue-50/75 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-blue-600"></span> Alugado
                </span>
              );
            } else {
              cardBg = 'bg-white hover:bg-amber-50/35 border-amber-100 hover:border-amber-300 hover:shadow-amber-100/40';
              iconColor = 'text-amber-500 bg-amber-50';
              statusBadge = (
                <span className="text-[10px] font-medium bg-amber-50/75 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-amber-500"></span> {activeRent ? 'Oficina (Alugado)' : 'Oficina'}
                </span>
              );
            }

            return (
              <div
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer relative flex flex-col justify-between group transform hover:-translate-y-1 ${cardBg}`}
              >
                <div>
                  {/* Vehicle Header & Status Badge */}
                  <div className="flex justify-between items-center mb-3.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl transition-colors ${iconColor}`}>
                        <Car className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-xs bg-slate-105 border border-slate-200 text-slate-650 px-2 py-0.5 rounded-lg font-medium">
                        {v.plate}
                      </span>
                    </div>
                    <div>
                      {statusBadge}
                    </div>
                  </div>

                  {/* Model Title */}
                  <h4 className="font-display font-medium text-slate-850 group-hover:text-slate-900 text-base leading-snug line-clamp-1 mb-2">
                    {v.brandModel}
                  </h4>

                  {/* Pricing guidelines */}
                  <div className="grid grid-cols-2 gap-3 my-3.5 py-3 border-y border-dashed border-slate-150 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold tracking-wider mb-0.5">Sugerido / Sem:</span>
                      <span className="font-medium text-slate-700 font-mono text-xs">{formatCurrency(v.weeklyRate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold tracking-wider mb-0.5">Caução Base:</span>
                      <span className="font-medium text-slate-700 font-mono text-xs">{formatCurrency(v.depositValue)}</span>
                    </div>
                  </div>

                  {/* Mileage estimated info */}
                  <div className="mb-2 text-[10px] text-slate-600 bg-slate-50/65 p-2.5 rounded-xl flex justify-between items-center border border-slate-100">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">KM Estimado:</span>
                    <span className="font-medium font-mono text-slate-700 text-xs">
                      {v.mileage !== undefined && v.mileage !== null && typeof v.mileage === 'number' ? `${v.mileage.toLocaleString('pt-BR')} KM` : 'Não registrado'}
                    </span>
                  </div>
                </div>

                {/* Actions / Info footer */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    {activeRent ? (
                      <div className="text-slate-500 truncate flex items-center gap-1.5 font-medium text-[11px]">
                        <User className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                        <span className="truncate text-slate-500">Cliente: <strong className="text-slate-750 font-semibold">{activeRent.tenantName}</strong></span>
                      </div>
                    ) : (
                      <div className="text-slate-500 flex items-center gap-1.5 font-medium text-[11px]">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Sem aluguel ativo</span>
                      </div>
                    )}

                    <span className="text-slate-500 font-medium group-hover:text-indigo-600 text-[10px] uppercase tracking-wider flex items-center gap-0.5 shrink-0 transition-colors">
                      Detalhes →
                    </span>
                  </div>

                  {/* Button: Histórico de Manutenção */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMaintenanceVehicle(v);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200/90 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                  >
                    <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Histórico de Manutenção</span>
                  </button>
                </div>
              </div>
            );
          })}

          {vehicles.filter(v => !v.isDeleted).length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200">
              <Car className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-slate-500 text-xs font-semibold">Nenhum veículo cadastrado na frota.</p>
              <button
                onClick={() => setShowAddVehicle(true)}
                className="mt-2 text-xs text-brand-500 font-semibold hover:underline"
              >
                Adicionar o primeiro carro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD VEHICLE */}
      {showAddVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                <Car className="h-5 w-5 text-brand-500" />
                Cadastrar Novo Veículo
              </h3>
              <button
                onClick={() => setShowAddVehicle(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Marca, Modelo e Versão</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fiat Cronos Drive 1.3 2022"
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Placa do Carro</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: BRA-2430"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status Inicial</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Vehicle['status'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="available">Disponível</option>
                    <option value="maintenance">Oficina / Manut.</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Data de Entrega do Veículo (Aquisição)</label>
                <input
                  type="date"
                  required
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor Semanal Sugerido (R$)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="500"
                    value={weeklyRate === 0 ? '' : weeklyRate}
                    onChange={(e) => setWeeklyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Depósito Caução Padrão (R$)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1000"
                    value={depositValue === 0 ? '' : depositValue}
                    onChange={(e) => setDepositValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
                >
                  Cadastrar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM DELETE CONFIRMATION WITH OPTIONS */}
      {showDeleteModal && selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-rose-500" />
                  Excluir Veículo
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Confirmar saída do veículo: <strong className="text-slate-600 font-semibold">{selectedVehicle.brandModel} ({selectedVehicle.plate})</strong>
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 my-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Escolha o método de exclusão. Os dados gerados enquanto o veículo existia podem ser preservados ou completamente expurgados do livro-caixa:
              </p>

              {/* Choices */}
              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Preserve History */}
                <div
                  onClick={() => setDeletePurgeChoice('preserve')}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex gap-3.5 items-start ${
                    deletePurgeChoice === 'preserve'
                      ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/10'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/45'
                  }`}
                >
                  <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'preserve' ? 'bg-emerald-105 bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">Preservar Lançamentos Financeiros (Recomendado)</span>
                    <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                      O veículo é removido da frota visível e novas locações para ele ficam desabilitadas. No entanto, <strong>todas as receitas passadas, despesas registradas e cauções de seus contratos continuarão constando no caixa geral</strong> para garantir relatórios corretos de períodos passados.
                    </span>
                  </div>
                </div>

                {/* Option 2: Purge History */}
                <div
                  onClick={() => setDeletePurgeChoice('purge')}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 flex gap-3.5 items-start ${
                    deletePurgeChoice === 'purge'
                      ? 'bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/10'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/45'
                  }`}
                >
                  <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'purge' ? 'bg-rose-100 text-rose-650 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">Apagar Todo o Histórico (Excepcional)</span>
                    <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                      Exclui permanentemente o veículo, todos os seus contratos e <strong>purga retroativamente todos os lançamentos de caixa vinculados</strong> (receitas de aluguéis e depósitos caução) como se o veículo nunca tivesse existido. <span className="text-rose-500 font-semibold">Esta operação é irreversível!</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-55 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteVehicle(selectedVehicle.id, deletePurgeChoice === 'purge');
                  setShowDeleteModal(false);
                  setSelectedVehicleId(null);
                }}
                className={`px-4 py-2 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium ${
                  deletePurgeChoice === 'purge'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                    : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/10'
                }`}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT VEHICLE */}
      {showEditVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">Editar Veículo</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">Corrija ou atualize as informações deste veículo.</p>
              </div>
              <button
                onClick={() => setShowEditVehicle(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEditVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Marca / Modelo</label>
                  <input
                    type="text"
                    required
                    value={editVehBrandModel}
                    onChange={(e) => setEditVehBrandModel(e.target.value)}
                    className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="Ex: BYD Dolphin Mini"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Placa</label>
                  <input
                    type="text"
                    required
                    value={editVehPlate}
                    onChange={(e) => setEditVehPlate(e.target.value)}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755 placeholder:font-sans uppercase"
                    placeholder="Ex: TYU0E16"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Taxa Sugerida (Semanal)</label>
                  <input
                    type="number"
                    required
                    value={editVehWeeklyRate}
                    onChange={(e) => setEditVehWeeklyRate(Number(e.target.value))}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="R$ 1300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Caução de Entrada</label>
                  <input
                    type="number"
                    required
                    value={editVehDepositValue}
                    onChange={(e) => setEditVehDepositValue(Number(e.target.value))}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="R$ 2600"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Data de Entrega do Veículo (Aquisição)</label>
                  <input
                    type="date"
                    required
                    value={editVehAcquisitionDate}
                    onChange={(e) => setEditVehAcquisitionDate(e.target.value)}
                    className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                  />
                </div>

                <div className="col-span-2 border-t border-dashed border-slate-100 pt-3">
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Aferição de Quilometragem</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">KM Estimado</label>
                  <input
                    type="number"
                    value={editVehMileage}
                    onChange={(e) => setEditVehMileage(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="Ex: 8000"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Data do Registro</label>
                  <input
                    type="date"
                    required={editVehMileage !== ''}
                    value={editVehMileageDate}
                    onChange={(e) => setEditVehMileageDate(e.target.value)}
                    className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowEditVehicle(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD/EDIT TRANSACTION */}
      {showAddTxModal && selectedVehicle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans text-slate-800">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">
                  {editingTx ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  {editingTx ? 'Altere os dados da transação financeira.' : 'Adicione uma transação para este veículo.'}
                </p>
              </div>
              <button
                onClick={() => setShowAddTxModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (txValue === '') return;
              const txData = {
                date: txDate,
                type: txType,
                value: Number(txValue),
                category: txCategory,
                description: txDescription,
                vehicleId: selectedVehicle.id
              };
              if (editingTx) {
                onUpdateTransaction?.(editingTx.id, txData);
              } else {
                onAddTransaction?.(txData);
              }
              setShowAddTxModal(false);
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo de Lançamento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('despesa');
                        setTxCategory('Manutenção');
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                        txType === 'despesa'
                          ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-350'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Despesa / Custo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('receita');
                        setTxCategory('Aluguel');
                      }}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                        txType === 'receita'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-350'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Receita / Aluguel
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-sans text-slate-850"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={txValue}
                    onChange={(e) => setTxValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-mono text-slate-850"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Categoria</label>
                  {txType === 'despesa' ? (
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white font-sans text-slate-850"
                    >
                      <option value="Manutenção">Manutenção / Oficina</option>
                      <option value="Seguro">Seguro Veicular</option>
                      <option value="IPVA">IPVA / Impostos</option>
                      <option value="Financiamento">Financiamento</option>
                      <option value="Combustível">Combustível / Carga</option>
                      <option value="Acessórios">Acessórios / Estética</option>
                      <option value="Outros">Outros</option>
                    </select>
                  ) : (
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white font-sans text-slate-850"
                    >
                      <option value="Aluguel">Aluguel Semanal</option>
                      <option value="Ajuste de Saldo">Ajuste de Saldo / Cobrança</option>
                      <option value="Outros">Outros</option>
                    </select>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Descrição / Justificativa</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Troca de pastilhas de freio dianteiras"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-brand-500 font-sans text-slate-850"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4 font-sans">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold shadow-premium"
                >
                  {editingTx ? 'Salvar Alterações' : 'Lançar Transação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: HISTÓRICO DE MANUTENÇÃO DEDICADO DO VEÍCULO */}
      {maintenanceVehicle && (() => {
        const vehicleMaintenanceList = (transactions || [])
          .filter(t => {
            if (!t || typeof t !== 'object') return false;
            const matchesVehicle = 
              t.vehicleId === maintenanceVehicle.id || 
              (Boolean(maintenanceVehicle.plate) && Boolean(t.description) && t.description.includes(maintenanceVehicle.plate));
            return matchesVehicle && isVehMechanicalExpense(t);
          })
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const totalSpent = vehicleMaintenanceList.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
        const count = vehicleMaintenanceList.length;
        const avg = count > 0 ? totalSpent / count : 0;
        const lastDate = count > 0 ? vehicleMaintenanceList[0].date : null;

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-premium-2xl border border-slate-100 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-b border-amber-100 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/20">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-850 text-base flex items-center gap-2">
                      Histórico de Manutenções
                      <span className="font-mono text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-200">
                        {maintenanceVehicle.plate}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {maintenanceVehicle.brandModel} • KM Estimado: {maintenanceVehicle.mileage ? `${maintenanceVehicle.mileage.toLocaleString('pt-BR')} KM` : 'Não registrado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId(maintenanceVehicle.id);
                      setEditingTx(null);
                      setTxType('despesa');
                      setTxCategory('Manutenção');
                      setTxDescription('');
                      setTxValue('');
                      setTxDate(getBrasiliaDateStr());
                      setShowAddTxModal(true);
                      setMaintenanceVehicle(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Nova Manutenção</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaintenanceVehicle(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50/60 border-b border-slate-100 shrink-0">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Gasto</span>
                  <span className="text-sm font-bold font-mono text-rose-600 block mt-0.5">
                    {formatCurrency(totalSpent)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Intervenções</span>
                  <span className="text-sm font-bold font-mono text-slate-800 block mt-0.5">
                    {count} {count === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Média por Reparo</span>
                  <span className="text-sm font-bold font-mono text-amber-700 block mt-0.5">
                    {formatCurrency(avg)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Última Revisão</span>
                  <span className="text-xs font-semibold font-mono text-slate-700 block mt-1">
                    {lastDate ? formatDateBR(lastDate) : 'Nenhuma'}
                  </span>
                </div>
              </div>

              {/* Records List */}
              <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
                {vehicleMaintenanceList.length > 0 ? (
                  <div className="space-y-2">
                    {vehicleMaintenanceList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-amber-50 text-amber-700 rounded-lg mt-0.5 shrink-0 border border-amber-100">
                            <Wrench className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-850 text-xs sm:text-sm">
                                {item.description}
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.category}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                              Data: {formatDateBR(item.date)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <span className="font-mono font-bold text-xs sm:text-sm text-rose-600">
                            - {formatCurrency(item.value)}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVehicleId(maintenanceVehicle.id);
                                setEditingTx(item);
                                setTxType(item.type);
                                setTxValue(item.value);
                                setTxCategory(item.category);
                                setTxDescription(item.description);
                                setTxDate(item.date);
                                setShowAddTxModal(true);
                                setMaintenanceVehicle(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar registro de manutenção"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (onDeleteTransaction && window.confirm(`Tem certeza que deseja excluir a despesa de manutenção "${item.description}"?`)) {
                                  onDeleteTransaction(item.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir despesa de manutenção"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="p-3 bg-amber-50 rounded-2xl text-amber-500 mb-3 border border-amber-100">
                      <Wrench className="h-8 w-8 stroke-[1.5]" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">Nenhuma manutenção registrada</h4>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Este veículo ainda não possui despesas mecânicas ou revisões lançadas no livro-caixa.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId(maintenanceVehicle.id);
                        setEditingTx(null);
                        setTxType('despesa');
                        setTxCategory('Manutenção');
                        setTxDescription('');
                        setTxValue('');
                        setTxDate(getBrasiliaDateStr());
                        setShowAddTxModal(true);
                        setMaintenanceVehicle(null);
                      }}
                      className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Lançar Primeira Manutenção
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
                <span>Histórico individualizado por veículo • Eletroflow Frota</span>
                <button
                  type="button"
                  onClick={() => setMaintenanceVehicle(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
