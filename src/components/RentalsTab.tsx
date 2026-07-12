import React, { useState } from 'react';
import { Vehicle, Rental, Transaction, InterestedLead } from '../types';
import { getBrasiliaDateStr, toLocalDateStr } from '../utils/dateUtils';
import { formatPhoneNumber } from '../utils/phoneUtils';
import { 
  Plus, Car, User, Key, CheckCircle, AlertTriangle, Calendar, 
  DollarSign, X, ShieldCheck, Heart, UserCheck, CalendarDays, 
  Trash2, ArrowLeft, History, TrendingUp, HelpCircle, PhoneCall,
  Edit3, Users, Info, Table, ChevronDown, ChevronUp, FileCheck,
  Eye, EyeOff
} from 'lucide-react';

interface RentalsTabProps {
  vehicles: Vehicle[];
  rentals: Rental[];
  transactions: Transaction[];
  onStartRental: (rental: Omit<Rental, 'id' | 'status'>) => void;
  onUpdateRental: (id: string, updatedFields: Partial<Rental>) => void;
  onTerminateRental: (id: string, returnDeposit: boolean, refundValue: number) => void;
  onDeleteRental: (id: string, purgeHistory: boolean) => void;
  currentUser?: any;
  interestedLeads?: InterestedLead[];
  onAddInterestedLead?: (lead: Omit<InterestedLead, 'id' | 'createdAt'>) => void;
  onDeleteInterestedLead?: (id: string) => void;
  onToggleLeadDocApproved?: (id: string) => void;
  onIncrementLeadContactCount?: (id: string) => void;
  onDecrementLeadContactCount?: (id: string) => void;
}

