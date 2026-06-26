import React, { useState } from 'react';
import { Transaction, Vehicle, FutureExpense, FutureExpenseInstallment, Rental } from '../types';
import { getBrasiliaDateStr } from '../utils/dateUtils';
import { Plus, Search, Calendar, Landmark, ArrowUpCircle, ArrowDownCircle, ChevronDown, Check, X, Filter, Trash2, Edit3, DollarSign, Download, Upload, Pencil, ChevronUp, AlertCircle, Wrench, Shield, CreditCard, HelpCircle, FileText, CalendarDays } from 'lucide-react';

interface TransactionsTabProps {
  transactions: Transaction[];
  vehicles: Vehicle[];
  rentals: Rental[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (id: string, updatedFields: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  futureExpenses: FutureExpense[];
  onAddFutureExpense: (newExp: { description?: string; category: string; value: number; installmentsCount: number; startDate: string; dueDay: number; vehicleId?: string }) => void;
  onRealizeFutureInstallment: (expenseId: string, installmentId: string, customDate: string) => void;
  onDeleteFutureExpense: (expenseId: string) => void;
  onUpdateFutureInstallmentDate: (expenseId: string, installmentId: string, newDate: string) => void;
  currentUser?: any;
}

export default function TransactionsTab({
  transactions,
  vehicles,
  rentals,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  futureExpenses = [],
  onAddFutureExpense,
  onRealizeFutureInstallment,
  onDeleteFutureExpense,
  onUpdateFutureInstallmentDate,
  currentUser
}: TransactionsTabProps) {
  const isSocio = currentUser?.role === 'socio';
  // Modal toggle state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isFutureExpense, setIsFutureExpense] = useState(false);

  // Collapsing and Pagination states for financial flow table (Ledger Table) 
  const [isLedgerHidden, setIsLedgerHidden] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter States
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Input States for New Transaction
  const [type, setType] = useState<Transaction['type']>('receita');
  const [value, setValue] = useState<number | ''>('');
  const [date, setDate] = useState(getBrasiliaDateStr());
  const [vehicleId, setVehicleId] = useState<string>('');
  const [category, setCategory] = useState('Aluguel Semanal');
  const [description, setDescription] = useState('');
  const [isRealized, setIsRealized] = useState(false);

  // Edit States for Selected Transaction
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [editType, setEditType] = useState<Transaction['type']>('receita');
  const [editValue, setEditValue] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editVehicleId, setEditVehicleId] = useState<string>('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsRealized, setEditIsRealized] = useState(false);

  // Delete States for Selected Transaction
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Future Expense registration form state
  const [showAddFutureModal, setShowAddFutureModal] = useState(false);
  const [feDescription, setFeDescription] = useState('');
  const [feCategory, setFeCategory] = useState('Financiamento');
  const [feValue, setFeValue] = useState<number | ''>('');
  const [feInstallments, setFeInstallments] = useState<number | ''>(12);
  const [feStartDate, setFeStartDate] = useState<string>(getBrasiliaDateStr());
  const [feDueDay, setFeDueDay] = useState<number>(10);
  const [feVehicleId, setFeVehicleId] = useState('');

  // Aglutination state for vehicle future expenses (accordion/filter)
  const [expandedVehicleFutureGroupId, setExpandedVehicleFutureGroupId] = useState<string | null>(null);

  // Confirmation modal state for Efetivar (Realizing) an installment
  const [showRealizeModal, setShowRealizeModal] = useState(false);
  const [realizeExpenseId, setRealizeExpenseId] = useState('');
  const [realizeInstallment, setRealizeInstallment] = useState<FutureExpenseInstallment | null>(null);
  const [realizeDate, setRealizeDate] = useState('');

  // Auto-set Category based on selected Transaction Type to prevent friction
  const handleTypeChange = (newType: Transaction['type']) => {
    setType(newType);
    if (newType === 'receita') {
      setCategory('Aluguel Semanal');
    } else if (newType === 'despesa') {
      setCategory('Manutenção');
    } else if (newType === 'caucao_recebido') {
      setCategory('Depósito de Garantia');
    } else if (newType === 'caucao_devolvido') {
      setCategory('Devolução de Garantia');
    }
  };

  const handleEditTypeChange = (newType: Transaction['type']) => {
    setEditType(newType);
    if (newType === 'receita') {
      setEditCategory('Aluguel Semanal');
    } else if (newType === 'despesa') {
      setEditCategory('Manutenção');
    } else if (newType === 'caucao_recebido') {
      setEditCategory('Depósito de Garantia');
    } else if (newType === 'caucao_devolvido') {
      setEditCategory('Devolução de Garantia');
    }
  };

  // Submit Handler for standard or future parcel transactions with absolute unified modal
  const handleSubmitUnified = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFutureExpense) {
      if (!feValue || !feCategory || !feInstallments || !feStartDate || !feDueDay) return;
      onAddFutureExpense({
        description: feDescription,
        category: feCategory,
        value: Number(feValue),
        installmentsCount: Number(feInstallments),
        startDate: feStartDate,
        dueDay: Number(feDueDay),
        vehicleId: feVehicleId || undefined
      });
      // Reset Future states
      setFeDescription('');
      setFeCategory('Financiamento');
      setFeValue('');
      setFeInstallments(12);
      setFeStartDate(getBrasiliaDateStr());
      setFeDueDay(10);
      setFeVehicleId('');
      setShowAddModal(false);
    } else {
      if (!value || !date || !category) return;
      onAddTransaction({
        type,
        value: Number(value),
        date,
        vehicleId: vehicleId || undefined,
        category,
        description: description || '',
        status: isRealized ? 'realized' : 'pending'
      });
      // Reset Standard states
      setType('receita');
      setValue('');
      setVehicleId('');
      setCategory('Aluguel Semanal');
      setDescription('');
      setIsRealized(false);
      setShowAddModal(false);
    }
  };

