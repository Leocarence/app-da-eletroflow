import React, { useState, useEffect, useRef } from 'react';
import { 
  Vehicle, 
  Rental, 
  Transaction, 
  FutureExpense, 
  InterestedLead, 
  AppUser 
} from '../types';
import { getBrasiliaDateStr, getBrasiliaUiDateStr } from '../utils/dateUtils';
import { isFinancingTransaction, isMaintenanceTransaction } from '../utils/transactions';
import { 
  Sparkles, 
  Send, 
  RotateCcw, 
  Bot, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  CarFront, 
  Coins, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  ExternalLink,
  Shield,
  Layers,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  Wrench
} from 'lucide-react';

export interface GestorIATabProps {
  vehicles: Vehicle[];
  rentals: Rental[];
  transactions: Transaction[];
  futureExpenses: FutureExpense[];
  interestedLeads: InterestedLead[];
  users: AppUser[];
  currentUser: AppUser | null;
  financials: {
    currentCash: number;
    totalRevenues: number;
    totalExpenses: number;
    activeCaucaoInHand: number;
    financingExpenses?: number;
    maintenanceExpenses?: number;
    otherExpenses?: number;
  };
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onUpdateVehicleStatus: (id: string, status: 'available' | 'rented' | 'maintenance') => void;
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => void;
  onAddFutureExpense: (fe: Omit<FutureExpense, 'id'>) => void;
  onStartRental: (r: Omit<Rental, 'id'>) => void;
  onTerminateRental: (rentalId: string, endDate: string) => void;
  onAddInterestedLead: (lead: Omit<InterestedLead, 'id' | 'createdAt'>) => void;
  onNavigateTab: (tab: 'dashboard' | 'financials' | 'transactions' | 'vehicles' | 'rentals' | 'users') => void;
  showNotification: (msg: string, type: 'success' | 'info' | 'error') => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  actionsExecuted?: Array<{
    type: string;
    description: string;
    targetTab?: 'dashboard' | 'financials' | 'transactions' | 'vehicles' | 'rentals' | 'users';
  }>;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'model',
  text: 'Skywalker ao seu comando! Pronto para trabalhar!',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
};

const QUICK_PROMPTS = [
  { label: '💰 Saldo & Receita', prompt: 'Qual o saldo atual em caixa e o total de receitas acumuladas?' },
  { label: '🚗 Veículos Livres & Oficina', prompt: 'Quais veículos estão disponíveis para locação e quais estão na oficina?' },
  { label: '📅 Despesas Próximos 30 dias', prompt: 'Quais são as despesas futuras previstas para os próximos 30 dias?' },
  { label: '📊 Carro Mais Lucrativo', prompt: 'Qual veículo gerou maior receita em aluguéis e qual teve mais gastos de manutenção?' },
  { label: '👥 Contratos Ativos', prompt: 'Quantos contratos estão ativos atualmente e qual o valor semanal de cada um?' }
];