export default function RentalsTab({
  vehicles,
  rentals,
  transactions,
  onStartRental,
  onUpdateRental,
  onTerminateRental,
  onDeleteRental,
  currentUser,
  interestedLeads = [],
  onAddInterestedLead,
  onDeleteInterestedLead,
  onToggleLeadDocApproved,
  onIncrementLeadContactCount,
  onDecrementLeadContactCount
}: RentalsTabProps) {
  const isSocio = currentUser?.role === 'socio';
  const approvedLeads = interestedLeads.filter(l => l.docApproved === true);
  const unapprovedLeads = interestedLeads.filter(l => !l.docApproved);
  // Modal toggle states
  const [subTab, setSubTab] = useState<'list' | 'closed' | 'interested'>('list');
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadContactDate, setNewLeadContactDate] = useState(getBrasiliaDateStr());
  const [newLeadNotes, setNewLeadNotes] = useState('');
  const [showInterestedTableModal, setShowInterestedTableModal] = useState(false);
  const [showApprovedQueue, setShowApprovedQueue] = useState(true);
  const [showUnapprovedQueue, setShowUnapprovedQueue] = useState(true);

  const [showStartRental, setShowStartRental] = useState(false);
  const [showEndRentalModal, setShowEndRentalModal] = useState<Rental | null>(null);
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);

  // Custom interactive delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePurgeChoice, setDeletePurgeChoice] = useState<'preserve' | 'purge'>('preserve');

  // Edit rental state
  const [showEditRental, setShowEditRental] = useState(false);
  const [editRentId, setEditRentId] = useState('');
  const [editRentTenantName, setEditRentTenantName] = useState('');
  const [editRentPhone, setEditRentPhone] = useState('');
  const [editRentStartDate, setEditRentStartDate] = useState('');
  const [editRentEndDate, setEditRentEndDate] = useState('');
  const [editRentWeeklyRate, setEditRentWeeklyRate] = useState(1300);
  const [editRentDepositValue, setEditRentDepositValue] = useState(2600);
  const [editRentStatus, setEditRentStatus] = useState<'active' | 'completed'>('active');

  const openEditRentalModal = (r: Rental) => {
    setEditRentId(r.id);
    setEditRentTenantName(r.tenantName || '');
    setEditRentPhone(r.phone || '');
    setEditRentStartDate(r.startDate || '');
    setEditRentEndDate(r.endDate || '');
    setEditRentWeeklyRate(r.weeklyRate || 0);
    setEditRentDepositValue(r.depositValue || 0);
    setEditRentStatus(r.status || 'active');
    setShowEditRental(true);
  };

  const submitEditRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRentTenantName) return;
    onUpdateRental(editRentId, {
      tenantName: editRentTenantName,
      phone: editRentPhone,
      startDate: editRentStartDate,
      endDate: editRentEndDate,
      weeklyRate: Number(editRentWeeklyRate),
      depositValue: Number(editRentDepositValue),
      status: editRentStatus
    });
    setShowEditRental(false);
  };

  // Form states - Start Rental
  const [rentVehicleId, setRentVehicleId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState(getBrasiliaDateStr());
  const [rentalWeeks, setRentalWeeks] = useState(4); // default 4 weeks
  const [rentWeeklyRate, setRentWeeklyRate] = useState(1300);
  const [rentDepositValue, setRentDepositValue] = useState(2600);
  const [rentPayDepositNow, setRentPayDepositNow] = useState(true);
  const [rentPayFirstWeekNow, setRentPayFirstWeekNow] = useState(true);

  // Form states - End Rental
  const [refundDeposit, setRefundDeposit] = useState(true);
  const [refundAmount, setRefundAmount] = useState(2600);

  // Auto-populate defaults when a vehicle is selected in new rental
  const handleRentVehicleChange = (vId: string) => {
    setRentVehicleId(vId);
    const selected = vehicles.find(v => v.id === vId);
    if (selected) {
      setRentWeeklyRate(selected.weeklyRate);
      setRentDepositValue(selected.depositValue);
      setRefundAmount(selected.depositValue);
    }
  };

  const submitStartRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentVehicleId || !tenantName) return;

    // Calculate end date based on strict initial 90-day duration
    const sDate = new Date(rentalStartDate + 'T00:00:00');
    sDate.setDate(sDate.getDate() + 90);
    const endDateStr = toLocalDateStr(sDate);

    onStartRental({
      vehicleId: rentVehicleId,
      tenantName,
      phone: tenantPhone,
      startDate: rentalStartDate,
      endDate: endDateStr,
      weeklyRate: Number(rentWeeklyRate),
      depositValue: Number(rentDepositValue),
      semanaAdiantada: rentPayFirstWeekNow
    });

    // Reset
    setRentVehicleId('');
    setTenantName('');
    setTenantPhone('');
    setRentalStartDate(getBrasiliaDateStr());
    setRentalWeeks(4);
    setShowStartRental(false);
  };

  const openEndRental = (r: Rental) => {
    setShowEndRentalModal(r);
    setRefundDeposit(true);
    setRefundAmount(r.depositValue);
  };

  const submitEndRental = () => {
    if (!showEndRentalModal) return;
    onTerminateRental(
      showEndRentalModal.id,
      refundDeposit,
      refundDeposit ? Number(refundAmount) : 0
    );
    setShowEndRentalModal(null);
    // If we end the rental that is currently being viewed, return back
    if (selectedRentalId === showEndRentalModal.id) {
      setSelectedRentalId(null);
    }
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddInterestedLead) return;

    onAddInterestedLead({
      name: newLeadName,
      phone: newLeadPhone,
      email: newLeadEmail || undefined,
      contactDate: newLeadContactDate,
      notes: newLeadNotes || undefined
    });

    // Reset fields
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadEmail('');
    setNewLeadContactDate(getBrasiliaDateStr());
    setNewLeadNotes('');
    setShowAddLead(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Find selected rental
  const selectedRental = rentals.find(r => r.id === selectedRentalId);

  // Details extraction for selected contract
  const getRentalData = (r: Rental) => {
    const vehicle = vehicles.find(v => v.id === r.vehicleId);
    const isTerminated = r.status === 'completed';
    
    // Find transactions tagged with this vehicle, but specifically during or related to this rental's tenant
    const relativeTransactions = transactions
      .filter(t => {
        // Must match vehicle
        if (t.vehicleId !== r.vehicleId) return false;

        // If terminated, we specifically fetch all transactions dated between r.startDate and r.endDate
        if (isTerminated) {
          const tDate = t.date;
          const start = r.startDate;
          const end = r.endDate || getBrasiliaDateStr();
          return tDate >= start && tDate <= end;
        }
        
        const descLower = (t.description || '').toLowerCase();
        const catLower = (t.category || '').toLowerCase();
        const tenantLower = (r.tenantName || '').toLowerCase();
        
        // 1. Direct name match in description (or partial)
        if (tenantLower && (descLower.includes(tenantLower) || tenantLower.includes(descLower))) {
          return true;
        }
        
        // 2. Is this any kind of security deposit (caução / garantia) for this vehicle?
        const isDeposit = 
          t.type === 'caucao_recebido' || 
          t.type === 'caucao_devolvido' ||
          catLower.includes('caução') ||
          catLower.includes('caucao') ||
          catLower.includes('depósito') ||
          catLower.includes('deposito') ||
          catLower.includes('garantia') ||
          descLower.includes('caução') ||
          descLower.includes('caucao') ||
          descLower.includes('depósito') ||
          descLower.includes('deposito') ||
          descLower.includes('garantia');
          
        if (isDeposit) return true;
        
        // 3. Is this a rental-payment transaction?
        const isRent = 
          catLower.includes('aluguel') ||
          catLower.includes('aluguéis') ||
          catLower.includes('alugueis') ||
          catLower.includes('locação') ||
          catLower.includes('locacao') ||
          catLower.includes('semana');
          
        if (t.type === 'receita' && isRent) {
          return true;
        }
        
        return false;
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // Contract received values
    const rentReceived = relativeTransactions
      .filter(t => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const depositReceived = relativeTransactions
      .filter(t => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const vehicleExpenses = relativeTransactions
      .filter(t => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    return {
      vehicle,
      relativeTransactions,
      rentReceived,
      depositReceived,
      vehicleExpenses
    };
  };

  if (selectedRental) {
    const { vehicle, relativeTransactions, rentReceived, depositReceived, vehicleExpenses } = getRentalData(selectedRental);
    
    // Calculate days remaining
    const today = new Date();
    const endDateObj = new Date(selectedRental.endDate + 'T00:00:00');
    const msDiff = endDateObj.getTime() - today.getTime();
    const daysLeft = Math.ceil(msDiff / (1000 * 3600 * 24));

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-premium">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedRentalId(null)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all"
              title="Voltar para Contratos"
              id="back-to-rentals-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  selectedRental.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {selectedRental.status === 'active' ? 'CONTRATO ATIVO' : 'CONTRATO FINALIZADO'}
                </span>
                <h2 className="font-display font-bold text-slate-800 text-lg sm:text-xl">
                  {selectedRental.tenantName}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Análise e faturamento individualizado do contrato de locação.</p>
            </div>
          </div>
          
          {!isSocio ? (
            <div className="flex items-center gap-2">
              {selectedRental.status === 'active' && (
                <button
                  onClick={() => openEndRental(selectedRental)}
                  className="flex items-center gap-2 bg-brand-50 hover:bg-brand-100 text-brand-500 px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all border border-brand-100"
                >
                  <CheckCircle className="h-4 w-4 text-brand-500" />
                  Finalizar Contrato & Ajustar Caução
                </button>
              )}
              <button
                onClick={() => openEditRentalModal(selectedRental)}
                className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-650 px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all"
                title="Editar Contrato"
              >
                <Edit3 className="h-4 w-4 text-slate-550" />
                <span>Editar Contrato</span>
              </button>
              <button
                onClick={() => {
                  setDeletePurgeChoice('preserve');
                  setShowDeleteModal(true);
                }}
                className="flex items-center gap-2 border border-rose-200 hover:bg-rose-50 text-rose-500 px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all"
                title="Excluir Contrato"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir Contrato</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic font-medium">Visualização (Alterações bloqueadas para sócio)</span>
          )}
        </div>

        {/* DETAILS CARDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Driver Profile */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2 pb-1 border-b border-slate-50">
                <UserCheck className="h-4.5 w-4.5 text-brand-500" />
                Dossiê do Motorista
              </h3>

              <div className="space-y-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Motorista</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedRental.tenantName}</span>
                </div>
                {selectedRental.phone && (
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold font-sans">Contato WhatsApp</span>
                    <span className="font-mono text-slate-800 flex items-center gap-1 font-semibold">
                      <PhoneCall className="h-3 w-3 inline text-emerald-500" />
                      {formatPhoneNumber(selectedRental.phone)}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Data de Início</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {new Date(selectedRental.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Data de Vencimento</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {new Date(selectedRental.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold mb-1">Status de Vigência</span>
                  {selectedRental.status === 'active' ? (
                    daysLeft > 0 ? (
                      <div className="space-y-1.5">
                        <div className="bg-emerald-55 bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-100 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Vigente ({daysLeft} dias restantes do prazo inicial)
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal font-sans">
                          Este é o primeiro contrato de 90 dias estimados. Sendo prorrogado automaticamente por prazo indeterminado caso não seja encerrado.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="bg-brand-50 text-brand-500 px-3 py-2 rounded-xl text-xs font-bold border border-brand-100 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse"></span>
                          Prorrogado / Prazo Indeterminado
                        </div>
                        <p className="text-[10px] text-brand-500/70 leading-normal font-sans font-medium">
                          O prazo inicial de 90 dias foi concluído. O contrato foi prorrogado automaticamente para prazo indeterminado.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="bg-slate-50 text-slate-500 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-100">
                      Contrato encerrado civilmente
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Associated Vehicle Detail */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-3">
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <Car className="h-4.5 w-4.5 text-brand-500" />
                Veículo Alugado
              </h3>

              {vehicle ? (
                <div className="space-y-3.5 pt-1 text-xs">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100/50">
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">{vehicle.brandModel}</span>
                      <span className="font-mono text-[10px] text-slate-500">{vehicle.plate}</span>
                    </div>
                    <div>
                      {vehicle.status === 'rented' && (
                        <span className="text-[10px] font-bold bg-brand-50 text-brand-500 px-2 py-0.5 rounded border border-brand-100">
                          Alugado
                        </span>
                      )}
                      {vehicle.status === 'maintenance' && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100">
                          Oficina
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Placa:</span>
                      <span className="font-mono font-bold text-slate-800">{vehicle.plate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Aluguel Semanal:</span>
                      <span className="font-semibold text-slate-800 font-mono">{formatCurrency(selectedRental.weeklyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Caução Contratual:</span>
                      <span className="font-semibold text-brand-500 font-mono">{formatCurrency(selectedRental.depositValue)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-rose-500 font-semibold bg-rose-50 rounded-xl">
                  Veículo correspondente não foi localizado!
                </div>
              )}
            </div>
          </div>

          {/* Ledger History details */}
          <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex-1 space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-slate-500" />
                Histórico Financeiro do Contrato
              </h3>
              
              {/* Financial Quick Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/35">
                  <span className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase">Receitas de Aluguel</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">{formatCurrency(rentReceived)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Estima: {selectedRental.weeklyRate > 0 ? Math.round(rentReceived / selectedRental.weeklyRate) : 0} semanas pagas</span>
                </div>
                
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100/35">
                  <span className="text-[10px] text-rose-600 font-bold block mb-1 uppercase">Custos do Veículo (Oficina)</span>
                  <span className="text-lg font-bold font-mono text-rose-600">{formatCurrency(vehicleExpenses)}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Lançados no veículo durante a vigência</span>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/35">
                  <span className="text-[10px] text-indigo-650 text-indigo-600 font-bold block mb-1 uppercase">Resultado Líquido</span>
                  <span className={`text-lg font-bold font-mono ${rentReceived - vehicleExpenses >= 0 ? 'text-indigo-600' : 'text-rose-500'}`}>
                    {formatCurrency(rentReceived - vehicleExpenses)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Caução Retido: {formatCurrency(depositReceived)}</span>
                </div>
              </div>

              {/* Transactions filtered list */}
              <div className="space-y-2 mt-2">
                <span className="text-[11px] font-bold uppercase text-slate-400">Lançamentos Rastreáveis no Contrato ({relativeTransactions.length})</span>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {relativeTransactions.map((t) => {
                    const increment = t.type === 'receita' || t.type === 'caucao_recebido';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl text-xs transition-all border border-slate-100/30"
                      >
                        <div className="truncate pr-3 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700">{t.description}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              t.type === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {t.type === 'receita' ? 'RESC' : 'CAUC'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="font-mono">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span>{t.category}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-bold ${increment ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {increment ? '+' : '-'} {formatCurrency(t.value)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {relativeTransactions.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                      Nenhum lançamento no extrato para este contrato.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL: END RENTAL */}
        {showEndRentalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Finalizar Contrato de Locação
                </h3>
                <button
                  onClick={() => setShowEndRentalModal(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Você está prestes a encerrar o contrato sob responsabilidade do motorista <strong className="text-slate-700">{showEndRentalModal?.tenantName}</strong>. O veículo correspondente voltará ao status de <span className="font-semibold text-emerald-600">Disponível</span>.
                </p>

                {/* Deposit refund option */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="refundToggle"
                      type="checkbox"
                      checked={refundDeposit}
                      onChange={(e) => setRefundDeposit(e.target.checked)}
                      className="rounded text-brand-500 focus:ring-brand-500 cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="refundToggle" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                      Devolver depósito caução retido
                    </label>
                  </div>

                  {refundDeposit && (
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-1">Valor a ser Devolvido (R$)</label>
                      <input
                        type="number"
                        required
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        Nota: O valor padrão retido é de {formatCurrency(showEndRentalModal?.depositValue)}. Desconte taxas/multas/detalhes caso necessário.
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-55 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEndRentalModal(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={submitEndRental}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
                  >
                    Encerrar Contrato
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CUSTOM DELETE CONFIRMATION WITH OPTIONS */}
        {showDeleteModal && selectedRental && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans relative overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-rose-500" />
                    Excluir Contrato de Locação
                  </h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Confirmar exclusão do contrato com: <strong className="text-slate-600 font-semibold">{selectedRental.tenantName}</strong>
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
                  Escolha o método de exclusão do contrato. Você pode preservar o fluxo de caixa histórico ou expurgar retroativamente os recebimentos:
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
                    <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'preserve' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700">Preservar Lançamentos Financeiros (Recomendado)</span>
                      <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                        O contrato é removido de sua lista de relatórios, mas <strong>todas as recebimentos passados de aluguel e o depósito caução continuarão computados no fluxo de caixa geral</strong> e relatórios de extrato para conformidade de fechamentos anteriores.
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
                    <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'purge' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700">Apagar Todo o Histórico (Excepcional)</span>
                      <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                        Remove o contrato e **exclui retroativamente da base de transações todas as parcelas e cauções vinculados a esta locação**, ajustando automaticamente o saldo atual e o saldo histórico de caixa. <span className="text-rose-500 font-semibold">Esta ação é irreversível!</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-55 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRental(selectedRental.id, deletePurgeChoice === 'purge');
                    setShowDeleteModal(false);
                    setSelectedRentalId(null);
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

        {/* MODAL: EDIT RENTAL */}
        {showEditRental && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
              {/* Header */}
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base">Editar Contrato</h3>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">Corrija ou atualize as informações deste contrato de locação.</p>
                </div>
                <button
                  onClick={() => setShowEditRental(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={submitEditRental} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Nome do Motorista / Locatário</label>
                    <input
                      type="text"
                      required
                      value={editRentTenantName}
                      onChange={(e) => setEditRentTenantName(e.target.value)}
                      className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="Ex: Leandro"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Telefone de Contato</label>
                    <input
                      type="text"
                      value={editRentPhone}
                      onChange={(e) => setEditRentPhone(formatPhoneNumber(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="Ex: (11) 99999-9999"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Início do Contrato</label>
                    <input
                      type="date"
                      required
                      value={editRentStartDate}
                      onChange={(e) => setEditRentStartDate(e.target.value)}
                      className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Fim do Contrato</label>
                    <input
                      type="date"
                      required
                      value={editRentEndDate}
                      onChange={(e) => setEditRentEndDate(e.target.value)}
                      className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Taxa Semanal (R$)</label>
                    <input
                      type="number"
                      required
                      value={editRentWeeklyRate}
                      onChange={(e) => setEditRentWeeklyRate(Number(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="1300"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Caução Ajustado (R$)</label>
                    <input
                      type="number"
                      required
                      value={editRentDepositValue}
                      onChange={(e) => setEditRentDepositValue(Number(e.target.value))}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                      placeholder="2600"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Status do Contrato</label>
                    <select
                      value={editRentStatus}
                      onChange={(e) => setEditRentStatus(e.target.value as 'active' | 'terminated')}
                      className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all bg-white text-slate-755"
                    >
                      <option value="active">ATIVO</option>
                      <option value="terminated">FINALIZADO</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditRental(false)}
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
          <h2 className="font-display font-bold text-slate-800 text-xl">
            Gestão de Locações & Contratos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie contratos de locação semanal dos motoristas, controle caução e acompanhe a fila de interessados.
          </p>
        </div>
        <div className="flex items-center gap-2 font-sans">
          {!isSocio && (
            <button
              onClick={() => {
                const available = vehicles.find(v => v.status === 'available');
                if (available) {
                  handleRentVehicleChange(available.id);
                }
                setShowStartRental(true);
              }}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all shadow-md shadow-brand-500/10"
              id="open-start-rental-btn"
            >
              <Key className="h-4 w-4" />
              Nova Locação Semanal
            </button>
          )}
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="space-y-6">
        {/* Main Contracts area */}
        <div className="space-y-6">
          {/* Sub-Tabs Selector */}
          <div className="flex border-b border-slate-200/80 gap-1 bg-white p-1 rounded-xl border border-slate-100/50 shadow-xs max-w-md">
            <button
              onClick={() => setSubTab('list')}
              className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 rounded-lg transition-all font-sans cursor-pointer ${
                subTab === 'list'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Contratos Semanais Ativos
              {rentals.filter(r => r.status === 'active' && !r.isDeleted).length > 0 && (
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  subTab === 'list' ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'
                }`}>
                  {rentals.filter(r => r.status === 'active' && !r.isDeleted).length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setSubTab('closed')}
              className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 rounded-lg transition-all font-sans cursor-pointer ${
                subTab === 'closed'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <History className="h-4 w-4" />
              Contratos Encerrados
              {rentals.filter(r => r.status === 'completed' && !r.isDeleted).length > 0 && (
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  subTab === 'closed' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {rentals.filter(r => r.status === 'completed' && !r.isDeleted).length}
                </span>
              )}
            </button>
          </div>

          {/* Conditional Content */}
          {subTab === 'list' && (
        /* Contract Listing */
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-slate-50">
            <h3 className="font-display font-semibold text-slate-700 text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              Contratos Semanais Ativos ({rentals.filter(r => r.status === 'active' && !r.isDeleted).length})
            </h3>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Clique no contrato para visualizar desdobramento individual</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rentals.filter(r => r.status === 'active' && !r.isDeleted).map((r) => {
              const vehicle = vehicles.find(v => v.id === r.vehicleId);
              // Calculate days remaining
              const today = new Date();
              const endDateObj = new Date(r.endDate + 'T00:00:00');
              const msDiff = endDateObj.getTime() - today.getTime();
              const daysLeft = Math.ceil(msDiff / (1000 * 3600 * 24));

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRentalId(r.id)}
                  className="bg-slate-50/55 hover:bg-white rounded-xl border border-slate-100 hover:border-brand-200 p-4 shadow-sm hover:shadow-premium transition-all duration-250 cursor-pointer relative overflow-hidden flex flex-col justify-between group"
                >
                  {/* Contract indicator border */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>

                  <div>
                    <div className="flex justify-between items-start mb-2 mt-4.1">
                      <div>
                        <h4 className="font-display font-bold text-slate-800 group-hover:text-brand-700 text-sm">{r.tenantName}</h4>
                        {r.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatPhoneNumber(r.phone)}</p>}
                      </div>
                      <div>
                        {daysLeft > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded" title="Restantes para os 90 dias estimados">
                            {daysLeft}d restantes (Est.)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded" title="Prazo indeterminado automático">
                            Prazo Indeterminado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vehicle summary inside contract card */}
                    <div className="bg-white group-hover:bg-indigo-50/20 p-2.5 rounded-lg text-xs space-y-1 my-3 border border-slate-100/30">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Veículo:</span>
                        <span className="font-semibold text-slate-800">{vehicle?.brandModel || 'Não Encontrado'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Placa:</span>
                        <span className="font-mono font-medium text-slate-700">{vehicle?.plate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Aluguel Semanal:</span>
                        <span className="font-bold text-slate-800 font-mono">{formatCurrency(r.weeklyRate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Caução Retido:</span>
                        <span className="font-bold text-brand-600 font-mono">{formatCurrency(r.depositValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-100/50 mt-1">
                    <span>De {new Date(r.startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(r.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <span className="text-brand-500 group-hover:underline font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 font-sans">
                      Ver Contrato →
                    </span>
                  </div>
                </div>
              );
            })}

            {rentals.filter(r => r.status === 'active' && !r.isDeleted).length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200">
                <Key className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-slate-500 text-xs font-semibold text-center select-none font-sans">Nenhum contrato ativo neste momento.</p>
                <button
                  onClick={() => setShowStartRental(true)}
                  className="mt-2 text-xs text-indigo-500 font-semibold hover:underline cursor-pointer"
                >
                  Criar o primeiro contrato
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'closed' && (
        /* Closed/Concluded Contract Listing */
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-1 border-b border-slate-50">
            <h3 className="font-display font-semibold text-slate-700 text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              Contratos Concluídos & Encerrados ({rentals.filter(r => r.status === 'completed' && !r.isDeleted).length})
            </h3>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Clique no contrato para visualizar a prestação de contas consolidada</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rentals.filter(r => r.status === 'completed' && !r.isDeleted).map((r) => {
              const vehicle = vehicles.find(v => v.id === r.vehicleId);
              const { rentReceived, vehicleExpenses } = getRentalData(r);

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRentalId(r.id)}
                  className="bg-slate-50/55 hover:bg-white rounded-xl border border-slate-100 hover:border-brand-200 p-4 shadow-sm hover:shadow-premium transition-all duration-250 cursor-pointer relative overflow-hidden flex flex-col justify-between group"
                >
                  {/* Closed indicator border */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400"></div>

                  <div>
                    <div className="flex justify-between items-start mb-2 mt-4">
                      <div>
                        <h4 className="font-display font-bold text-slate-800 group-hover:text-brand-700 text-sm">{r.tenantName}</h4>
                        {r.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatPhoneNumber(r.phone)}</p>}
                      </div>
                      <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">
                        Encerrado
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 my-3 bg-white p-2.5 rounded-xl border border-slate-100/40 text-[11px] font-sans">
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">Veículo Locado</span>
                        <strong className="text-slate-700 truncate block">
                          {vehicle ? vehicle.brandModel : 'Não localizado'}
                        </strong>
                        {vehicle && <span className="font-mono text-[9px] text-slate-500">{vehicle.plate}</span>}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase">Período de Vigência</span>
                        <span className="font-mono text-slate-600 block mt-0.5">
                          {r.startDate ? new Date(r.startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/D'}
                        </span>
                        <span className="font-mono font-bold text-slate-700 block">
                          até {r.endDate ? new Date(r.endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/D'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2.5 border-t border-slate-100/50">
                      <div>
                        <span className="text-[9px] text-slate-450 block font-bold uppercase">Aluguéis Pagos</span>
                        <span className="font-mono font-bold text-emerald-600">{formatCurrency(rentReceived)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-450 block font-bold uppercase">Custos do Veículo</span>
                        <span className="font-mono font-bold text-rose-500">{formatCurrency(vehicleExpenses)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-slate-100/50 flex items-center justify-between text-[10px]">
                    <span className={`font-bold px-2 py-0.5 rounded ${
                      rentReceived - vehicleExpenses >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      Lucro Líquido: {formatCurrency(rentReceived - vehicleExpenses)}
                    </span>
                    <span className="text-brand-500 group-hover:underline font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5 font-sans">
                      DRE Completo →
                    </span>
                  </div>
                </div>
              );
            })}

            {rentals.filter(r => r.status === 'completed' && !r.isDeleted).length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-slate-200">
                <History className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                <p className="text-slate-500 text-xs font-semibold text-center select-none font-sans">Nenhum contrato concluído ou encerrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

        {/* Fila de Espera Section in Marked Area */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-6 animate-fade-in">
          {/* Header containing the FILA DE ESPERA Button/Badge and Cadastro */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-50 gap-3">
            <div className="flex items-center gap-3">
              <div
                className="bg-brand-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-brand-500/10 cursor-default"
                style={{ minHeight: '38px' }}
                title="Gestão de Interessados"
                id="fila-de-espera-btn"
              >
                <Users className="h-4 w-4" />
                FILAS DE INTERESSADOS
                <span className="bg-white/20 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {interestedLeads.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium hidden md:block">
                Organizado por data de contato (primeiros contatos / mais antigos no topo)
              </p>
            </div>

            {!isSocio && (
              <button
                onClick={() => setShowAddLead(true)}
                className="flex items-center gap-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-100 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{ minHeight: '38px' }}
                title="Cadastrar novo interessado"
              >
                <Plus className="h-4 w-4" />
                Cadastrar Interessado
              </button>
            )}
          </div>

          {/* LISTA 1: Motoristas com documentação já aprovada (QUALIFICADA) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <button
                onClick={() => setShowApprovedQueue(!showApprovedQueue)}
                className="flex items-center gap-2 hover:text-brand-600 text-slate-700 font-bold text-xs font-sans transition-colors cursor-pointer select-none"
              >
                {showApprovedQueue ? (
                  <ChevronUp className="h-4 w-4 text-brand-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-brand-500 shrink-0" />
                )}
                <span className="tracking-wide uppercase text-[11px] font-bold">Motoristas com documentação já aprovada</span>
                <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                  {approvedLeads.length}
                </span>
              </button>
              <button
                onClick={() => setShowApprovedQueue(!showApprovedQueue)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
              >
                {showApprovedQueue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showApprovedQueue ? 'Ocultar' : 'Exibir'}</span>
              </button>
            </div>

            {showApprovedQueue && (
              <div className="animate-fade-in">
                {approvedLeads.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-xs">
                    <table className="w-full min-w-[700px] border-collapse text-left text-xs text-slate-600 font-sans">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                          <th scope="col" className="px-5 py-3 font-semibold">Nome do Contato</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Data de Contato</th>
                          <th scope="col" className="px-5 py-3 font-semibold">WhatsApp / Telefone</th>
                          {!isSocio && <th scope="col" className="px-5 py-3 font-semibold text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {approvedLeads
                          .slice()
                          .sort((a, b) => {
                            const countA = a.contactCount || 0;
                            const countB = b.contactCount || 0;
                            if (countA !== countB) {
                              return countA - countB;
                            }
                            const dateA = a.contactDate || '';
                            const dateB = b.contactDate || '';
                            if (dateA !== dateB) {
                              return dateA.localeCompare(dateB);
                            }
                            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          })
                          .map((lead) => {
                            const cleanPhone = lead.phone.replace(/\D/g, '');
                            const waLink = `https://wa.me/55${cleanPhone}`;
                            return (
                              <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5 font-bold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                    {lead.name}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 font-bold text-indigo-600 whitespace-nowrap">
                                  {lead.contactDate ? new Date(lead.contactDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono font-bold text-emerald-600 hover:underline inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/60 px-2.5 py-1.5 rounded-lg text-[11px]"
                                      style={{ minHeight: '28px' }}
                                    >
                                      <PhoneCall className="h-3.5 w-3.5 text-emerald-500" />
                                      {formatPhoneNumber(lead.phone)}
                                    </a>
                                    {lead.contactCount && lead.contactCount > 0 ? (
                                      <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm" title={`${lead.contactCount} contato(s) realizado(s)`}>
                                        +{lead.contactCount}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                {!isSocio && (
                                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => {
                                          setTenantName(lead.name);
                                          setTenantPhone(lead.phone);
                                          const available = vehicles.find(v => v.status === 'available');
                                          if (available) {
                                            handleRentVehicleChange(available.id);
                                          }
                                          setShowStartRental(true);
                                        }}
                                        className="text-[11px] font-bold text-brand-650 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        style={{ minHeight: '28px' }}
                                        title="Iniciar locação semanal com este motorista"
                                      >
                                        <Key className="h-3.5 w-3.5" />
                                        Alugar
                                      </button>
                                      {onIncrementLeadContactCount && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => onIncrementLeadContactCount(lead.id)}
                                            className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                            style={{ minHeight: '28px' }}
                                            title="Registrar novo contato realizado com o interessado"
                                          >
                                            <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                                            +1 Contato
                                          </button>
                                          {lead.contactCount && lead.contactCount > 0 && onDecrementLeadContactCount && (
                                            <button
                                              onClick={() => onDecrementLeadContactCount(lead.id)}
                                              className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                              style={{ minHeight: '28px', minWidth: '28px' }}
                                              title="Desfazer/remover último contato realizado"
                                            >
                                              -1
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {onToggleLeadDocApproved && (
                                        <button
                                          onClick={() => onToggleLeadDocApproved(lead.id)}
                                          className="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                          style={{ minHeight: '28px' }}
                                          title="Mover de volta para a fila de espera"
                                        >
                                          Reverter
                                        </button>
                                      )}
                                      {onDeleteInterestedLead && (
                                        <button
                                          onClick={() => onDeleteInterestedLead(lead.id)}
                                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                          style={{ minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="Remover interessado"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center bg-slate-50/30 rounded-xl border border-dashed border-slate-250 text-center">
                    <p className="text-slate-400 text-xs font-semibold px-4 select-none">Nenhum motorista com documentação aprovada no momento.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LISTA 2: Fila de Espera (Aguardando documentação / Não aprovada) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <button
                onClick={() => setShowUnapprovedQueue(!showUnapprovedQueue)}
                className="flex items-center gap-2 hover:text-brand-600 text-slate-700 font-bold text-xs font-sans transition-colors cursor-pointer select-none"
              >
                {showUnapprovedQueue ? (
                  <ChevronUp className="h-4 w-4 text-brand-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-brand-500 shrink-0" />
                )}
                <span className="tracking-wide uppercase text-[11px] font-bold">Fila de espera</span>
                <span className="bg-brand-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                  {unapprovedLeads.length}
                </span>
              </button>
              <button
                onClick={() => setShowUnapprovedQueue(!showUnapprovedQueue)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1"
              >
                {showUnapprovedQueue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showUnapprovedQueue ? 'Ocultar' : 'Exibir'}</span>
              </button>
            </div>

            {showUnapprovedQueue && (
              <div className="animate-fade-in">
                {unapprovedLeads.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-xs">
                    <table className="w-full min-w-[700px] border-collapse text-left text-xs text-slate-600 font-sans">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                          <th scope="col" className="px-5 py-3 font-semibold">Nome do Contato</th>
                          <th scope="col" className="px-5 py-3 font-semibold">Data de Contato</th>
                          <th scope="col" className="px-5 py-3 font-semibold">WhatsApp / Telefone</th>
                          {!isSocio && <th scope="col" className="px-5 py-3 font-semibold text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {unapprovedLeads
                          .slice()
                          .sort((a, b) => {
                            const countA = a.contactCount || 0;
                            const countB = b.contactCount || 0;
                            if (countA !== countB) {
                              return countA - countB;
                            }
                            const dateA = a.contactDate || '';
                            const dateB = b.contactDate || '';
                            if (dateA !== dateB) {
                              return dateA.localeCompare(dateB);
                            }
                            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          })
                          .map((lead) => {
                            const cleanPhone = lead.phone.replace(/\D/g, '');
                            const waLink = `https://wa.me/55${cleanPhone}`;
                            return (
                              <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5 font-bold text-slate-800">
                                  {lead.name}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-indigo-600 whitespace-nowrap">
                                  {lead.contactDate ? new Date(lead.contactDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono font-bold text-emerald-600 hover:underline inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100/60 px-2.5 py-1.5 rounded-lg text-[11px]"
                                      style={{ minHeight: '28px' }}
                                    >
                                      <PhoneCall className="h-3.5 w-3.5 text-emerald-500" />
                                      {formatPhoneNumber(lead.phone)}
                                    </a>
                                    {lead.contactCount && lead.contactCount > 0 ? (
                                      <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm" title={`${lead.contactCount} contato(s) realizado(s)`}>
                                        +{lead.contactCount}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                {!isSocio && (
                                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-2">
                                      {onIncrementLeadContactCount && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => onIncrementLeadContactCount(lead.id)}
                                            className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                            style={{ minHeight: '28px' }}
                                            title="Registrar novo contato realizado com o interessado"
                                          >
                                            <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                                            +1 Contato
                                          </button>
                                          {lead.contactCount && lead.contactCount > 0 && onDecrementLeadContactCount && (
                                            <button
                                              onClick={() => onDecrementLeadContactCount(lead.id)}
                                              className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                              style={{ minHeight: '28px', minWidth: '28px' }}
                                              title="Desfazer/remover último contato realizado"
                                            >
                                              -1
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      {onToggleLeadDocApproved && (
                                        <button
                                          onClick={() => onToggleLeadDocApproved(lead.id)}
                                          className="text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                          style={{ minHeight: '28px' }}
                                          title="Aprovar documentação"
                                        >
                                          <FileCheck className="h-3.5 w-3.5 text-brand-500" />
                                          Doc. Aprovada
                                        </button>
                                      )}
                                      {onDeleteInterestedLead && (
                                        <button
                                          onClick={() => onDeleteInterestedLead(lead.id)}
                                          className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                          style={{ minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="Remover interessado"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 animate-fade-in">
                    <Users className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                    <p className="text-slate-400 text-xs font-semibold text-center select-none font-sans px-4">Fila de espera vazia no momento.</p>
                    {!isSocio && (
                      <button
                        onClick={() => setShowAddLead(true)}
                        className="mt-3 text-xs bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        Cadastrar Primeiro
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: START RENTAL */}
      {showStartRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                <Key className="h-5 w-5 text-brand-500" />
                Iniciar Nova Locação Semanal
              </h3>
              <button
                onClick={() => setShowStartRental(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitStartRental} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Selecione o Veículo</label>
                  <select
                    required
                    value={rentVehicleId}
                    onChange={(e) => handleRentVehicleChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Selecione...</option>
                    {vehicles
                      .filter(v => v.status === 'available')
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.brandModel} ({v.plate})
                        </option>
                      ))}
                    {vehicles.filter(v => v.status === 'available').length === 0 && (
                      <option disabled>Nenhum carro disponível em estoque</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo do Motorista</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Roberto Carlos da Costa"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Telefone do Motorista (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: (31) 98524-1922"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(formatPhoneNumber(e.target.value))}
                    maxLength={14}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data de Início da Locação</label>
                  <input
                    type="date"
                    required
                    value={rentalStartDate}
                    onChange={(e) => setRentalStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Prazo de Vigência</label>
                  <input
                    type="text"
                    disabled
                    value="90 Dias Iniciais"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-650 font-bold focus:outline-none"
                    title="Vigência inicial obrigatória de 90 dias com renovação automática indeterminada"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block leading-tight font-sans">
                    Renovação automática após 90 dias
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor do Aluguel/Semana (R$)</label>
                  <input
                    type="number"
                    required
                    value={rentWeeklyRate}
                    onChange={(e) => setRentWeeklyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Depósito Caução Requerido (R$)</label>
                  <input
                    type="number"
                    required
                    value={rentDepositValue}
                    onChange={(e) => setRentDepositValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              {/* MANUAL ACTION DETERMINATION (Semana Adiantada) */}
              <div className="bg-brand-50 border border-brand-100/50 rounded-xl p-4 mt-2 font-sans">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Determinação: Houve semana adiantada no ato?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="semanaAdiantada"
                      checked={rentPayFirstWeekNow === true}
                      onChange={() => setRentPayFirstWeekNow(true)}
                      className="text-brand-500 focus:ring-brand-500 mt-px cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800">Sim, houve semana adiantada</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="semanaAdiantada"
                      checked={rentPayFirstWeekNow === false}
                      onChange={() => setRentPayFirstWeekNow(false)}
                      className="text-brand-500 focus:ring-brand-500 mt-px cursor-pointer"
                    />
                    <span className="font-semibold text-slate-800">Não houve semana adiantada</span>
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 leading-normal">
                  *Atenção: A ativação do contrato <strong>não gera lançamentos automáticos</strong> no caixa. Você deve registrar quaisquer depósitos e aluguéis recebidos manualmente através do painel de lançamentos.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-end gap-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowStartRental(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!rentVehicleId}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-premium"
                >
                  Confirmar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM DELETE CONFIRMATION WITH OPTIONS */}
      {showDeleteModal && selectedRental && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-rose-500" />
                  Excluir Contrato de Locação
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Confirmar exclusão do contrato com: <strong className="text-slate-600 font-semibold">{selectedRental.tenantName}</strong>
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
                Escolha o método de exclusão do contrato. Você pode preservar o fluxo de caixa histórico ou expurgar retroativamente os recebimentos:
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
                  <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'preserve' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">Preservar Lançamentos Financeiros (Recomendado)</span>
                    <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                      O contrato é removido de sua lista de relatórios, mas <strong>todos os recebimentos passados de aluguel e o depósito caução continuarão computados no fluxo de caixa geral</strong> e relatórios de extrato para conformidade de fechamentos anteriores.
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
                  <div className={`mt-0.5 rounded-full p-1.5 ${deletePurgeChoice === 'purge' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">Apagar Todo o Histórico (Excepcional)</span>
                    <span className="block text-[11px] text-slate-400 mt-1 leading-normal">
                      Remove o contrato e **exclui retroativamente da base de transações todas as parcelas e cauções vinculados a esta locação**, ajustando automaticamente o saldo atual e o saldo histórico de caixa. <span className="text-rose-500 font-semibold">Esta ação é irreversível!</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-55 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRental(selectedRental.id, deletePurgeChoice === 'purge');
                  setShowDeleteModal(false);
                  setSelectedRentalId(null);
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

      {/* MODAL: EDIT RENTAL */}
      {showEditRental && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">Editar Contrato</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">Corrija ou atualize as informações deste contrato de locação.</p>
              </div>
              <button
                onClick={() => setShowEditRental(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEditRental} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Nome do Motorista / Locatário</label>
                  <input
                    type="text"
                    required
                    value={editRentTenantName}
                    onChange={(e) => setEditRentTenantName(e.target.value)}
                    className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="Ex: Leandro"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Telefone de Contato</label>
                  <input
                    type="text"
                    value={editRentPhone}
                    onChange={(e) => setEditRentPhone(formatPhoneNumber(e.target.value))}
                    maxLength={14}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="Ex: (31) 98524-1922"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Início do Contrato</label>
                  <input
                    type="date"
                    required
                    value={editRentStartDate}
                    onChange={(e) => setEditRentStartDate(e.target.value)}
                    className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Fim do Contrato</label>
                  <input
                    type="date"
                    required
                    value={editRentEndDate}
                    onChange={(e) => setEditRentEndDate(e.target.value)}
                    className="w-full font-sans text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-indigo-950"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Taxa Semanal (R$)</label>
                  <input
                    type="number"
                    required
                    value={editRentWeeklyRate}
                    onChange={(e) => setEditRentWeeklyRate(Number(e.target.value))}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="1300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Caução Ajustado (R$)</label>
                  <input
                    type="number"
                    required
                    value={editRentDepositValue}
                    onChange={(e) => setEditRentDepositValue(Number(e.target.value))}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-755"
                    placeholder="2600"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">Status do Contrato</label>
                  <select
                    value={editRentStatus}
                    onChange={(e) => setEditRentStatus(e.target.value as 'active' | 'completed')}
                    className="w-full text-xs font-sans px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all bg-white text-slate-755"
                  >
                    <option value="active">ATIVO</option>
                    <option value="completed">FINALIZADO</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowEditRental(false)}
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

      {/* MODAL: REGISTER INTERESTED LEAD */}
      {showAddLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-500" />
                Cadastrar Novo Interessado
              </h3>
              <button
                onClick={() => setShowAddLead(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLeadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo (Locatário)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Telefone WhatsApp</label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="Ex: (31) 98524-1922"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(formatPhoneNumber(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data do Contato</label>
                  <input
                    type="date"
                    required
                    value={newLeadContactDate}
                    onChange={(e) => setNewLeadContactDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">E-mail (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ex: carloseduardo@gmail.com"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Observações / Notas (Opcional)</label>
                <textarea
                  placeholder="Ex: Busca carro elétrico econômico. Preferência por contratos longos de mais de 3 meses."
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans h-20 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLead(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all font-sans cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-brand-500/10 font-sans cursor-pointer"
                  style={{ minHeight: '38px' }}
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