  // Submit Edit Handler - Note description is optional
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editValue || !editDate || !editCategory) return;

    onUpdateTransaction(editId, {
      type: editType,
      value: Number(editValue),
      date: editDate,
      vehicleId: editVehicleId || undefined,
      category: editCategory,
      description: editDescription || '',
      status: editIsRealized ? 'realized' : 'pending'
    });

    setShowEditModal(false);
  };

  const handleAddFutureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feValue || !feCategory || !feInstallments || !feStartDate || !feDueDay) return;

    onAddFutureExpense({
      description: feDescription,
      category: feCategory,
      value: Number(feValue),
      installmentsCount: Number(feInstallments),
      startDate: feStartDate,
      dueDay: Number(feDueDay),
      vehicleId: feVehicleId || undefined
    });

    // Reset Form
    setFeDescription('');
    setFeCategory('Financiamento');
    setFeValue('');
    setFeInstallments(12);
    setFeStartDate(getBrasiliaDateStr());
    setFeDueDay(10);
    setFeVehicleId('');
    setShowAddFutureModal(false);
  };

  const handleConfirmRealize = (expenseId: string, installment: FutureExpenseInstallment) => {
    setRealizeExpenseId(expenseId);
    setRealizeInstallment(installment);
    setRealizeDate(installment.dueDate);
    setShowRealizeModal(true);
  };

  const executeRealization = () => {
    if (!realizeExpenseId || !realizeInstallment) return;
    onRealizeFutureInstallment(realizeExpenseId, realizeInstallment.id, realizeDate);
    setShowRealizeModal(false);
    setRealizeExpenseId('');
    setRealizeInstallment(null);
  };

  // Open Edit Modals
  const openEditModal = (t: Transaction) => {
    setEditId(t.id);
    setEditType(t.type);
    setEditValue(t.value);
    setEditDate(t.date);
    setEditVehicleId(t.vehicleId || '');
    setEditCategory(t.category);
    setEditDescription(t.description);
    setEditIsRealized(t.status === 'realized');
    setShowEditModal(true);
  };

  // Get distinct categories in currently stored transactions for rich autocomplete list
  const allCategories = React.useMemo(() => {
    const list = new Set(transactions.map(t => t.category));
    return Array.from(list);
  }, [transactions]);

  // Filtered entries
  const filteredTransactions = React.useMemo(() => {
    return transactions
      .filter((t) => {
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                              t.category.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesVehicle = filterVehicle === 'all' || t.vehicleId === filterVehicle;
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        const matchesStartDate = !filterStartDate || t.date >= filterStartDate;
        const matchesEndDate = !filterEndDate || t.date <= filterEndDate;

        return matchesSearch && matchesType && matchesVehicle && matchesCategory && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // descending dates
  }, [transactions, search, filterType, filterVehicle, filterCategory, filterStartDate, filterEndDate]);

  // Future only transactions for the "box chamada despesas futuras"
  const futureTransactions = React.useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    return transactions
      .filter((t) => t.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Reset all filters to their initial states
  const handleClearFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterVehicle('all');
    setFilterCategory('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  // Compute financial totals of current filtered transactions
  const filteredTotals = React.useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    let caucoesRecebidos = 0;
    let caucoesDevolvidos = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'receita') {
        receitas += t.value;
      } else if (t.type === 'despesa') {
        despesas += t.value;
      } else if (t.type === 'caucao_recebido') {
        caucoesRecebidos += t.value;
      } else if (t.type === 'caucao_devolvido') {
        caucoesDevolvidos += t.value;
      }
    });

    const entradas = receitas + caucoesRecebidos;
    const saidas = despesas + caucoesDevolvidos;
    const saldoLiquido = entradas - saidas;

    return {
      receitas,
      despesas,
      caucoesRecebidos,
      caucoesDevolvidos,
      entradas,
      saidas,
      saldoLiquido
    };
  }, [filteredTransactions]);

  const MAX_ROWS = 50;
  const totalPages = Math.ceil(filteredTransactions.length / MAX_ROWS);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedTransactions = React.useMemo(() => {
    return filteredTransactions.slice((activePage - 1) * MAX_ROWS, activePage * MAX_ROWS);
  }, [filteredTransactions, activePage]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getTypeText = (input: Transaction | Transaction['type'], fallbackCategory?: string) => {
    const type = typeof input === 'object' && input !== null ? input.type : input;
    const category = typeof input === 'object' && input !== null ? input.category : fallbackCategory;
    switch (type) {
      case 'receita': return 'Receita';
      case 'despesa': return category ? `Despesa - ${category}` : 'Despesa';
      case 'caucao_recebido': return 'Caução Recebido';
      case 'caucao_devolvido': return 'Caução Devolvido';
      default: return 'Lançamento';
    }
  };

  const getTypeStyle = (typeVal: Transaction['type']) => {
    switch (typeVal) {
      case 'receita':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200 font-bold';
      case 'despesa':
        return 'bg-rose-50 text-rose-600 border-rose-200 font-bold';
      case 'caucao_recebido':
        return 'bg-sky-50 text-sky-600 border-sky-300 font-bold';
      case 'caucao_devolvido':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
    }
  };

  // Export dataset to a CSV element downloadable safely
  const exportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Data', 'Tipo', 'Categoria', 'Veiculo', 'Placa', 'Valor', 'Descricao'];
    const rows = filteredTransactions.map(t => {
      const v = vehicles.find(item => item.id === t.vehicleId);
      return [
        t.date,
        getTypeText(t),
        t.category,
        v ? v.brandModel : 'Geral n/v',
        v ? v.plate : '-',
        t.value.toFixed(2),
        `"${t.description.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_locas_veiculos_${getBrasiliaDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Tab Actions and Search Summary Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-premium">
        <div>
          <h2 className="font-display font-bold text-slate-800 text-xl">Livro-Caixa</h2>
          <p className="text-xs text-slate-400 mt-0.5">Listagem, filtros e inserção detalhada de lançamentos e depósitos de segurança.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={exportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 px-4 py-2 rounded-lg text-xs font-semibold font-sans transition-all"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          {!isSocio && (
            <button
              onClick={() => {
                setIsFutureExpense(false);
                setShowAddModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.03] text-white px-5 py-2.5 rounded-xl text-xs font-bold font-sans transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 animate-bounce" />
              Lançar Transação
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Collapsible Header Control for Ledger */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-premium">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-brand-500" />
          <div>
            <span className="font-display font-bold text-slate-800 text-sm block">Planilha do Fluxo Financeiro</span>
            <span className="text-[10px] text-slate-400">
              {isLedgerHidden
                ? 'A planilha está ocultada para priorizar a visualização das Despesas Gerais / Parceladas.'
                : `Exibindo ${filteredTransactions.length} lançamentos distribuídos em páginas de até 30 registros.`
              }
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsLedgerHidden(!isLedgerHidden)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            isLedgerHidden
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          {isLedgerHidden ? (
            <>
              <span>Exibir Lançamentos</span>
              <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>Ocultar Lançamentos</span>
              <ChevronUp className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {!isLedgerHidden && (
        <>
          {/* Structured Filters Panels */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-premium space-y-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-black" />
            <h3 className="text-xs font-bold uppercase text-black tracking-wider">Filtros de Visibilidade</h3>
          </div>
          {(search || filterType !== 'all' || filterVehicle !== 'all' || filterCategory !== 'all' || filterStartDate || filterEndDate) && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-[10px] font-extrabold text-rose-600 hover:text-rose-500 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
            >
              <X className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Text input search */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">Buscar por texto</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Descrição, categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-black" />
            </div>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">Tipo de Lançamento</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">Todos os Tipos</option>
              <option value="receita">Apenas Receitas</option>
              <option value="despesa">Apenas Despesas</option>
              <option value="caucao_recebido">Cauções Recebidos</option>
              <option value="caucao_devolvido">Cauções Devolvidos</option>
            </select>
          </div>

          {/* Vehicle linkage filter */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">Filtro por Veículo</label>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">Qualquer Veículo</option>
              {vehicles.map((v) => {
                const activeRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
                return (
                  <option key={v.id} value={v.id}>
                    {v.isDeleted ? `[Excluído] ` : ''}{v.brandModel} ({v.plate}){activeRental ? ` - Locatário: ${activeRental.tenantName}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Category filter */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">Filtrar Categoria</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">Todas as Categorias</option>
              {allCategories.map((cat, i) => (
                <option key={i} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">De (Data)</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-black mb-1 uppercase">Até (Data)</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
            />
          </div>
        </div>

        {/* Dynamic Filtered Financial Summary Box */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 transition-colors">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Entradas Filtradas</span>
              <span className="text-sm font-extrabold text-emerald-700">{formatCurrency(filteredTotals.entradas)}</span>
              {filteredTotals.caucoesRecebidos > 0 ? (
                <span className="text-[9px] text-emerald-600 block leading-tight">
                  Receitas: {formatCurrency(filteredTotals.receitas)} | Caução: {formatCurrency(filteredTotals.caucoesRecebidos)}
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 block leading-tight">
                  Receitas operacionais do período
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-rose-50/70 border border-rose-100 rounded-xl p-3 transition-colors">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Saídas Filtradas</span>
              <span className="text-sm font-extrabold text-rose-700">{formatCurrency(filteredTotals.saidas)}</span>
              {filteredTotals.caucoesDevolvidos > 0 ? (
                <span className="text-[9px] text-rose-600 block leading-tight">
                  Despesas: {formatCurrency(filteredTotals.despesas)} | Devolvido: {formatCurrency(filteredTotals.caucoesDevolvidos)}
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 block leading-tight">
                  Despesas operacionais do período
                </span>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-3 border rounded-xl p-3 transition-colors ${
            filteredTotals.saldoLiquido >= 0 
              ? 'bg-indigo-50/70 border-indigo-100' 
              : 'bg-amber-50/70 border-amber-100'
          }`}>
            <div className={`p-2 rounded-lg ${
              filteredTotals.saldoLiquido >= 0 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Resultado Líquido Filtrado</span>
              <span className={`text-sm font-extrabold ${
                filteredTotals.saldoLiquido >= 0 ? 'text-indigo-700' : 'text-rose-600'
              }`}>{formatCurrency(filteredTotals.saldoLiquido)}</span>
              <span className="text-[9px] text-slate-400 block leading-tight">
                Saldo das {filteredTransactions.length} transações visíveis
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-premium overflow-hidden">
        {/* VIEW: Desktop Table (hidden on mobile, visible on medium screens and up) */}
        <div className="hidden md:block overflow-auto max-h-[825px] relative scrollbar-thin">
          <table className="w-full text-inner border-collapse min-w-[700px]">
            <thead className="sticky top-0 z-20 shadow-sm bg-slate-50">
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 text-left uppercase tracking-wider select-none">
                <th className="px-6 py-3.5 mr-1 font-sans bg-slate-50">Data de Efetivação</th>
                <th className="px-6 py-3.5 font-sans bg-slate-50">Tipo</th>
                <th className="px-6 py-3.5 font-sans bg-slate-50">Categoria</th>
                <th className="px-6 py-3.5 font-sans bg-slate-50">Veículo Relacionado</th>
                <th className="px-6 py-3.5 font-sans bg-slate-50">Descrição do Lançamento</th>
                <th className="px-6 py-3.5 text-right font-sans bg-slate-50">Entrada/Saídas</th>
                <th className="px-6 py-3.5 text-center font-sans bg-slate-50">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {paginatedTransactions.map((t) => {
                const vehicle = vehicles.find((v) => v.id === t.vehicleId);
                const isPositive = t.type === 'receita' || t.type === 'caucao_recebido';
                const isFuture = t.date > getBrasiliaDateStr();

                return (
                  <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors ${isFuture ? 'bg-slate-50/40 text-slate-400 opacity-70 font-mono italic' : ''}`}>
                    {/* Date */}
                    <td className={`px-6 py-4 font-mono whitespace-nowrap ${isFuture ? 'text-slate-400 italic' : 'text-black font-semibold'}`}>
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>

                    {/* Badge Indicator */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${isFuture ? 'bg-slate-100 text-slate-400 border-slate-200' : getTypeStyle(t.type)}`}>
                        {isFuture ? `PREVISTO / ${getTypeText(t).toUpperCase()}` : getTypeText(t)}
                      </span>
                    </td>

                    {/* Category */}
                    <td className={`px-6 py-4 whitespace-nowrap ${isFuture ? 'text-slate-400 italic font-medium' : 'font-semibold text-slate-700'}`}>
                      {t.category}
                    </td>

                    {/* Linked Vehicle */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle ? (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-extrabold tracking-wide ${isFuture ? 'bg-slate-400 text-white' : 'bg-slate-900 text-white'}`}>
                              {vehicle.plate}
                            </span>
                            <span className={`text-xs ${isFuture ? 'text-slate-400 italic font-medium' : 'font-semibold text-slate-700'}`}>
                              {vehicle.brandModel}
                            </span>
                          </div>
                          {(() => {
                            const rent = rentals.find(r => r.vehicleId === t.vehicleId && r.status === 'active') ||
                                         rentals.find(r => r.vehicleId === t.vehicleId);
                            if (rent) {
                              return (
                                <div className={`text-[10px] font-sans border px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${isFuture ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-brand-50 border-brand-100 text-slate-755'}`}>
                                  <span>Locatário:</span>
                                  <strong className={`font-bold ${isFuture ? 'text-slate-400' : 'text-slate-950'}`}>{rent.tenantName}</strong>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-medium">Geral / Não Vinculado</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className={`px-6 py-4 font-medium max-w-[240px] truncate ${isFuture ? 'text-slate-400 italic' : 'text-slate-500'}`} title={t.description}>
                      {t.description}
                    </td>

                    {/* Cash value */}
                    <td className={`px-6 py-4 text-right font-mono text-sm whitespace-nowrap ${isFuture ? 'text-slate-400 italic font-medium' : isPositive ? 'text-emerald-600 font-bold' : 'text-rose-600 font-normal'}`}>
                      {isPositive ? '+' : '-'} {formatCurrency(t.value)}
                    </td>

                    {/* Deletion / Removal trigger */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {!isSocio ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1 hover:bg-slate-100 hover:text-brand-600 text-slate-350 rounded transition-all"
                            title="Editar Lançamento"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setTransactionToDelete(t);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1 hover:bg-rose-50 hover:text-rose-600 text-slate-350 rounded transition-all"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Visualização</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <Landmark className="h-10 w-10 text-slate-300 stroke-[1.2] mx-auto mb-2" />
                    <p className="font-semibold text-xs text-slate-500">Nenhum lançamento financeiro encontrado.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Experimente alterar os filtros de busca ou cadastre uma nova transação.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* VIEW: Smartphone Vertical Cards (visible on mobile, hidden on tablet/desktop) */}
        <div className="block md:hidden divide-y divide-slate-100 bg-white max-h-[900px] overflow-y-auto relative scrollbar-thin">
          {paginatedTransactions.map((t) => {
            const vehicle = vehicles.find((v) => v.id === t.vehicleId);
            const isPositive = t.type === 'receita' || t.type === 'caucao_recebido';

            return (
              <div key={t.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
                {/* Line 1: Date & Type Badge */}
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-black font-extrabold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${getTypeStyle(t.type)}`}>
                    {getTypeText(t)}
                  </span>
                </div>

                {/* Line 2: Category & Value */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-800 block">
                      {t.category}
                    </span>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {t.description || <span className="italic text-slate-300">Sem descrição</span>}
                    </p>
                  </div>
                  <div className={`font-mono text-sm whitespace-nowrap text-right ${isPositive ? 'text-emerald-600 font-bold' : 'text-rose-600 font-normal'}`}>
                    {isPositive ? '+' : '-'} {formatCurrency(t.value)}
                  </div>
                </div>

                {/* Line 3: Related Vehicle if exists */}
                {vehicle && (
                  <div className="bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-[11px] flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-extrabold shrink-0">
                        {vehicle.plate}
                      </span>
                      <span className="font-bold text-slate-700 truncate">
                        {vehicle.brandModel}
                      </span>
                    </div>
                    {(() => {
                      const rent = rentals.find(r => r.vehicleId === t.vehicleId && r.status === 'active') ||
                                   rentals.find(r => r.vehicleId === t.vehicleId);
                      if (rent) {
                        return (
                          <span className="text-[10px] text-slate-500 font-medium truncate">
                            Cliente: <strong className="text-slate-900 font-bold">{rent.tenantName}</strong>
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Line 4: Action buttons */}
                {!isSocio && (
                  <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-100/60">
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1 px-3 bg-slate-100 hover:bg-brand-50 text-slate-650 hover:text-brand-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => {
                        setTransactionToDelete(t);
                        setShowDeleteConfirm(true);
                      }}
                      className="p-1 px-3 bg-slate-100 hover:bg-rose-50 text-slate-650 hover:text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="text-center py-16 text-slate-400 p-4">
              <Landmark className="h-10 w-10 text-slate-300 stroke-[1.2] mx-auto mb-2" />
              <p className="font-semibold text-xs text-slate-500">Nenhum lançamento financeiro encontrado.</p>
              <p className="text-[10px] text-slate-400 mt-1">Altere os filtros de busca ou cadastre uma nova transação nas ações da tela.</p>
            </div>
          )}
        </div>

        {/* PAGINATION PANEL */}
        {totalPages > 1 && (
          <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex items-center justify-between text-xs text-slate-500 font-sans">
            <div className="hidden sm:block font-semibold">
              Exibindo <strong className="text-slate-800 font-extrabold font-mono">{(activePage - 1) * MAX_ROWS + 1}</strong> a <strong className="text-slate-800 font-extrabold font-mono">{Math.min(activePage * MAX_ROWS, filteredTransactions.length)}</strong> de <strong className="text-slate-800 font-extrabold font-mono">{filteredTransactions.length}</strong> lançamentos
            </div>
            <div className="flex items-center gap-1 mx-auto sm:mx-0">
              <button
                disabled={activePage === 1}
                type="button"
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-705 font-bold transition-all cursor-pointer"
              >
                &lt;&lt;
              </button>
              <button
                disabled={activePage === 1}
                type="button"
                onClick={() => setCurrentPage(activePage - 1)}
                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-705 font-bold transition-all cursor-pointer"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1 select-none overflow-x-auto max-w-[120px] sm:max-w-none py-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer border ${
                      activePage === page
                        ? 'bg-brand-600 text-white border-brand-600 shadow-inner'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                disabled={activePage === totalPages}
                type="button"
                onClick={() => setCurrentPage(activePage + 1)}
                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-705 font-bold transition-all cursor-pointer"
              >
                Próximo
              </button>
              <button
                disabled={activePage === totalPages}
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-705 font-bold transition-all cursor-pointer"
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )}

      {/* BOX: DESPESAS E LANÇAMENTOS FUTUROS (PREVISTOS NO EXTRATO) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-premium flex flex-col justify-between animate-fade-in">
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500 animate-pulse" />
                Despesas e Lançamentos Futuros
              </h3>
              <p className="text-xs text-slate-400">Previsões lançadas com data posterior à atual (não somadas ao caixa).</p>
            </div>
            <span className="text-[10px] bg-slate-100 border border-slate-205 text-slate-600 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
              {futureTransactions.length} previstas
            </span>
          </div>

          <div className="overflow-y-auto max-h-[350px] border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider sticky top-0 bg-white">
                  <th className="px-4 py-3">Previsto Para</th>
                  <th className="px-4 py-3">Lançamento / Veículo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-400">
                {futureTransactions.map((t) => {
                  const isPositive = t.type === 'receita' || t.type === 'caucao_recebido';
                  const vehicle = vehicles.find(v => v.id === t.vehicleId);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-500 whitespace-nowrap">
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-sans font-semibold text-slate-500 italic truncate max-w-[250px]" title={t.description}>
                          {t.description}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.2 rounded font-sans font-semibold">
                            {t.category}
                          </span>
                          {vehicle && (
                            <span className="text-[9px] bg-slate-900 border border-slate-950 text-slate-200 font-mono px-1 rounded font-bold uppercase tracking-wide">
                              {vehicle.plate}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-400 whitespace-nowrap italic">
                        {isPositive ? '+' : '-'} {formatCurrency(t.value)}
                      </td>
                    </tr>
                  );
                })}
                {futureTransactions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-slate-400 italic">
                      Nenhuma despesa ou lançamento futuro cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DESPESAS FUTURAS / PARCELADAS SECTION */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 shadow-inner-sm space-y-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-500" />
              Despesas Gerais / Parceladas / Veículos
            </h3>
            <p className="text-xs text-slate-400">
              Contratos parcelados e faturamento programado. O saldo do caixa principal <strong>não é afetado</strong> por estas parcelas até que sejam quitadas e efetivadas manualmente.
            </p>
          </div>
        </div>

        {futureExpenses && futureExpenses.length > 0 ? (
          <div className="space-y-6">
            {/* AGREGATED VIEW BY VEHICLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(() => {
                const groups = [];
                const trackingIds = new Set();
                futureExpenses.forEach(fe => {
                  const vId = fe.vehicleId || 'general';
                  if (!trackingIds.has(vId)) {
                    trackingIds.add(vId);
                    const v = vehicles.find((item) => item.id === fe.vehicleId);
                    const relatedExp = futureExpenses.filter(item => (item.vehicleId || 'general') === vId);
                    
                    let totalValPending = 0;
                    let totalPaid = 0;
                    let totalCountSum = 0;
                    
                    relatedExp.forEach(re => {
                      re.installments.forEach(inst => {
                        totalCountSum++;
                        if (inst.status === 'realized') {
                          totalPaid++;
                        } else {
                          totalValPending += re.value;
                        }
                      });
                    });
                    
                    groups.push({
                      vehicleId: vId,
                      vehicle: v,
                      expenses: relatedExp,
                      totalValPending,
                      totalPaid,
                      totalCountSum,
                      percent: totalCountSum > 0 ? (totalPaid / totalCountSum) * 100 : 0
                    });
                  }
                });

                return groups.map((g) => {
                  const isExpanded = expandedVehicleFutureGroupId === g.vehicleId;
                  const isGeneral = g.vehicleId === 'general';
                  
                  return (
                    <div 
                      key={g.vehicleId} 
                      className={`bg-white rounded-xl border transition-all duration-200 shadow-sm flex flex-col justify-between overflow-hidden cursor-pointer hover:border-brand-300 ${isExpanded ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-slate-200'}`}
                      onClick={() => setExpandedVehicleFutureGroupId(isExpanded ? null : g.vehicleId)}
                    >
                      {/* Card top details */}
                      <div className="p-4 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            {!isGeneral && g.vehicle ? (
                              <>
                                <span className="font-mono text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-extrabold tracking-wide">
                                  {g.vehicle.plate}
                                </span>
                                <h4 className="font-display font-extrabold text-slate-800 text-sm mt-1 leading-tight">
                                  {g.vehicle.brandModel}
                                </h4>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold tracking-wide">
                                  DIVERSOS / ADMINISTRATIVOS
                                </span>
                                <h4 className="font-display font-extrabold text-slate-800 text-sm mt-1 leading-tight">
                                  Despesas Gerais
                                </h4>
                              </>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">
                              Total Pendente
                            </span>
                            <span className="text-xs font-black font-mono text-brand-600 whitespace-nowrap">
                              {formatCurrency(g.totalValPending)}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="pt-1.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Efetivado: <strong>{g.totalPaid}</strong> de <strong>{g.totalCountSum}</strong> parcelas</span>
                            <span className="font-bold font-mono text-brand-600">{g.percent.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${g.percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Card action button */}
                      <div className="p-2.5 px-4 bg-slate-50/75 border-t border-slate-100 flex items-center justify-between text-xs text-brand-600 font-semibold font-sans">
                        <span>{g.expenses.length} parcelamento(s) vinculado(s)</span>
                        <span className="flex items-center gap-1 font-bold">
                          {isExpanded ? 'Ocultar Detalhes' : 'Ver Parcelamentos'}
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* EXPANDED DETAILED DISPLAY SECTION */}
            {expandedVehicleFutureGroupId && (
              <div className="bg-white rounded-xl border border-brand-100 p-5 shadow-premium-lg animate-fade-in space-y-4">
                {(() => {
                  const activeGroup = vehicles.find(v => v.id === expandedVehicleFutureGroupId);
                  const isGeneral = expandedVehicleFutureGroupId === 'general';
                  const label = isGeneral ? 'Gerais' : `${activeGroup?.brandModel} (${activeGroup?.plate})`;
                  const filteredExp = futureExpenses.filter(fe => (fe.vehicleId || 'general') === expandedVehicleFutureGroupId);
                  
                  return (
                    <>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                        <div>
                          <h4 className="font-display font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-brand-500"></span>
                            Parcelamentos vinculados ao veículo: 
                            <span className="text-brand-600 underline decoration-brand-200 font-bold font-mono">{label}</span>
                          </h4>
                          <p className="text-xs text-slate-400">Gerencie e efetive cada parcela individualmente.</p>
                        </div>
                        <button
                          onClick={() => setExpandedVehicleFutureGroupId(null)}
                          className="text-[11px] hover:bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded"
                        >
                          Fechar Detalhes
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredExp.map((fe) => {
                          const totalPaidObj = fe.installments.filter(inst => inst.status === 'realized').length;
                          const percentObj = fe.installmentsCount > 0 ? (totalPaidObj / fe.installmentsCount) * 100 : 0;
                          
                          // Icon matching
                          let IconComp = Landmark;
                          const lowerCat = fe.category.toLowerCase();
                          if (lowerCat.includes('financiamento') || lowerCat.includes('consórcio')) IconComp = CreditCard;
                          else if (lowerCat.includes('ipva') || lowerCat.includes('imposto') || lowerCat.includes('taxa')) IconComp = FileText;
                          else if (lowerCat.includes('seguro')) IconComp = Shield;
                          else if (lowerCat.includes('manutenção') || lowerCat.includes('oficina') || lowerCat.includes('reparo')) IconComp = Wrench;

                          return (
                            <div key={fe.id} className="bg-slate-50/50 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-between overflow-hidden hover:bg-white transition-colors">
                              {/* Header details */}
                              <div className="p-4 border-b border-slate-200/55 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-brand-50 border border-brand-100 text-brand-700 font-sans inline-flex items-center gap-1">
                                      <IconComp className="h-2.5 w-2.5" />
                                      {fe.category}
                                    </span>
                                    <h5 className="font-display font-semibold text-slate-800 text-xs sm:text-sm mt-1 leading-tight font-sans">
                                      {fe.description || `Parcelamento de ${fe.category}`}
                                    </h5>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-black font-mono text-slate-950">
                                      {formatCurrency(fe.value)} <span className="text-[9px] font-normal text-slate-400">/ parc.</span>
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-mono">
                                      Vencimento: Dia {fe.dueDay}
                                    </p>
                                  </div>
                                </div>

                                <div className="pt-1">
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5 font-sans">
                                    <span>Efetivado: <strong>{totalPaidObj}</strong> de <strong>{fe.installmentsCount}</strong></span>
                                    <span className="font-bold font-mono text-slate-705">{percentObj.toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200/50 rounded-full h-1">
                                    <div
                                      className="bg-brand-500 h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${percentObj}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>

                              {/* Installments scrolling block */}
                              <div className="p-2 bg-white/60 divide-y divide-slate-100 max-h-[160px] overflow-y-auto space-y-1">
                                {fe.installments.map((inst) => {
                                  const isRealized = inst.status === 'realized';
                                  const dueDateObj = new Date(inst.dueDate + 'T00:00:00');

                                  return (
                                    <div
                                      key={inst.id}
                                      className={`flex items-center justify-between p-1.5 rounded text-[11px] gap-2 ${
                                        isRealized
                                          ? 'bg-slate-50/50 opacity-60 text-slate-400'
                                          : 'bg-white border border-slate-100 hover:bg-slate-50/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                                          {inst.installmentNumber}/{fe.installmentsCount}
                                        </span>
                                        {!isRealized ? (
                                          <input
                                            type="date"
                                            value={inst.dueDate}
                                            onChange={(e) => onUpdateFutureInstallmentDate(fe.id, inst.id, e.target.value)}
                                            className="px-1 py-0.5 border border-slate-200 rounded font-mono text-[9px] bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            title="Clique para editar a data estimada"
                                          />
                                        ) : (
                                          <span className="font-mono text-[10px] text-slate-400 line-through">
                                            {dueDateObj.toLocaleDateString('pt-BR')}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <span className="font-mono font-semibold text-slate-700">
                                          {formatCurrency(fe.value)}
                                        </span>
                                        {!isRealized ? (
                                          !isSocio && (
                                            <button
                                              type="button"
                                              onClick={() => handleConfirmRealize(fe.id, inst)}
                                              className="px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[9px] font-extrabold font-sans transition-all flex items-center gap-0.5 shadow-sm cursor-pointer"
                                            >
                                              <Check className="h-2.5 w-2.5" />
                                              Efetivar
                                            </button>
                                          )
                                        ) : (
                                          <span className="text-[9px] text-emerald-650 font-bold flex items-center bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded">
                                            <Check className="h-2.5 w-2.5" /> Pago
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Card Action footer */}
                              {!isSocio && (
                                <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => onDeleteFutureExpense(fe.id)}
                                    className="text-[10px] font-bold text-rose-500 hover:text-rose-750 font-sans flex items-center gap-1 pointer-events-auto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 max-w-md mx-auto">
            <Calendar className="h-8 w-8 text-slate-350 stroke-[1.2] mx-auto mb-2" />
            <p className="font-semibold text-xs text-slate-600">Nenhum parcelamento futuro ativo.</p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Deseja planejar parcelas de financiamentos, parcelamentos recorrentes, taxas de seguro ou IPVA? Clique no botão acima para registrar.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: ADD TRANSACTION MANUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-brand-500" />
                Registrar Movimentação
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUnified} className="space-y-4">
              {/* Type Switcher tab buttons inside the dialog */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsFutureExpense(false)}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md transition-all ${
                    !isFutureExpense ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Lançamento Direto
                </button>
                <button
                  type="button"
                  onClick={() => setIsFutureExpense(true)}
                  className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md transition-all ${
                    isFutureExpense ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Despesa Futura Parcelada
                </button>
              </div>

              {!isFutureExpense ? (
                <>
                  {/* Type Select buttons */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de Registro</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTypeChange('receita')}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all-custom flex items-center justify-center gap-1.5 ${
                          type === 'receita'
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm font-extrabold'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        Receita
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange('despesa')}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all-custom flex items-center justify-center gap-1.5 ${
                          type === 'despesa'
                            ? 'bg-rose-600 border-rose-700 text-white shadow-sm font-extrabold'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <ArrowDownCircle className="h-4 w-4" />
                        Despesa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange('caucao_recebido')}
                        className={`p-2.5 rounded-lg border text-xs font-bold col-span-1 transition-all-custom flex items-center justify-center gap-1.5 ${
                          type === 'caucao_recebido'
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm font-extrabold'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <DollarSign className="h-4 w-4" />
                        Entrada Caução
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange('caucao_devolvido')}
                        className={`p-2.5 rounded-lg border text-xs font-bold col-span-1 transition-all-custom flex items-center justify-center gap-1.5 ${
                          type === 'caucao_devolvido'
                            ? 'bg-rose-600 border-rose-700 text-white shadow-sm font-extrabold'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <X className="h-4 w-4" />
                        Saída Caução
                      </button>
                    </div>
                  </div>

                  {/* Value & Date elements */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Valor do Lançamento (R$)</label>
                      <input
                        type="number"
                        required
                        placeholder="Ex: 500"
                        min="0.01"
                        step="0.01"
                        value={value}
                        onChange={(e) => setValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Data Efetiva</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Linked Vehicle selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Veículo Correspondente (Opcional)</label>
                    <select
                      value={vehicleId}
                      onChange={(e) => setVehicleId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Não vinculado a veículo específico (Geral)</option>
                      {vehicles.filter(v => !v.isDeleted).map((v) => {
                        const activeRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
                        return (
                          <option key={v.id} value={v.id}>
                            {v.brandModel} ({v.plate}){activeRental ? ` - Locatário: ${activeRental.tenantName}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Category input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Categoria</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: IPVA, Pneus, Guincho, Mensalidade..."
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      list="categories-options"
                    />
                    <datalist id="categories-options">
                      <option value="Aluguel Semanal" />
                      <option value="Manutenção" />
                      <option value="Combustível" />
                      <option value="Seguro" />
                      <option value="IPVA/Impostos" />
                      <option value="Multas de Trânsito" />
                      <option value="Depósito de Garantia" />
                      <option value="Devolução de Garantia" />
                      <option value="Outros" />
                    </datalist>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Descrição (Opcional)</label>
                    <textarea
                      placeholder="Ex: Recebimento aluguel semana 3 do Onix de João"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                      rows={2}
                    />
                  </div>

                  {/* Option to mark dynamic future transaction as already settled / paid/ abatida */}
                  {date > getBrasiliaDateStr() && (
                    <div className="flex items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 transition-all">
                      <input
                        type="checkbox"
                        id="isRealizedCheckbox"
                        checked={isRealized}
                        onChange={(e) => setIsRealized(e.target.checked)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="isRealizedCheckbox" className="text-slate-700 text-xs font-semibold cursor-pointer select-none">
                        Já compensada / abatida antecipadamente no caixa geral
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Future Expense Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Valor da Parcela (R$)</label>
                      <input
                        type="number"
                        required
                        placeholder="Ex: 1655"
                        min="0.01"
                        step="0.01"
                        value={feValue}
                        onChange={(e) => setFeValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Qtd Parcelas (Meses)</label>
                      <input
                        type="number"
                        required
                        placeholder="Ex: 33"
                        min="1"
                        max="120"
                        value={feInstallments}
                        onChange={(e) => setFeInstallments(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Vencimento da Parcela 1</label>
                      <input
                        type="date"
                        required
                        value={feStartDate}
                        onChange={(e) => setFeStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Dia Fixo de Débito</label>
                      <input
                        type="number"
                        required
                        placeholder="Ex: 10"
                        min="1"
                        max="31"
                        value={feDueDay}
                        onChange={(e) => setFeDueDay(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Veículo Relacionado (Opcional)</label>
                    <select
                      value={feVehicleId}
                      onChange={(e) => setFeVehicleId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Não vinculado a veículo específico (Geral)</option>
                      {vehicles.filter(v => !v.isDeleted).map((v) => {
                        const activeRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
                        return (
                          <option key={v.id} value={v.id}>
                            {v.brandModel} ({v.plate}){activeRental ? ` - Locatário: ${activeRental.tenantName}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Categoria (Obrigatória)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Financiamento, Seguro, Consórcio..."
                      value={feCategory}
                      onChange={(e) => setFeCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      list="categories-options-future"
                    />
                    <datalist id="categories-options-future">
                      <option value="Financiamento" />
                      <option value="Consórcio de Veículo" />
                      <option value="Manutenção Programada" />
                      <option value="Seguro Frota" />
                      <option value="IPVA/Impostos" />
                      <option value="Aluguel de Escritório" />
                      <option value="Outros" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1">Descrição / Comentários</label>
                    <textarea
                      placeholder="Ex: Financiamento do Onix em 33 parcelas"
                      value={feDescription}
                      onChange={(e) => setFeDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                      rows={2}
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 ${isFutureExpense ? 'bg-brand-500 hover:bg-brand-600' : 'bg-emerald-600 hover:bg-emerald-500'} text-white rounded-lg text-xs font-bold font-sans transition-all shadow-md`}
                >
                  {isFutureExpense ? 'Agendar Despesa Parcelada' : 'Registrar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRANSACTION */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-brand-500" />
                Editar Lançamento
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Type Select buttons */}
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditTypeChange('receita')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all-custom flex items-center justify-center gap-1.5 ${
                      editType === 'receita'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTypeChange('despesa')}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all-custom flex items-center justify-center gap-1.5 ${
                      editType === 'despesa'
                        ? 'bg-rose-50 border-rose-500 text-rose-75 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTypeChange('caucao_recebido')}
                    className={`p-2.5 rounded-lg border text-xs font-bold col-span-1 transition-all-custom flex items-center justify-center gap-1.5 ${
                      editType === 'caucao_recebido'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                    Entrada Caução
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditTypeChange('caucao_devolvido')}
                    className={`p-2.5 rounded-lg border text-xs font-bold col-span-1 transition-all-custom flex items-center justify-center gap-1.5 ${
                      editType === 'caucao_devolvido'
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <X className="h-4 w-4" />
                    Saída Caução
                  </button>
                </div>
              </div>

              {/* Value & Date elements */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor do Lançamento (R$)</label>
                  <input
                    type="number"
                    required
                    placeholder="Ex: 500"
                    min="0.01"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data Efetiva</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                  />
                </div>
              </div>

              {/* Linked Vehicle selection */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Veículo Correspondente (Opcional)</label>
                <select
                  value={editVehicleId}
                  onChange={(e) => setEditVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Não vinculado a veículo específico (Geral)</option>
                  {vehicles.filter(v => !v.isDeleted).map((v) => {
                    const activeRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.brandModel} ({v.plate}){activeRental ? ` - Locatário: ${activeRental.tenantName}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Category input */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: IPVA, Pneus, Guincho..."
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  list="categories-options-edit"
                />
                <datalist id="categories-options-edit">
                  <option value="Aluguel Semanal" />
                  <option value="Manutenção" />
                  <option value="Combustível" />
                  <option value="Seguro" />
                  <option value="IPVA/Impostos" />
                  <option value="Multas de Trânsito" />
                  <option value="Depósito de Garantia" />
                  <option value="Devolução de Garantia" />
                  <option value="Outros" />
                </datalist>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descrição do Lançamento (Opcional)</label>
                <textarea
                  placeholder="Ex: Recebimento aluguel de Onix"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-sans"
                  rows={2}
                />
              </div>

              {/* Option to mark dynamic future transaction as already settled / paid/ abatida inside edit modal */}
              {editDate > getBrasiliaDateStr() && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 transition-all">
                  <input
                    type="checkbox"
                    id="editIsRealizedCheckbox"
                    checked={editIsRealized}
                    onChange={(e) => setEditIsRealized(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                  />
                  <label htmlFor="editIsRealizedCheckbox" className="text-slate-700 text-xs font-semibold cursor-pointer select-none">
                    Já compensada / abatida antecipadamente no caixa geral
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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

      {/* MODAL: DELETE TRANSACTION CONFIRMATION */}
      {showDeleteConfirm && transactionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-500" />
                Excluir Lançamento Financeiro
              </h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTransactionToDelete(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Tem certeza de que deseja excluir permanentemente este lançamento financeiro?
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Descrição:</span>
                  <span className="font-sans font-semibold text-slate-700 max-w-[180px] truncate">{transactionToDelete.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Categoria:</span>
                  <span className="font-sans font-medium text-slate-700">{transactionToDelete.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor:</span>
                  <span className="font-bold text-rose-600">{formatCurrency(transactionToDelete.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data:</span>
                  <span>{transactionToDelete.date.split('-').reverse().join('/')}</span>
                </div>
              </div>
              <p className="text-[10px] text-rose-500 font-semibold leading-normal">
                Aviso: Esta ação irá atualizar todos os relatórios e o caixa total do aplicativo. Não pode ser desfeita.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTransactionToDelete(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(transactionToDelete!.id);
                  setShowDeleteConfirm(false);
                  setTransactionToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-premium"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM EFFECTUATION / REALIZATION */}
      {showRealizeModal && realizeInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                Efetivar Parcela de Despesa
              </h3>
              <button
                onClick={() => {
                  setShowRealizeModal(false);
                  setRealizeInstallment(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Confirmar a efetivação desta parcela? Ela será transferida para o livro-caixa administrativo principal e contabilizada nos gráficos e relatórios imediatos.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 font-mono text-xs text-slate-650 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Parcela:</span>
                  <span className="font-bold text-slate-700">Parcela #{realizeInstallment.installmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vencimento Estimado:</span>
                  <span>{new Date(realizeInstallment.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 mt-3">Data de Pagamento Efetiva</label>
                <input
                  type="date"
                  required
                  value={realizeDate}
                  onChange={(e) => setRealizeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRealizeModal(false);
                  setRealizeInstallment(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeRealization}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold font-sans transition-all shadow-md shadow-emerald-550/10"
              >
                Confirmar Efetivação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
