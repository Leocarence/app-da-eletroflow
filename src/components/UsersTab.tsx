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
  EyeOff
} from 'lucide-react';
import { AppUser } from '../types';

interface UsersTabProps {
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: (user: Omit<AppUser, 'id'>) => boolean;
  onDeleteUser: (id: string) => void;
  onChangePasswordClick?: () => void;
}

export function UsersTab({ users, currentUser, onAddUser, onDeleteUser, onChangePasswordClick }: UsersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
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

  return (
    <div className="space-y-6 animate-fade-in">
      
      <div id="users-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-800">Controle de Usuários</h2>
          <p className="text-xs text-slate-400">Gerenciamento administrativo de credenciais de acesso de funcionários e administradores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CREATE USER CARD */}
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

          {isSocio ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
              <Lock className="h-6 w-6 text-amber-500 mx-auto" />
              <span className="text-xs font-bold text-slate-700 block">Modo Sócio Ativado</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Você possui privilégios de **Sócio (Apenas Visualização)**. Não é possível cadastrar ou remover credenciais de acesso de outros colaboradores no sistema.
              </p>
            </div>
          ) : (
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
          )}
        </div>

        {/* ACTIVE USERS LIST CARD */}
        <div id="users-list-box" className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-premium p-6">
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
                  <th className="py-2.5 px-3 text-right">Ação</th>
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

                      <td className="py-3 px-3 text-right">
                        {!isPrimaryRoot && !isCurrent ? (
                          !isSocio ? (
                            <button
                              onClick={() => handleDeleteClick(user.id, user.name, user.email)}
                              className="p-1 px-2.5 text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-100 hover:border-rose-500 font-medium rounded-lg text-xs transition-all flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remover</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Visualização
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">
                            Bloqueado
                          </span>
                        )}
                      </td>
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

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mt-4 flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
              Apenas os usuários raiz principais ou usuários de nível <strong>Administrador Pleno</strong> podem cadastrar novos funcionários ou remover operadores secundários do painel.
            </p>
          </div>

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