export const GestorIATab: React.FC<GestorIATabProps> = ({
  vehicles,
  rentals,
  transactions,
  futureExpenses,
  interestedLeads,
  users,
  currentUser,
  financials,
  onAddTransaction,
  onUpdateVehicleStatus,
  onAddVehicle,
  onAddFutureExpense,
  onStartRental,
  onTerminateRental,
  onAddInterestedLead,
  onNavigateTab,
  showNotification
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('loca_skywalker_chat');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [INITIAL_MESSAGE];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic Mouse & Touch Drag Resizing
  const [chatHeight, setChatHeight] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('loca_skywalker_chat_height');
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val >= 380 && val <= 2400) return val;
      }
    } catch (_) {}
    return 680;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(680);

  const startResizing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) return;
    if ('button' in e && e.button !== 0) return; // only left click
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = chatHeight;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = currentY - startYRef.current;
      const newHeight = Math.max(380, Math.min(2400, startHeightRef.current + deltaY));
      setChatHeight(newHeight);
      try {
        localStorage.setItem('loca_skywalker_chat_height', String(newHeight));
      } catch (_) {}
    };

    const onEnd = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Auto-save chat history locally
  useEffect(() => {
    try {
      localStorage.setItem('loca_skywalker_chat', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    localStorage.removeItem('loca_skywalker_chat');
    showNotification('Histórico da conversa reiniciado.', 'info');
  };

  // Helper to execute function calls returned by Gemini
  const executeFunctionCalls = (functionCalls: Array<{ name: string; args: any }>) => {
    const executed: Array<{ type: string; description: string; targetTab?: any }> = [];
    const today = getBrasiliaDateStr();

    for (const call of functionCalls) {
      const { name, args } = call;
      try {
        if (name === 'add_transaction') {
          const type = args.type || 'despesa';
          const value = Number(args.value) || 0;
          const category = args.category || 'Geral';
          const description = args.description || 'Lançamento via Skywalker';
          const date = args.date || today;
          
          let matchedVehicleId: string | undefined = undefined;
          if (args.vehiclePlateOrId) {
            const vMatch = vehicles.find(v => 
              v.id === args.vehiclePlateOrId || 
              v.plate.toUpperCase().replace('-', '') === String(args.vehiclePlateOrId).toUpperCase().replace('-', '')
            );
            if (vMatch) matchedVehicleId = vMatch.id;
          }

          onAddTransaction({
            type,
            value,
            category,
            description,
            date,
            vehicleId: matchedVehicleId
          });

          executed.push({
            type: 'Transação Lançada',
            description: `${type.toUpperCase()}: R$ ${value.toFixed(2)} - ${description}`,
            targetTab: 'transactions'
          });
        } 
        else if (name === 'update_vehicle_status') {
          const plateOrId = String(args.plateOrId || '');
          const newStatus = args.newStatus;
          const v = vehicles.find(item => 
            item.id === plateOrId || 
            item.plate.toUpperCase().replace('-', '') === plateOrId.toUpperCase().replace('-', '')
          );
          if (v && (newStatus === 'available' || newStatus === 'rented' || newStatus === 'maintenance')) {
            onUpdateVehicleStatus(v.id, newStatus);
            executed.push({
              type: 'Status de Veículo Atualizado',
              description: `${v.brandModel} (${v.plate}) → ${newStatus === 'available' ? 'Disponível' : newStatus === 'rented' ? 'Locado' : 'Oficina'}`,
              targetTab: 'vehicles'
            });
          }
        }
        else if (name === 'add_vehicle') {
          onAddVehicle({
            brandModel: args.brandModel || 'Veículo',
            plate: args.plate || 'SEM-PLACA',
            weeklyRate: Number(args.weeklyRate) || 600,
            depositValue: Number(args.depositValue) || 1500,
            status: args.status || 'available',
            mileage: args.mileage ? Number(args.mileage) : undefined
          });
          executed.push({
            type: 'Veículo Cadastrado',
            description: `${args.brandModel} (${args.plate})`,
            targetTab: 'vehicles'
          });
        }
        else if (name === 'add_future_expense') {
          const value = Number(args.value) || 0;
          const count = Number(args.installmentsCount) || 1;
          const installments = [];
          for (let i = 1; i <= count; i++) {
            installments.push({
              id: 'inst_' + Math.random().toString(36).substr(2, 9),
              installmentNumber: i,
              dueDate: args.startDate || today,
              status: 'pending' as const
            });
          }
          onAddFutureExpense({
            description: args.description || 'Previsão de Despesa',
            category: args.category || 'Despesa Fixa',
            value,
            installmentsCount: count,
            startDate: args.startDate || today,
            dueDay: Number(args.dueDay) || 10,
            installments
          });
          executed.push({
            type: 'Despesa Futura Programada',
            description: `${args.description} (${count}x de R$ ${value.toFixed(2)})`,
            targetTab: 'financials'
          });
        }
        else if (name === 'start_rental') {
          const v = vehicles.find(item => 
            item.id === args.vehiclePlateOrId || 
            item.plate.toUpperCase().replace('-', '') === String(args.vehiclePlateOrId).toUpperCase().replace('-', '')
          );
          if (v) {
            onStartRental({
              vehicleId: v.id,
              tenantName: args.tenantName,
              phone: args.phone || '',
              startDate: args.startDate || today,
              endDate: '2026-12-31',
              weeklyRate: Number(args.weeklyRate) || v.weeklyRate,
              depositValue: Number(args.depositValue) || v.depositValue,
              status: 'active',
              paymentDayOfWeek: args.paymentDayOfWeek !== undefined ? Number(args.paymentDayOfWeek) : 1
            });
            executed.push({
              type: 'Contrato de Locação Iniciado',
              description: `${v.brandModel} (${v.plate}) para ${args.tenantName}`,
              targetTab: 'rentals'
            });
          }
        }
        else if (name === 'terminate_rental') {
          const target = rentals.find(r => 
            r.id === args.contractIdOrPlate || 
            r.vehicleId === args.contractIdOrPlate
          );
          if (target) {
            onTerminateRental(target.id, args.endDate || today);
            executed.push({
              type: 'Contrato Encerrado',
              description: `Locação de ${target.tenantName} finalizada`,
              targetTab: 'rentals'
            });
          }
        }
        else if (name === 'add_interested_lead') {
          onAddInterestedLead({
            name: args.name,
            phone: args.phone,
            notes: args.notes || 'Interessado adicionado via Skywalker IA',
            contactDate: today,
            docApproved: false,
            contactCount: 1
          });
          executed.push({
            type: 'Interessado Cadastrado',
            description: `${args.name} (${args.phone})`,
            targetTab: 'rentals'
          });
        }
        else if (name === 'get_vehicle_maintenance_history') {
          const v = vehicles.find(item => 
            item.id === args.plateOrId || 
            item.plate.toUpperCase().replace('-', '') === String(args.plateOrId).toUpperCase().replace('-', '')
          );
          if (v) {
            const repairs = transactions.filter(t => 
              (t.vehicleId === v.id || (t.description && t.description.includes(v.plate))) &&
              t.type === 'despesa' &&
              (t.category === 'Manutenção' || t.category.includes('Manutenção') || t.category === 'Revisão' || t.category === 'Pneus' || t.category === 'Oficina')
            );
            const totalRepairs = repairs.reduce((sum, r) => sum + r.value, 0);
            onNavigateTab('vehicles');
            executed.push({
              type: 'Histórico de Manutenção Consultado',
              description: `${v.brandModel} (${v.plate}): ${repairs.length} intervenção(ões), Total: R$ ${totalRepairs.toFixed(2)}`,
              targetTab: 'vehicles'
            });
          }
        }
        else if (name === 'get_financial_breakdown') {
          onNavigateTab('financials');
          executed.push({
            type: 'Demonstrativo Financeiro Consultado',
            description: `Apresentando separação entre Financiamentos e Manutenções`,
            targetTab: 'financials'
          });
        }
        else if (name === 'navigate_to_tab') {
          if (args.tab) {
            onNavigateTab(args.tab);
            executed.push({
              type: 'Navegação',
              description: `Navegou para a aba ${args.tab}`,
              targetTab: args.tab
            });
          }
        }
      } catch (err) {
        console.warn("[Skywalker Action Execution Error]:", err);
      }
    }

    return executed;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build snapshot context with all accessible data
      const totalFinancing = transactions
        .filter(t => isFinancingTransaction(t))
        .reduce((sum, t) => sum + t.value, 0);

      const totalMaintenanceAll = transactions
        .filter(t => isMaintenanceTransaction(t))
        .reduce((sum, t) => sum + t.value, 0);

      const contextSnapshot = {
        hoje: getBrasiliaDateStr(),
        financeiro: {
          dinheiroEmCaixa: financials.currentCash,
          receitasTotais: financials.totalRevenues,
          despesasTotais: financials.totalExpenses,
          caucaoEmMaos: financials.activeCaucaoInHand,
          despesasFinanciamentoTotal: totalFinancing,
          despesasManutencaoTotal: totalMaintenanceAll,
          outrasDespesasOperacionais: Math.max(0, financials.totalExpenses - totalFinancing - totalMaintenanceAll)
        },
        separacaoFinanceira: {
          despesasFinanciamentoTotal: totalFinancing,
          despesasManutencaoTotal: totalMaintenanceAll,
          outrasDespesasOperacionais: Math.max(0, financials.totalExpenses - totalFinancing - totalMaintenanceAll),
          financiamentosFuturos: futureExpenses.filter(fe => fe.category === 'Financiamento').map(fe => ({
            descricao: fe.description,
            valorParcela: fe.value,
            totalParcelas: fe.installmentsCount,
            parcelasPendentes: fe.installments.filter(i => i.status === 'pending').length
          }))
        },
        frota: vehicles.filter(v => !v.isDeleted).map(v => {
          const currentRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
          const vehicleMaintenanceTxs = transactions.filter(t => 
            (t.vehicleId === v.id || (t.description && t.description.includes(v.plate))) &&
            isMaintenanceTransaction(t)
          );
          const totalMaintenance = vehicleMaintenanceTxs.reduce((sum, t) => sum + t.value, 0);
          return {
            id: v.id,
            placa: v.plate,
            modelo: v.brandModel,
            status: v.status,
            valorSemanal: v.weeklyRate,
            caucao: v.depositValue,
            kmAtual: v.mileage,
            locatarioAtual: currentRental ? currentRental.tenantName : null,
            totalGastoManutencao: totalMaintenance,
            quantidadeManutencoes: vehicleMaintenanceTxs.length,
            historicoManutencoes: vehicleMaintenanceTxs.map(mt => ({
              data: mt.date,
              descricao: mt.description,
              valor: mt.value,
              categoria: mt.category
            }))
          };
        }),
        contratos: rentals.filter(r => !r.isDeleted).map(r => {
          const v = vehicles.find(veh => veh.id === r.vehicleId);
          return {
            id: r.id,
            veiculoPlaca: v ? v.plate : 'N/A',
            veiculoModelo: v ? v.brandModel : 'N/A',
            locatario: r.tenantName,
            telefone: r.phone,
            inicio: r.startDate,
            fim: r.endDate,
            valorSemanal: r.weeklyRate,
            caucao: r.depositValue,
            status: r.status,
            diaPagamentoSemana: r.paymentDayOfWeek
          };
        }),
        extratoRecente: transactions.slice(-120).map(t => {
          const v = t.vehicleId ? vehicles.find(veh => veh.id === t.vehicleId) : null;
          return {
            id: t.id,
            data: t.date,
            tipo: t.type,
            valor: t.value,
            categoria: t.category,
            descricao: t.description,
            placa: v ? v.plate : null
          };
        }),
        despesasFuturas: futureExpenses.map(fe => ({
          id: fe.id,
          descricao: fe.description,
          categoria: fe.category,
          valorParcela: fe.value,
          totalParcelas: fe.installmentsCount,
          diaVencimento: fe.dueDay,
          parcelasPendentes: fe.installments.filter(i => i.status === 'pending').map(i => i.dueDate)
        })),
        interessadosNaFila: interestedLeads.map(l => ({
          id: l.id,
          nome: l.name,
          telefone: l.phone,
          documentoAprovado: l.docApproved,
          observacoes: l.notes
        })),
        usuarioConectado: currentUser ? {
          nome: currentUser.name,
          email: currentUser.email,
          papel: currentUser.role
        } : null
      };

      const res = await fetch('/api/gestor-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-8).map(m => ({ role: m.role, text: m.text })),
          context: contextSnapshot
        })
      });

      if (!res.ok) {
        let serverErrorText = '';
        try {
          const errData = await res.json();
          serverErrorText = errData.error || errData.details || '';
        } catch (_) {}
        if (serverErrorText.includes('models/') || serverErrorText.includes('404') || serverErrorText.includes('503') || serverErrorText.includes('high demand') || serverErrorText.startsWith('{')) {
          serverErrorText = 'Os servidores de inteligência artificial estão com alta demanda temporária no momento. Por favor, aguarde alguns segundos e tente novamente.';
        }
        throw new Error(serverErrorText || `Erro HTTP ${res.status} ao comunicar com o servidor.`);
      }

      const data = await res.json();
      
      let actionsExecuted: Array<{ type: string; description: string; targetTab?: any }> = [];
      if (data.functionCalls && data.functionCalls.length > 0) {
        actionsExecuted = executeFunctionCalls(data.functionCalls);
        if (actionsExecuted.length > 0) {
          showNotification(`✓ ${actionsExecuted.length} ação(ões) executada(s) pelo Skywalker.`, 'success');
        }
      }

      let replyText = data.reply || 'Operação processada.';
      if (replyText.startsWith('{') && replyText.includes('"error"')) {
        replyText = 'Os servidores de inteligência artificial estão com alta demanda temporária. Por favor, aguarde alguns instantes e tente novamente.';
      }

      const modelMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: actionsExecuted.length > 0 ? actionsExecuted : undefined
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      console.error("Skywalker chat error:", err);
      let displayMsg = err?.message || 'Não consegui me comunicar com o servidor no momento. Por favor, verifique sua conexão ou tente novamente em instantes.';
      if (displayMsg.startsWith('{') && displayMsg.includes('"error"')) {
        displayMsg = 'Os servidores de inteligência artificial estão com alta demanda temporária. Por favor, tente novamente em alguns segundos.';
      }
      const errorMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'model',
        text: displayMsg,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      showNotification(displayMsg, 'error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Render markdown-like simple formatting (bold, tables, lists, currency badges)
  const renderFormattedText = (rawText: string) => {
    // If the text has a Markdown table
    if (rawText.includes('|') && rawText.includes('\n')) {
      const lines = rawText.split('\n');
      const tableLines = lines.filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
      if (tableLines.length >= 2) {
        return (
          <div className="space-y-2">
            <div className="overflow-x-auto my-2 rounded-xl border border-slate-700/60 bg-slate-900/60 shadow-inner">
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                      // separator line
                      if (trimmed.includes('---')) return null;
                      const cells = trimmed.split('|').slice(1, -1);
                      const isHeader = idx === 0 || lines[idx + 1]?.includes('---');
                      return (
                        <tr key={idx} className={isHeader ? "bg-slate-800/90 font-bold text-cyan-300 border-b border-slate-700" : "hover:bg-slate-800/40 border-b border-slate-800 text-slate-200"}>
                          {cells.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 text-xs font-mono">
                              {cell.trim()}
                            </td>
                          ))}
                        </tr>
                      );
                    }
                    if (trimmed) {
                      return <p key={idx} className="text-slate-200 text-xs py-0.5">{trimmed}</p>;
                    }
                    return null;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
    }

    // Default line-by-line render with bold highlights
    const paragraphs = rawText.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
        {paragraphs.map((p, pIdx) => {
          if (!p.trim()) return <div key={pIdx} className="h-1" />;
          
          // Bullet point
          if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
            const content = p.trim().substring(2);
            return (
              <div key={pIdx} className="flex items-start gap-2 pl-1">
                <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: highlightFormatting(content) }} />
              </div>
            );
          }

          return (
            <p key={pIdx} dangerouslySetInnerHTML={{ __html: highlightFormatting(p) }} />
          );
        })}
      </div>
    );
  };

  const highlightFormatting = (str: string) => {
    // Bold **text**
    let formatted = str.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    // Currency R$ XX,XX highlight
    formatted = formatted.replace(/(R\$\s?[\d.,]+)/g, '<span class="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-500/20">$1</span>');
    return formatted;
  };

  return (
    <div 
      style={{ height: isFullscreen ? 'calc(100vh - 80px)' : `${chatHeight}px` }}
      className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-premium-2xl overflow-hidden animate-fade-in font-sans transition-[height] duration-150 ${isResizingRef.current ? 'select-none transition-none' : ''}`}
    >
      
      {/* 1. TOP EXECUTIVE HEADER */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/40">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-sm" title="Online" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-white text-base tracking-tight flex items-center gap-1.5">
                Skywalker
                <span className="text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/30">
                  Gestor IA
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Inteligência executiva integrada com acesso irrestrito a todas as abas e dados.
            </p>
          </div>
        </div>

        {/* Quick telemetry & Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-emerald-400" />
              Caixa: <b className="text-white">R$ {financials.currentCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <CarFront className="h-3 w-3 text-cyan-400" />
              Frota: <b className="text-white">{vehicles.filter(v => !v.isDeleted).length} carros</b>
            </span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Restaurar tamanho padrão" : "Expandir janela do chat"}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline text-[11px] font-medium">{isFullscreen ? "Restaurar" : "Expandir"}</span>
          </button>

          <button
            onClick={handleClearChat}
            title="Reiniciar Conversa"
            className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">Limpar</span>
          </button>
        </div>
      </div>

      {/* 2. QUICK PROMPT CHIPS */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0 mr-1 font-mono">
          <Zap className="h-3 w-3 text-amber-400" />
          Ações Rápidas:
        </span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendMessage(qp.prompt)}
            className="text-[11px] font-medium whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-700/60 hover:border-cyan-500/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* 3. MESSAGE THREAD CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {!isUser && (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shrink-0 shadow-md border border-cyan-400/30 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[88%] sm:max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-3 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-br from-cyan-600 to-brand-600 text-white rounded-tr-xs border border-cyan-400/30'
                      : 'bg-slate-800/90 text-slate-100 rounded-tl-xs border border-slate-700/80 shadow-inner'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    renderFormattedText(msg.text)
                  )}

                  {/* Render executed actions cards if any */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/80 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 font-mono">
                        <CheckCircle2 className="h-3 w-3" />
                        Ação Executada no Sistema:
                      </span>
                      {msg.actionsExecuted.map((act, aIdx) => (
                        <div
                          key={aIdx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs text-slate-200"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-white text-[11px]">{act.type}:</span>
                            <span className="truncate text-slate-300 text-[11px]">{act.description}</span>
                          </div>
                          {act.targetTab && (
                            <button
                              onClick={() => onNavigateTab(act.targetTab)}
                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 shrink-0 hover:underline cursor-pointer"
                            >
                              Ver na aba
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-[9.5px] text-slate-500 font-mono mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>

              {isUser && (
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0 border border-slate-700 mt-0.5 shadow-sm">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 justify-start animate-fade-in">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white shrink-0 shadow-md border border-cyan-400/30">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-inner flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400 font-mono ml-1">Skywalker processando dados...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. INPUT COMPONENT */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            placeholder="Pergunte ao Skywalker ou peça uma ação executiva (ex: lance uma despesa, consulte faturamento, etc.)..."
            className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-sans"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="absolute right-2 p-2 bg-gradient-to-r from-cyan-500 to-brand-500 hover:from-cyan-400 hover:to-brand-400 disabled:opacity-40 disabled:hover:from-cyan-500 text-white rounded-lg transition-all cursor-pointer shadow-md disabled:cursor-not-allowed"
            title="Enviar mensagem para Skywalker"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2 font-mono">
          Skywalker analisa frotas, contratos, receitas e despesas com acesso irrestrito a todos os dados da plataforma.
        </p>
      </div>

      {/* 5. INTERACTIVE MOUSE RESIZE HANDLE BAR & CORNER GRIP */}
      {!isFullscreen && (
        <div
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          title="Clique e arraste com o mouse para redimensionar a altura da janela do chat"
          className={`relative group h-6 bg-slate-950 border-t border-slate-800/80 cursor-ns-resize flex items-center justify-center gap-2 transition-all select-none shrink-0 ${
            isResizing ? 'bg-cyan-950/70 border-cyan-500/60' : 'hover:bg-cyan-950/40 hover:border-slate-700'
          }`}
        >
          <div className="w-8 h-1 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
          <span className="text-[9px] text-slate-400 group-hover:text-cyan-300 font-mono tracking-widest uppercase transition-colors flex items-center gap-1.5 font-bold">
            ↕ Arraste com o mouse para Redimensionar {isResizing && <span className="text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-500/40">({chatHeight}px)</span>}
          </span>
          <div className="w-8 h-1 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />

          {/* Bottom-right corner grip */}
          <div
            onMouseDown={startResizing}
            onTouchStart={startResizing}
            title="Arraste para redimensionar"
            className="absolute right-2 bottom-1 w-4 h-4 cursor-se-resize flex flex-col justify-end items-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-3 h-0.5 bg-cyan-400/80 rounded-full" />
            <div className="w-2 h-0.5 bg-cyan-400/80 rounded-full" />
            <div className="w-1 h-0.5 bg-cyan-400/80 rounded-full" />
          </div>
        </div>
      )}

    </div>
  );
};
