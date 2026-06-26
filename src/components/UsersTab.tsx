import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  UserPlus, 
  Trash2, 
  Mail, 
  Key, 
  User, 
  Shield, 
  AlertTriangle,
  Check,
  Search,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  ArrowLeft,
  Cpu,
  Database,
  Clock,
  Download
} from 'lucide-react';
import { AppUser, AccessLog } from '../types';

interface UsersTabProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: (user: Omit<AppUser, 'id'>) => boolean;
  onDeleteUser: (id: string) => void;
  onChangePasswordClick?: () => void;
  accessLogs?: AccessLog[];
  onClearAccessLogs?: (ids?: string[]) => void;
}

export function UsersTab({ users, currentUser, onAddUser, onDeleteUser, onChangePasswordClick, accessLogs, onClearAccessLogs }: UsersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDevLogs, setShowDevLogs] = useState(false);
  const [currentLogPage, setCurrentLogPage] = useState(1);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  
  // Create User Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'socio'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtered Users list
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSocio = currentUser?.role === 'socio';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validations
    if (!name.trim()) {
      setErrorMsg('O nome do usuário é obrigatório.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Por favor, informe um e-mail válido.');
      return;
    }
    if (password.trim().length < 4) {
      setErrorMsg('A senha do usuário deve ter pelo menos 4 caracteres.');
      return;
    }

    const wasAdded = onAddUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role
    });

    if (wasAdded) {
      setSuccessMsg('✓ Usuário cadastrado com sucesso!');
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setRole('admin');
      
      // Auto-dismiss success message
      setTimeout(() => {
        setSuccessMsg(null);
      }, 2500);
    } else {
      setErrorMsg('Já existe um usuário cadastrado com este e-mail.');
    }
  };

  const handleDeleteClick = (userId: string, userName: string, userEmail: string) => {
    if (currentUser && userId === currentUser.id) {
      alert('Você não pode remover a si mesmo do sistema para evitar bloqueio de conta.');
      return;
    }

    // Prevention of deletion of the primary developer
    const isPrimaryDeveloper = userEmail === 'leojoex@hotmail.com';
    if (isPrimaryDeveloper) {
      alert('O desenvolvedor principal (leojoex@hotmail.com) não pode ser deletado do sistema.');
      return;
    }

    if (window.confirm(`Tem certeza que deseja remover o usuário "${userName}" (${userEmail})? Ele perderá acesso ao sistema.`)) {
      onDeleteUser(userId);
    }
  };

  if (showDevLogs) {
    const logs = accessLogs || [];
    const MAX_LOG_ROWS = 50;
    const totalLogPages = Math.ceil(logs.length / MAX_LOG_ROWS);
    const activeLogPage = Math.min(currentLogPage, Math.max(1, totalLogPages));
    const paginatedLogs = logs.slice((activeLogPage - 1) * MAX_LOG_ROWS, activeLogPage * MAX_LOG_ROWS);

    const handleExportLogs = () => {
      if (logs.length === 0) {
        alert('Nenhum log disponível para exportar.');
        return;
      }
      
      // Excel-compatible CSV format with semicolon delimiter and UTF-8 Byte Order Mark (BOM)
      const headers = [
        'ID do Registro',
        'Profissional',
        'E-mail',
        'Nivel de Acesso',
        'Data e Horario (BRL)',
        'Plataforma/Dispositivo'
      ];
      
      const rows = logs.map(log => [
        log.id,
        log.userName || '',
        log.userEmail || '',
        log.userRole || '',
        log.timestamp || '',
        log.deviceInfo || ''
      ]);
      
      const csvContent = "\uFEFF" + [
        headers.join(';'),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
      ].join('\r\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `auditoria_conexoes_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    };

    const handleClearLogsClick = () => {
      if (logs.length === 0) {
        alert('Nenhum log disponível para apagar.');
        return;
      }
      if (window.confirm('Tem certeza de que deseja apagar TODOS os logs de conexões da auditoria? Esta ação é irreversível.')) {
        if (onClearAccessLogs) {
          onClearAccessLogs();
          setSelectedLogIds([]);
          setSelectionMode(false);
          setCurrentLogPage(1);
        }
      }
    };

    const areAllPaginatedLogsSelected = paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogIds.includes(log.id));

    const handleSelectAllPaginatedLogs = () => {
      if (areAllPaginatedLogsSelected) {
        // Unselect all paginated logs
        setSelectedLogIds(prev => prev.filter(id => !paginatedLogs.map(l => l.id).includes(id)));
      } else {
        // Select all paginated logs
        const paginatedIds = paginatedLogs.map(l => l.id);
        setSelectedLogIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
      }
    };

    const handleSelectLog = (logId: string) => {
      setSelectedLogIds(prev => 
        prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]
      );
    };

    const handleDeleteSelectedLogs = () => {
      if (selectedLogIds.length === 0) {
        alert('Selecione pelo menos um log para apagar.');
        return;
      }
      if (window.confirm(`Tem certeza de que deseja apagar os ${selectedLogIds.length} logs selecionados?`)) {
        if (onClearAccessLogs) {
          onClearAccessLogs(selectedLogIds);
          setSelectedLogIds([]);
          setSelectionMode(false);
        }
      }
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div id="users-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-md font-mono">
                Modo Root Dev
              </span>
              <h2 className="font-display text-lg font-bold text-indigo-950">Registro de Acessos Operacionais</h2>
            </div>
            <p className="text-xs text-slate-400">Mapeamento em tempo real de conexões e autenticações na infraestrutura corporativa.</p>
          </div>
          <button
            onClick={() => setShowDevLogs(false)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para Usuários</span>
          </button>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 relative overflow-hidden group">
            <div className="absolute -top-12 -right-12 h-26 w-26 bg-indigo-500/20 rounded-full opacity-60"></div>
            <div className="flex justify-between items-start z-10 relative">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Conexões Gravadas</span>
                <h2 className="font-display font-black text-white text-3xl mt-1 tracking-tight font-mono">
                  {logs.length}
                </h2>
              </div>
              <div className="h-9 w-9 rounded-xl bg-slate-850 flex items-center justify-center text-indigo-400">
                <Cpu className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4">Auditoria activa e de auditoria persistente no disco de backup.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium relative overflow-hidden group">
            <div className="flex justify-between items-start z-10 relative">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Usuários Registrados</span>
                <h2 className="font-display font-black text-indigo-900 text-3xl mt-1 tracking-tight font-mono">
                  {users.length}
                </h2>
              </div>
              <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Database className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4">{users.filter(u => u.role === 'admin').length} Administradores, {users.filter(u => u.role === 'socio').length} Sócios.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium relative overflow-hidden group col-span-1">
            <div className="flex justify-between items-start z-10 relative">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Última Autenticação</span>
                <h2 className="font-sans font-bold text-indigo-950 text-base mt-2 tracking-wide truncate">
                  {logs[0] ? logs[0].timestamp : 'Sem logins'}
                </h2>
              </div>
              <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-4">{logs[0] ? `Por ${logs[0].userName}` : 'Inicie as sessões da equipe.'}</p>
          </div>
        </div>

        {/* LOGS TABLE CARD */}
        <div className="bg-white rounded-2xl border border-indigo-100/50 shadow-premium p-6">
          <div className="pb-4 border-b border-slate-100 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-slate-800 text-sm">Controle de Conexões à Aplicação (Auditoria)</h3>
              <p className="text-[10px] text-slate-400">Logs detalhados de credenciais em conformidade com as regras de privilégios de auditoria.</p>
            </div>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={handleExportLogs}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Exportar todos os logs de conexões em formato Excel (.csv)"
              >
                <Download className="h-3.5 w-3.5 text-indigo-500" />
                <span>Exportar Logs (Excel)</span>
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Opções para apagar logs"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  <span>Apagar Logs</span>
                </button>
                
                {showDeleteMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDeleteMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-150 rounded-2xl shadow-xl z-50 py-2 animate-fade-in text-xs">
                      <div className="px-3 py-1.5 border-b border-slate-100 font-bold text-slate-500 text-[10px] uppercase tracking-wider select-none">
                        Opções de Exclusão
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectionMode(true);
                          setShowDeleteMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-indigo-600 transition-colors font-semibold flex items-center gap-2"
                      >
                        <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                        <span>Marcar logs para apagar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteMenu(false);
                          handleClearLogsClick();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 transition-colors font-semibold flex items-center gap-2"
                      >
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        <span>Apagar todos de uma vez</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE SELECTION CONTROL BAR */}
          {selectionMode && (
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="font-bold text-indigo-950">Modo de Seleção Ativo:</span>
                <span>{selectedLogIds.length} de {logs.length} logs marcados para exclusão.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteSelectedLogs}
                  disabled={selectedLogIds.length === 0}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer transition-all text-[11px] disabled:cursor-not-allowed"
                >
                  Apagar Selecionados ({selectedLogIds.length})
                </button>
                <button
                  onClick={() => {
                    setSelectedLogIds([]);
                    setSelectionMode(false);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-lg cursor-pointer transition-all text-[11px]"
                >
                  Cancelar Seleção
                </button>
              </div>
            </div>
          )}

          <div className="overflow-auto max-h-[550px] relative scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 shadow-sm bg-slate-50">
                <tr className="border-b border-slate-100 text-[10px] uppercase font-mono tracking-wider text-slate-400 bg-slate-50">
                  {selectionMode && (
                    <th className="py-2.5 px-3 bg-slate-50 text-center w-10">
                      <input
                        type="checkbox"
                        checked={areAllPaginatedLogsSelected}
                        onChange={handleSelectAllPaginatedLogs}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        title="Selecionar todos da página"
                      />
                    </th>
                  )}
                  <th className="py-2.5 px-3 bg-slate-50">Profissional</th>
                  <th className="py-2.5 px-3 bg-slate-50">Nível Classificado</th>
                  <th className="py-2.5 px-3 bg-slate-50">Identificação Eletrônica</th>
                  <th className="py-2.5 px-3 bg-slate-50">Data e Horário (BRL)</th>
                  <th className="py-2.5 px-3 text-right bg-slate-50">Plataforma/Ponto de Ingress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log) => {
                  const isDev = log.userEmail === 'leojoex@hotmail.com';
                  const isSelected = selectedLogIds.includes(log.id);
                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-indigo-50/20 transition-colors text-xs font-semibold text-slate-700 ${isSelected ? 'bg-indigo-50/10' : ''}`}
                    >
                      {selectionMode && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectLog(log.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-display font-bold ${
                            isDev ? 'bg-indigo-950 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.userName ? log.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 font-sans block">{log.userName}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{log.userEmail}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono ${
                          isDev 
                            ? 'bg-indigo-955 text-indigo-900 border border-indigo-200'
                            : log.userRole === 'Administrador Pleno'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : log.userRole === 'Sócio'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {log.userRole}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md">
                          {log.id}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-mono text-[11px]">
                        {log.timestamp}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-500 font-mono text-[10px]">
                        {log.deviceInfo}
                      </td>
                    </tr>
                  );
                })}

                {paginatedLogs.length === 0 && (
                  <tr>
                    <td colSpan={selectionMode ? 6 : 5} className="text-center py-12 text-slate-400 text-xs">
                      Não há logs de conexões gravados nos servidores locais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalLogPages > 1 && (
            <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
              <button
                disabled={activeLogPage === 1}
                type="button"
                onClick={() => setCurrentLogPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-650 rounded-xl font-bold hover:bg-slate-50 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1 select-none overflow-x-auto max-w-[120px] sm:max-w-none py-1">
                {Array.from({ length: totalLogPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentLogPage(page)}
                    className={`px-2.5 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer border ${
                      activeLogPage === page
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                disabled={activeLogPage === totalLogPages}
                type="button"
                onClick={() => setCurrentLogPage((prev) => Math.min(totalLogPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-650 rounded-xl font-bold hover:bg-slate-50 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                Próximo
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      <div id="users-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-800">Controle de Usuários</h2>
          <p className="text-xs text-slate-400">Gerenciamento administrativo de credenciais de acesso de funcionários e administradores.</p>
        </div>
        {currentUser?.email === 'leojoex@hotmail.com' && (
          <button
            onClick={() => setShowDevLogs(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <Terminal className="h-4 w-4 text-indigo-250 animate-pulse" />
            <span>Informações de desenvolvimento</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CREATE USER CARD */}
        {!isSocio && (
          <div id="create-user-box" className="bg-white rounded-2xl border border-slate-100 shadow-premium p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
                <UserPlus className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-display font-bold text-slate-800 text-sm">Cadastrar Novo Usuário</h3>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* NAME */}
              <div>
                <label className="block text-[9px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1">
                  Nome do Usuário
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl outline-none text-xs text-slate-700 font-sans font-medium"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label className="block text-[9px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1">
                  E-mail de Login
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@hotmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl outline-none text-xs text-slate-700 font-sans font-medium"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label className="block text-[9px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1">
                  Senha Operacional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl outline-none text-xs text-slate-700 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-450 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* ROLE */}
              <div>
                <label className="block text-[9px] uppercase font-mono tracking-wider font-extrabold text-slate-400 mb-1">
                  Nível de Privilégio
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'user' | 'socio')}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl outline-none text-xs text-slate-700 font-sans font-medium"
                  >
                    <option value="admin">Administrador Pleno (Superuser)</option>
                    <option value="user">Usuário Operador</option>
                    <option value="socio">Sócio (Apenas Visualização)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-4"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Concluir Cadastro</span>
              </button>

            </form>
          </div>
        )}

        {/* ACTIVE USERS LIST CARD */}
        <div id="users-list-box" className={`${isSocio ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white rounded-2xl border border-slate-100 shadow-premium p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-4">
            <div>
              <h3 className="font-display font-bold text-slate-800 text-sm">Usuários Ativos</h3>
              <p className="text-[10px] text-slate-400">Colaboradores com acesso operacional ativo.</p>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-full sm:w-56 bg-slate-50 border border-slate-200 text-xs rounded-xl outline-none text-slate-700"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Profissional</th>
                  <th className="py-2.5 px-3">E-mail de Acesso</th>
                  <th className="py-2.5 px-3">Privilégio</th>
                  <th className="py-2.5 px-3 text-right">Senha Oculta</th>
                  {!isSocio && <th className="py-2.5 px-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser && user.id === currentUser.id;
                  const isPrimaryRoot = user.email === 'leojoex@hotmail.com';
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors text-xs font-medium text-slate-700">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center font-display font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 font-sans block">{user.name}</span>
                            {isCurrent && (
                              <span className="inline-block bg-sky-100 text-sky-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full mt-0.5">
                                Sua Sessão Ativa
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-slate-55 block">{user.email}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold font-sans ${
                          user.role === 'admin' 
                            ? 'bg-purple-50 text-purple-600 border border-purple-100' 
                            : user.role === 'socio'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {user.role === 'admin' ? 'Administrador Pleno' : user.role === 'socio' ? 'Sócio (Visualização)' : 'Usuário Operador'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600 font-semibold select-all">
                        {currentUser?.email === 'leojoex@hotmail.com'
                          ? (user.password || 'Sem senha')
                          : (user.password ? '••••••' : 'Sem senha')
                        }
                      </td>

                      {!isSocio && (
                        <td className="py-3 px-3 text-right">
                          {!isPrimaryRoot && !isCurrent ? (
                            <button
                              onClick={() => handleDeleteClick(user.id, user.name, user.email)}
                              className="p-1 px-2.5 text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-100 hover:border-rose-500 font-medium rounded-lg text-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remover</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">
                              Bloqueado
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                      Nenhum colaborador operacional correspondente à busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!isSocio && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mt-4 flex items-start gap-2.5">
              <Shield className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
                Apenas os usuários raiz principais ou usuários de nível <strong>Administrador Pleno</strong> podem cadastrar novos funcionários ou remover operadores secundários do painel.
              </p>
            </div>
          )}

          {onChangePasswordClick && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={onChangePasswordClick}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-sans text-xs font-bold rounded-xl shadow-premium hover:shadow-premium-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Alterar Minha Senha de Acesso</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
