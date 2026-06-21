import React, { useState } from 'react';
import { Vehicle, Rental, Transaction } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { 
  Plus, Car, User, Key, CheckCircle, AlertTriangle, Play, Calendar, 
  DollarSign, X, Check, Trash2, Milestone, ArrowLeft, TrendingUp, 
  Wrench, ShieldCheck, History, NotebookTabs, ArrowUpRight, ArrowDownRight,
  Edit3
} from 'lucide-react';

interface VehiclesTabProps {
  vehicles: Vehicle[];
  rentals: Rental[];
  transactions: Transaction[];
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onUpdateVehicle: (id: string, updatedFields: Partial<Vehicle>) => void;
  onUpdateVehicleStatus: (id: string, status: Vehicle['status']) => void;
  onDeleteVehicle: (id: string, purgeHistory: boolean) => void;
}

export default function VehiclesTab({
  vehicles,
  rentals,
  transactions,
  onAddVehicle,
  onUpdateVehicle,
  onUpdateVehicleStatus,
  onDeleteVehicle
}: VehiclesTabProps) {
  // Modal state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  
  // Custom interactive delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePurgeChoice, setDeletePurgeChoice] = useState<'preserve' | 'purge'>('preserve');

  // Edit vehicle state
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const [editVehId, setEditVehId] = useState('');
  const [editVehBrandModel, setEditVehBrandModel] = useState('');
  const [editVehPlate, setEditVehPlate] = useState('');
  const [editVehWeeklyRate, setEditVehWeeklyRate] = useState(1300);
  const [editVehDepositValue, setEditVehDepositValue] = useState(2600);
  const [editVehMileage, setEditVehMileage] = useState<number | ''>('');
  const [editVehMileageDate, setEditVehMileageDate] = useState('');

  const openEditVehicleModal = (v: Vehicle) => {
    setEditVehId(v.id);
    setEditVehBrandModel(v.brandModel || '');
    setEditVehPlate(v.plate || '');
    setEditVehWeeklyRate(v.weeklyRate || 0);
    setEditVehDepositValue(v.depositValue || 0);
    setEditVehMileage(v.mileage || '');
    setEditVehMileageDate(v.mileageDate || getBrasiliaDateStr());
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
      mileageDate: editVehMileageDate || undefined
    });
    setShowEditVehicle(false);
  };
  
  // Form states - Add Vehicle
  const [brandModel, setBrandModel] = useState('');
  const [plate, setPlate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState(1300);
  const [depositValue, setDepositValue] = useState(2600);
  const [status, setStatus] = useState<Vehicle['status']>('available');

  const submitAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandModel || !plate) return;
    onAddVehicle({
      brandModel,
      plate: plate.toUpperCase(),
      weeklyRate: Number(weeklyRate),
      depositValue: Number(depositValue),
      status
    });
    // Reset
    setBrandModel('');
    setPlate('');
    setWeeklyRate(1300);
    setDepositValue(2600);
    setStatus('available');
    setShowAddVehicle(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Find selected vehicle
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Statistics & History calculation for SELECTED VEHICLE
  const getVehicleData = (v: Vehicle) => {
    // Current active rental
    const activeRent = rentals.find(r => r.vehicleId === v.id && r.status === 'active');
    
    // Past rentals
    const pastRentals = rentals.filter(r => r.vehicleId === v.id && r.status === 'completed');

    // Transactions associated with this vehicle (using linked vehicleId)
    const vehicleTransactions = transactions
      .filter(t => t.vehicleId === v.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Financial calculations
    const totalRevenues = vehicleTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const totalExpenses = vehicleTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    const depositsReceived = vehicleTransactions
      .filter(t => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const depositsReturned = vehicleTransactions
      .filter(t => t.type === 'caucao_devolvido')
      .reduce((sum, t) => sum + t.value, 0);

    const netDepositInHand = depositsReceived - depositsReturned;
    const netProfit = totalRevenues - totalExpenses;

    const mechanicalExpenses = vehicleTransactions
      .filter(t => t.type === 'despesa' && (
        t.category.toLowerCase().includes('manutenção') ||
        t.category.toLowerCase().includes('oficina') ||
        t.category.toLowerCase().includes('revisão') ||
        t.category.toLowerCase().includes('reparo') ||
        t.category.toLowerCase().includes('peças') ||
        t.category.toLowerCase().includes('peça') ||
        t.category.toLowerCase().includes('mecanic') ||
        t.description.toLowerCase().includes('oficina') ||
        t.description.toLowerCase().includes('reparo') ||
        t.description.toLowerCase().includes('revisão') ||
        t.description.toLowerCase().includes('conserto') ||
        t.description.toLowerCase().includes('peças') ||
        t.description.toLowerCase().includes('peça') ||
        t.description.toLowerCase().includes('óleo') ||
        t.description.toLowerCase().includes('pneu') ||
        t.description.toLowerCase().includes('alinhamento') ||
        t.description.toLowerCase().includes('mecanic')
      ))
      .reduce((sum, t) => sum + t.value, 0);

    const financingExpenses = vehicleTransactions
      .filter(t => t.type === 'despesa' && (
        t.category.toLowerCase().includes('financiamento') ||
        t.category.toLowerCase().includes('consórcio') ||
        t.category.toLowerCase().includes('parcela') ||
        t.description.toLowerCase().includes('financiamento') ||
        t.description.toLowerCase().includes('consórcio')
      ))
      .reduce((sum, t) => sum + t.value, 0);

    const taxExpenses = vehicleTransactions
      .filter(t => t.type === 'despesa' && (
        t.category.toLowerCase().includes('ipva') ||
        t.category.toLowerCase().includes('imposto') ||
        t.category.toLowerCase().includes('taxa') ||
        t.category.toLowerCase().includes('licenciamento') ||
        t.description.toLowerCase().includes('ipva') ||
        t.description.toLowerCase().includes('imposto') ||
        t.description.toLowerCase().includes('licenciamento') ||
        t.description.toLowerCase().includes('taxa') ||
        t.description.toLowerCase().includes('multa')
      ))
      .reduce((sum, t) => sum + t.value, 0);

    const insuranceExpenses = vehicleTransactions
      .filter(t => t.type === 'despesa' && (
        t.category.toLowerCase().includes('seguro') ||
        t.description.toLowerCase().includes('seguro')
      ))
      .reduce((sum, t) => sum + t.value, 0);

    const otherExpenses = Math.max(0, totalExpenses - (mechanicalExpenses + financingExpenses + taxExpenses + insuranceExpenses));

    return {
      activeRent,
      pastRentals,
      vehicleTransactions,
      totalRevenues,
      totalExpenses,
      netDepositInHand,
      netProfit,
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
      mechanicalExpenses,
      financingExpenses,
      taxExpenses,
      insuranceExpenses,
      otherExpenses
    } = getVehicleData(selectedVehicle);

    // Calculate days left in active rent if any
    let daysLeft: number | null = null;
    if (activeRent) {
      const today = new Date();
      const endDateObj = new Date(activeRent.endDate + 'T00:00:00');
      const msDiff = endDateObj.getTime() - today.getTime();
      daysLeft = Math.ceil(msDiff / (1000 * 3600 * 24));
    }

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
            {selectedVehicle.status !== 'maintenance' && (
              <button
                onClick={() => onUpdateVehicleStatus(selectedVehicle.id, 'maintenance')}
                className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-750 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all border border-amber-250/30"
              >
                <Wrench className="h-4 w-4 text-amber-500" />
                Oficina / Manutenção
              </button>
            )}
            {selectedVehicle.status === 'maintenance' && (
              <button
                onClick={() => onUpdateVehicleStatus(selectedVehicle.id, 'available')}
                className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-750 px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-all border border-emerald-200/30"
              >
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Liberar Carro
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
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Status Atual</span>
                {selectedVehicle.status === 'available' && (
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Disponível
                  </span>
                )}
                {selectedVehicle.status === 'rented' && (
                  <span className="text-xs font-bold bg-brand-50 text-brand-500 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-brand-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span> Alugado
                  </span>
                )}
                {selectedVehicle.status === 'maintenance' && (
                  <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-full inline-flex items-center gap-1 border border-amber-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Em Manutenção
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
              Total recebido em caixa
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-premium">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 font-semibold block mb-1">Custos (Oficina / Reparos)</span>
                <span className="text-lg font-bold font-mono text-rose-500">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-[11px] text-slate-400">
              Total gasto com manutenção
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
              Valor de depósito em caixa
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
                        <span className="text-xs font-semibold font-mono text-slate-700">{activeRent.phone}</span>
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
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Desempenho Financeiro
              </h3>
              
              <div className="space-y-3.5">
                {/* Result header */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg text-center">
                    <span className="text-[10px] text-slate-400 block font-sans">Receitas Acadas</span>
                    <span className="text-xs font-bold font-mono text-slate-800">{formatCurrency(totalRevenues)}</span>
                  </div>
                  <div className="p-2 bg-brand-50/50 rounded-lg text-center border border-brand-100/30">
                    <span className="text-[10px] text-brand-500 block font-sans">Resultado Líquido</span>
                    <span className={`text-xs font-black font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(netProfit)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-100 pt-3 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Detalhamento de Custos</h4>

                  {/* Mechanical mechanicalExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Custos Mecânicos</span>
                      <span className="text-[9px] text-slate-400 font-sans">Reparos, Revisão e Oficina</span>
                    </div>
                    <span className="font-bold text-rose-600 font-mono text-xs">{formatCurrency(mechanicalExpenses)}</span>
                  </div>

                  {/* Financing financingExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Financiamentos</span>
                      <span className="text-[9px] text-slate-400 font-sans">Parcelas de Compra / Entrada</span>
                    </div>
                    <span className="font-bold text-rose-650 font-mono text-xs">{formatCurrency(financingExpenses)}</span>
                  </div>

                  {/* Taxes taxExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Impostos / IPVA</span>
                      <span className="text-[9px] text-slate-400 font-sans">IPVA, Licenciamento e Taxas</span>
                    </div>
                    <span className="font-bold text-amber-600 font-mono text-xs">{formatCurrency(taxExpenses)}</span>
                  </div>

                  {/* Insurance insuranceExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-50/50">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Seguro veicular</span>
                      <span className="text-[9px] text-slate-400 font-sans">Apólices regulares individualizadas</span>
                    </div>
                    <span className="font-bold text-blue-600 font-mono text-xs">{formatCurrency(insuranceExpenses)}</span>
                  </div>

                  {/* Other otherExpenses */}
                  <div className="flex justify-between items-center text-xs py-1.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">Outras Despesas</span>
                      <span className="text-[9px] text-slate-400 font-sans">Gastos operacionais ordinários</span>
                    </div>
                    <span className="font-bold text-slate-500 font-mono text-xs">{formatCurrency(otherExpenses)}</span>
                  </div>
                </div>

                {/* Substats */}
                <div className="bg-slate-50 p-2.5 rounded-xl space-y-1.5 text-[11px] border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-450">Histórico de Locações:</span>
                    <strong className="text-slate-700">{pastRentals.length} encerrada(s)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Comprometimento p/ Manutenção:</span>
                    <strong className="text-slate-705 font-mono">
                      {totalRevenues > 0 ? `${Math.round((mechanicalExpenses / totalRevenues) * 100)}%` : '0%'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Register Transactions Ledger */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between">
            <div>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                Extrato Financeiro Individualizado ({vehicleTransactions.length})
              </h3>
              <p className="text-xs text-slate-400 mt-1">Lançamentos de caixa e transações vinculados a este veículo específico.</p>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {vehicleTransactions.map((t) => {
                  const increment = t.type === 'receita' || t.type === 'caucao_recebido';
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl text-xs transition-all duration-250 border border-slate-100/30"
                    >
                      <div className="truncate pr-3 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{t.description}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            t.type === 'receita' ? 'bg-emerald-50 text-emerald-600' :
                            t.type === 'despesa' ? 'bg-rose-50 text-rose-600' :
                            t.type === 'caucao_recebido' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-150 text-slate-600'
                          }`}>
                            {t.type === 'receita' ? 'ALUGUEL' :
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
                      <div className="text-right flex-shrink-0">
                        <span className={`font-mono font-bold ${increment ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {increment ? '+' : '-'} {formatCurrency(t.value)}
                        </span>
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

        {/* SEÇÃO ADICIONAL: CONTROLE DE FLUXO DE CAIXA DE PLANILHA PARA DOLPHIN MINI */}
        {(selectedVehicle.id === 'v_dolphin' || selectedVehicle.plate.replace('-', '') === 'TYU0E16') && (
          <div className="mt-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 shadow-premium-lg space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-widest font-mono">
                  Prestação de Contas Integrada
                </span>
                <h4 className="font-display font-bold text-slate-100 text-lg mt-1.5 flex items-center gap-2">
                  <NotebookTabs className="h-5 w-5 text-indigo-400" />
                  Acompanhamento Geral - DOLPHIN MINI AZUL
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Faturamento, custos detalhados, despesas parceladas estruturais e controle de quilometragem.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right sm:text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Início do Contrato</span>
                  <span className="text-xs font-semibold font-mono text-slate-300">25/03/2026 (Quarta-feira)</span>
                </div>
              </div>
            </div>

            {/* GRELHA MÊS A MÊS */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Fluxo de Caixa Mensal (Março a Junho 2026)
              </h5>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                      <th className="p-3">Mês de Fechamento</th>
                      <th className="p-3 text-right">Entradas (Aluguéis)</th>
                      <th className="p-3 text-right">Custos (Operacionais)</th>
                      <th className="p-3 text-right">Rentabilidade Líquida</th>
                      <th className="p-3 text-center">Quilometragem (KM)</th>
                      <th className="p-3">Principais Ocorrências/Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-sans">
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-300">MARÇO</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(0)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(399)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(399)}</td>
                      <td className="p-3 text-center font-mono">1.800</td>
                      <td className="p-3 text-slate-400 italic">Aplicação de Insulfilme básico</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-300">ABRIL</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(6630)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(3711.62)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">+{formatCurrency(2918.38)}</td>
                      <td className="p-3 text-center font-mono">8.000</td>
                      <td className="p-3 text-slate-400">4 sem regular + 1 sem Ajustada (01/05), Parc. 1 Seguro, IPVA e Financiamento</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-300">MAIO</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(5330)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(3711.62)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">+{formatCurrency(1618.38)}</td>
                      <td className="p-3 text-center font-mono">16.000</td>
                      <td className="p-3 text-slate-400 font-sans">3 sem regular + 1 sem Ajustada (29/05), Parc. 2 Seguro, IPVA e Financiamento</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-300">JUNHO</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(2600)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(4024.62)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(1424.62)}</td>
                      <td className="p-3 text-center font-mono text-slate-500">-</td>
                      <td className="p-3 text-slate-400">2 sem pagas regular, Desbloqueio Multimídia, Parc. 3 Seguro, IPVA e Financiamento</td>
                    </tr>
                    {/* TOTAL ROW */}
                    <tr className="bg-slate-900/80 font-bold border-t border-slate-700">
                      <td className="p-3 text-slate-200">TOTAL ACUMULADO</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(14560)}</td>
                      <td className="p-3 text-right font-mono text-rose-400">-{formatCurrency(11846.86)}</td>
                      <td className="p-3 text-right font-mono text-indigo-400">{formatCurrency(2713.14)}</td>
                      <td className="p-3 text-center font-mono text-slate-300">16.000 (Máx)</td>
                      <td className="p-3 text-indigo-300 font-sans">Rentabilidade de R$ 2.713,14 atingida</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* DESPESAS PARCELADAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-3 font-sans">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                  Previsão Contratual de Despesas Parceladas
                </h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Seguro Veicular contratado (Coletivo):</span>
                    <span className="font-semibold text-slate-200">10x de {formatCurrency(791.00)} (R$ 7.911)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">IPVA parcelado (Geral):</span>
                    <span className="font-semibold text-slate-200">3x de {formatCurrency(1264.88)} (R$ 3.794)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Parcelas de Financiamento Banco:</span>
                    <span className="font-semibold text-slate-200">36x de {formatCurrency(1655.74)} (12m: R$ 19.869)</span>
                  </div>
                  <div className="flex justify-between pt-1 font-bold text-slate-300">
                    <span>Provisão de Custo Estrutural Anual:</span>
                    <span className="font-mono text-indigo-400">{formatCurrency(31574.00)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 rounded-xl border border-slate-800 p-4 space-y-3 flex flex-col justify-between font-sans">
                <div>
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-amber-400" />
                    Garantia Caução & Condições Gerais
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    O locatário <strong className="text-slate-200">LEANDRO</strong> efetuou depósito caução contratual no valor de <strong className="text-amber-400 font-mono">{formatCurrency(2600.00)}</strong> em 25/03/2026, retida em conta empresarial de garantias.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Para o regime de cálculo de rentabilidade, o caixa considerou as saídas operacionais realizadas até a competência de Junho de 2026.
                  </p>
                </div>
                <div className="text-[11px] text-indigo-400 italic mt-2 border-t border-slate-800/60 pt-2 flex items-center gap-1.5 font-mono">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Integração em conformidade com o livro-caixa administrativo.
                </div>
              </div>
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
          <button
            onClick={() => setShowAddVehicle(true)}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all shadow-md shadow-brand-500/10"
            id="open-add-car-modal-btn"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Novo Carro
          </button>
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
            const activeRent = rentals.find(r => r.vehicleId === v.id && r.status === 'active');
            
            // Generate visual styles based on status
            let cardBg = '';
            let statusBadge = null;
            let iconColor = '';

            if (v.status === 'available') {
              cardBg = 'bg-white hover:bg-emerald-50/35 border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/40';
              iconColor = 'text-emerald-500 bg-emerald-50';
              statusBadge = (
                <span className="text-[10px] font-medium bg-emerald-50/75 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span> Disponível
                </span>
              );
            } else if (v.status === 'rented') {
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
                  <span className="h-1 w-1 rounded-full bg-amber-500"></span> Oficina
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
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  {activeRent ? (
                    <div className="text-slate-500 truncate flex items-center gap-1.5 font-medium">
                      <User className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                      <span className="truncate text-slate-500">Cliente: <strong className="text-slate-750 font-semibold">{activeRent.tenantName}</strong></span>
                    </div>
                  ) : (
                    <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Sem aluguel ativo</span>
                    </div>
                  )}

                  <span className="text-slate-500 font-medium group-hover:text-indigo-600 text-[10px] uppercase tracking-wider flex items-center gap-0.5 shrink-0 transition-colors">
                    Detalhes →
                  </span>
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
    </div>
  );
}
