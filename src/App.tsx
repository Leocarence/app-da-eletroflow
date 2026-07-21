import React, { useState, useEffect, useRef } from 'react';
import { Vehicle, Rental, Transaction, FutureExpense, FutureExpenseInstallment, InterestedLead } from './types';
import { getBrasiliaDateStr, toLocalDateStr, getBrasiliaUiDateStr } from './utils/dateUtils';
import {
  INITIAL_VEHICLES,
  INITIAL_RENTALS,
  INITIAL_TRANSACTIONS
} from './initialData';
import CashFlowChart from './components/CashFlowChart';
import VehiclesTab from './components/VehiclesTab';
import RentalsTab from './components/RentalsTab';
import TransactionsTab from './components/TransactionsTab';
import { FinancialsTab } from './components/FinancialsTab';
import { LoginScreen } from './components/LoginScreen';
import { UsersTab } from './components/UsersTab';
import { EletroflowLogo } from './components/EletroflowLogo';
import { AppUser, AccessLog } from './types';
import {
  LayoutDashboard,
  FileSpreadsheet,
  CarFront,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Percent,
  Timer,
  RefreshCcw,
  Plus,
  Wrench,
  Wand2,
  Lock,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  CalendarDays,
  Calendar,
  Key,
  Zap,
  X,
  Users,
  LogOut,
  Database,
  ArrowDown
} from 'lucide-react';

const INITIAL_USERS: AppUser[] = [
  {
    id: 'u_1',
    name: 'Leo',
    email: 'leojoex@hotmail.com',
    password: '557345',
    role: 'admin'
  },
  {
    id: 'u_2',
    name: 'Administrador',
    email: 'carenceveiculos@gmail.com',
    password: '14961245',
    role: 'admin'
  }
];

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'financials' | 'transactions' | 'vehicles' | 'rentals' | 'users'>('dashboard');

  // Sync state for Cash Flow Chart Tooltip / Sidebox
  const [hoveredPointData, setHoveredPointData] = useState<{
    point: any;
    meta: {
      timeFrame: 'diario' | 'semanal' | 'mensal';
      chartMode: 'acumulado' | 'diario';
      showReceitas: boolean;
      showDespesas: boolean;
      latestPoint: any;
    } | null;
  }>({ point: null, meta: null });

  // Security / Authentication State
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const stored = localStorage.getItem('loca_users');
      return stored ? JSON.parse(stored) : INITIAL_USERS;
    } catch (e) {
      return INITIAL_USERS;
    }
  });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem('loca_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>(() => {
    try {
      const stored = localStorage.getItem('loca_access_logs');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [interestedLeads, setInterestedLeads] = useState<InterestedLead[]>(() => {
    try {
      const stored = localStorage.getItem('loca_interested_leads');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Dashboard Sub-Financials visibility toggle (revenue, deposit, expenses)
  const [showSubFinancials, setShowSubFinancials] = useState(false);

  // Core Reactive Data Store with local persistence
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const stored = localStorage.getItem('loca_vehicles');
      return stored ? JSON.parse(stored) : INITIAL_VEHICLES;
    } catch (e) {
      return INITIAL_VEHICLES;
    }
  });
  const [rentals, setRentals] = useState<Rental[]>(() => {
    try {
      const stored = localStorage.getItem('loca_rentals');
      return stored ? JSON.parse(stored) : INITIAL_RENTALS;
    } catch (e) {
      return INITIAL_RENTALS;
    }
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem('loca_transactions');
      return stored ? JSON.parse(stored) : INITIAL_TRANSACTIONS;
    } catch (e) {
      return INITIAL_TRANSACTIONS;
    }
  });
  const [futureExpenses, setFutureExpenses] = useState<FutureExpense[]>(() => {
    try {
      const stored = localStorage.getItem('loca_future_expenses');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Database Connection Telemetry status
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    uriConfigured: boolean;
    uriMasked: string;
    lastError: string | null;
    readyState: number;
  } | null>(null);

  const checkDbStatus = async () => {
    try {
      const resp = await fetch('/api/db-status');
      if (resp.ok) {
        const data = await resp.json();
        setDbStatus(data);
      }
    } catch (e) {
      console.warn("Error checking database status:", e);
    }
  };

  // Confirmation state for app reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Toast / notification feedback alerts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<any>(null);

  // Mobile Pull to Refresh States
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const lastMutationTimeRef = useRef<number>(0);
  const lastEtagRef = useRef<string | null>(null);

  // Automatic background synchronization
  useEffect(() => {
    let intervalId: any;

    const performPoll = async () => {
      if (isSavingRef.current || document.visibilityState !== 'visible') return;
      const pollStartTime = Date.now();
      try {
        const response = await fetch('/api/load-data', {
          headers: lastEtagRef.current ? { 'If-None-Match': lastEtagRef.current } : {}
        });

        // 304 Not Modified -> server data has not changed since last check
        if (response.status === 304) {
          return;
        }

        if (response.ok) {
          const newEtag = response.headers.get('ETag');
          if (newEtag) {
            lastEtagRef.current = newEtag;
          }

          const serverBackup = await response.json();
          if (pollStartTime < lastMutationTimeRef.current || isSavingRef.current) {
            console.log("[Background Poll] Stale or concurrent poll request ignored to prevent state regression.");
            return;
          }
          if (serverBackup && serverBackup.vehicles && serverBackup.vehicles.length > 0) {
            const sVehicles = serverBackup.vehicles;
            const sRentals = serverBackup.rentals || [];
            const sTransactions = serverBackup.transactions || [];
            const sFuture = serverBackup.futureExpenses || [];
            const sUsers = serverBackup.users || [];
            const sAccessLogs = serverBackup.accessLogs || [];
            const sLeads = serverBackup.interestedLeads || [];

            // Safe State Updates (prevents screen flickers and only updates on difference)
            setVehicles(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sVehicles)) {
                localStorage.setItem('loca_vehicles', JSON.stringify(sVehicles));
                return sVehicles;
              }
              return prev;
            });

            setRentals(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sRentals)) {
                localStorage.setItem('loca_rentals', JSON.stringify(sRentals));
                return sRentals;
              }
              return prev;
            });

            setTransactions(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sTransactions)) {
                localStorage.setItem('loca_transactions', JSON.stringify(sTransactions));
                return sTransactions;
              }
              return prev;
            });

            setFutureExpenses(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sFuture)) {
                localStorage.setItem('loca_future_expenses', JSON.stringify(sFuture));
                return sFuture;
              }
              return prev;
            });

            setUsers(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sUsers)) {
                localStorage.setItem('loca_users', JSON.stringify(sUsers));
                return sUsers;
              }
              return prev;
            });

            setAccessLogs(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sAccessLogs)) {
                localStorage.setItem('loca_access_logs', JSON.stringify(sAccessLogs));
                return sAccessLogs;
              }
              return prev;
            });

            setInterestedLeads(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(sLeads)) {
                localStorage.setItem('loca_interested_leads', JSON.stringify(sLeads));
                return sLeads;
              }
              return prev;
            });

            // Sync safety backup
            const backupObj = { 
              vehicles: sVehicles, 
              rentals: sRentals, 
              transactions: sTransactions, 
              futureExpenses: sFuture, 
              users: sUsers, 
              accessLogs: sAccessLogs,
              interestedLeads: sLeads
            };
            localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));
          }
        }
      } catch (e) {
        console.warn("[Background Poll] Sync failed:", e);
      }
    };

    // Delay start of polling slightly so initial hydration finishes first
    const delayTimeout = setTimeout(() => {
      // Poll every 30 seconds when active/visible
      intervalId = setInterval(performPoll, 30000);
    }, 3000);

    // Sync immediately when tab becomes active again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performPoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearTimeout(delayTimeout);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Gesture detection for mobile Pull-to-Refresh
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        pullStartYRef.current = e.touches[0].clientY;
        setRefreshSuccess(false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStartYRef.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - pullStartYRef.current;

      if (diffY > 0) {
        // Resistance factor
        const distance = Math.min(diffY * 0.35, 95);
        setPullDistance(distance);

        // Prevent body bounce-scrolling only when actively pulling down at the top
        if (distance > 15 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (pullStartYRef.current === null || isRefreshing) return;
      pullStartYRef.current = null;

      if (pullDistance >= 65) {
        setIsRefreshing(true);
        setPullDistance(60); // lock at spinner position

        try {
          const response = await fetch('/api/load-data');
          if (response.ok) {
            const serverBackup = await response.json();
            if (serverBackup && serverBackup.vehicles && serverBackup.vehicles.length > 0) {
              setVehicles(serverBackup.vehicles);
              setRentals(serverBackup.rentals || []);
              setTransactions(serverBackup.transactions || []);
              setFutureExpenses(serverBackup.futureExpenses || []);
              setUsers(serverBackup.users || []);
              setAccessLogs(serverBackup.accessLogs || []);

              localStorage.setItem('loca_vehicles', JSON.stringify(serverBackup.vehicles));
              localStorage.setItem('loca_rentals', JSON.stringify(serverBackup.rentals || []));
              localStorage.setItem('loca_transactions', JSON.stringify(serverBackup.transactions || []));
              localStorage.setItem('loca_future_expenses', JSON.stringify(serverBackup.futureExpenses || []));
              localStorage.setItem('loca_users', JSON.stringify(serverBackup.users || []));
              localStorage.setItem('loca_access_logs', JSON.stringify(serverBackup.accessLogs || []));

              const backupObj = {
                vehicles: serverBackup.vehicles,
                rentals: serverBackup.rentals || [],
                transactions: serverBackup.transactions || [],
                futureExpenses: serverBackup.futureExpenses || [],
                users: serverBackup.users || [],
                accessLogs: serverBackup.accessLogs || []
              };
              localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));
            }
          }
          setRefreshSuccess(true);
          showNotification('✓ Base atualizada com sucesso!', 'success');
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (err) {
          console.error("Failed to refresh:", err);
          showNotification('Erro ao sincronizar dados.', 'error');
        } finally {
          setIsRefreshing(false);
          setRefreshSuccess(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  // Quick Action Form state values
  const [quickRentPaymentContractId, setQuickRentPaymentContractId] = useState('');
  const [quickRentPaymentValue, setQuickRentPaymentValue] = useState<number | ''>('');
  const [quickMaintenanceVehicleId, setQuickMaintenanceVehicleId] = useState('');
  const [quickMaintenanceCost, setQuickMaintenanceCost] = useState<number | ''>('');
  const [quickMaintenanceDesc, setQuickMaintenanceDesc] = useState('');

  // Dialog & Backup dropdown state keys
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [showDbDiagnosticsModal, setShowDbDiagnosticsModal] = useState(false);

  // Change password modal state variables
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (currentPasswordInput !== currentUser.password) {
      showNotification('A senha atual está incorreta.', 'error');
      return;
    }
    if (newPasswordInput.length < 4) {
      showNotification('A nova senha deve ter pelo menos 4 caracteres.', 'error');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      showNotification('As novas senhas não coincidem.', 'error');
      return;
    }

    // Update inside the users array
    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return { ...u, password: newPasswordInput };
      }
      return u;
    });

    // Update current user so current state/session stays in sync
    const updatedUser = { ...currentUser, password: newPasswordInput };
    setCurrentUser(updatedUser);
    syncAndSetUsers(updatedUsers);

    showNotification('Sua senha foi alterada com sucesso!', 'success');
    
    // Clear state inputs
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setShowChangePasswordModal(false);
  };

  // Initial Seed check and state hydration
  const persistToBackend = async (
    vList: Vehicle[],
    rList: Rental[],
    tList: Transaction[],
    fList: FutureExpense[],
    uList?: AppUser[],
    aLogs?: AccessLog[],
    leadsList?: InterestedLead[],
    isManualClick = false
  ) => {
    isSavingRef.current = true;
    lastMutationTimeRef.current = Date.now();
    try {
      const activeUsers = uList || users;
      const activeLogs = aLogs || accessLogs;
      const activeLeads = leadsList || interestedLeads;
      
      // Keep localStorage in key-value sync
      localStorage.setItem('loca_access_logs', JSON.stringify(activeLogs));
      localStorage.setItem('loca_interested_leads', JSON.stringify(activeLeads));
      
      const response = await fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vehicles: vList, 
          rentals: rList, 
          transactions: tList, 
          futureExpenses: fList,
          users: activeUsers,
          accessLogs: activeLogs,
          interestedLeads: activeLeads
        })
      });
      if (response.ok) {
        const newEtag = response.headers.get('ETag');
        if (newEtag) {
          lastEtagRef.current = newEtag;
        } else {
          try {
            const resJson = await response.clone().json();
            if (resJson.etag) lastEtagRef.current = resJson.etag;
          } catch (e) {}
        }
        if (isManualClick) {
          showNotification('✓ Todos os dados foram salvos com sucesso no disco rígido do servidor!', 'success');
        }
      }
      // Always refresh database connectivity telemetry status after writing
      checkDbStatus();
    } catch (e) {
      console.warn('Backend save failed, relying on localStorage:', e);
      checkDbStatus();
    } finally {
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    // Initial check of database status on mount
    checkDbStatus();

    const loadData = async () => {
      let parsedVehicles: Vehicle[] = [];
      let parsedRentals: Rental[] = [];
      let parsedTransactions: Transaction[] = [];
      let parsedFuture: FutureExpense[] = [];
      let parsedUsers: AppUser[] = [];
      let parsedAccessLogs: AccessLog[] = [];
      let parsedLeads: InterestedLead[] = [];
      let hasChanges = false;

      try {
        // Load session
        const storedSession = localStorage.getItem('loca_current_user');
        if (storedSession) {
          try {
            setCurrentUser(JSON.parse(storedSession));
          } catch (e) {}
        }

        // 1. Try server filesystem backup first - 100% immune to browser context clears
        try {
          const response = await fetch('/api/load-data');
          if (response.ok) {
            const initialEtag = response.headers.get('ETag');
            if (initialEtag) {
              lastEtagRef.current = initialEtag;
            }
            const serverBackup = await response.json();
            if (serverBackup && serverBackup.vehicles && serverBackup.vehicles.length > 0) {
              parsedVehicles = serverBackup.vehicles || [];
              parsedRentals = serverBackup.rentals || [];
              parsedTransactions = serverBackup.transactions || [];
              parsedFuture = serverBackup.futureExpenses || [];
              parsedUsers = serverBackup.users || [];
              parsedAccessLogs = serverBackup.accessLogs || [];
              parsedLeads = serverBackup.interestedLeads || [];
              console.log("Hydrated successfully from server persistent disk backup!");
            }
          }
        } catch (e) {
          console.warn("Server backup load failed or unavailable:", e);
        }

        // 2. Fall back to standard local storage if server disk is empty
        if (parsedVehicles.length === 0) {
          const storedVehicles = localStorage.getItem('loca_vehicles');
          const storedRentals = localStorage.getItem('loca_rentals');
          const storedTransactions = localStorage.getItem('loca_transactions');
          const storedFuture = localStorage.getItem('loca_future_expenses');
          const storedUsers = localStorage.getItem('loca_users');
          const storedLogs = localStorage.getItem('loca_access_logs');
          const storedLeads = localStorage.getItem('loca_interested_leads');
          const safetyBackup = localStorage.getItem('loca_db_safety_backup');

          if (storedLeads) {
            try {
              parsedLeads = JSON.parse(storedLeads) || [];
            } catch (e) {
              parsedLeads = [];
            }
          }

          if (storedFuture) {
            try {
              parsedFuture = JSON.parse(storedFuture) || [];
            } catch (e) {
              parsedFuture = [];
            }
          }

          if (storedUsers) {
            try {
              parsedUsers = JSON.parse(storedUsers) || [];
            } catch (e) {
              parsedUsers = [];
            }
          }

          if (storedLogs) {
            try {
              parsedAccessLogs = JSON.parse(storedLogs) || [];
            } catch (e) {
              parsedAccessLogs = [];
            }
          }

          if (storedVehicles && storedRentals && storedTransactions) {
            try {
              parsedVehicles = JSON.parse(storedVehicles) || [];
              parsedRentals = JSON.parse(storedRentals) || [];
              parsedTransactions = JSON.parse(storedTransactions) || [];
            } catch (e) {}
          }

          // Safety backup check
          if ((parsedVehicles.length === 0 || parsedRentals.length === 0 || parsedTransactions.length === 0) && safetyBackup) {
            try {
              const parsedBackup = JSON.parse(safetyBackup);
              if (parsedBackup && parsedBackup.vehicles?.length > 0 && parsedBackup.rentals?.length > 0) {
                parsedVehicles = parsedBackup.vehicles || [];
                parsedRentals = parsedBackup.rentals || [];
                parsedTransactions = parsedBackup.transactions || [];
                parsedFuture = parsedBackup.futureExpenses || [];
                parsedUsers = parsedBackup.users || [];
                parsedAccessLogs = parsedBackup.accessLogs || [];
                parsedLeads = parsedBackup.interestedLeads || [];
              }
            } catch (e) {}
          }
        }

        // Always check for leads fallback if still empty
        if (parsedLeads.length === 0) {
          const storedLeads = localStorage.getItem('loca_interested_leads');
          if (storedLeads) {
            try {
              parsedLeads = JSON.parse(storedLeads) || [];
            } catch (e) {}
          }
        }

        // 3. Fall back to original INITIAL seeds if absolutely empty everywhere
        if (parsedVehicles.length === 0) {
          parsedVehicles = INITIAL_VEHICLES;
          parsedRentals = INITIAL_RENTALS;
          parsedTransactions = INITIAL_TRANSACTIONS;
          parsedFuture = [];
          showNotification('Aplicativo inicializado com os demonstrativos de fábrica!', 'info');
        }

        // Ensure we have users
        if (parsedUsers.length === 0) {
          parsedUsers = INITIAL_USERS;
        }

        // Record access log if session already active on browser load
        if (storedSession) {
          try {
            const userObj = JSON.parse(storedSession) as AppUser;
            if (userObj && userObj.email) {
              const now = new Date();
              const formatter = new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'medium',
                timeZone: 'America/Sao_Paulo'
              });
              const timestampStr = formatter.format(now);

              const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

              const ua = navigator.userAgent;
              let deviceRepresentation = 'Navegador Padrão';
              if (ua.includes('Windows')) deviceRepresentation = 'Windows OS (Computador)';
              else if (ua.includes('Macintosh')) deviceRepresentation = 'Apple macOS (Computador)';
              else if (ua.includes('Linux')) deviceRepresentation = 'Linux OS (Computador)';
              else if (ua.includes('Android')) deviceRepresentation = 'Android Mobile';
              else if (ua.includes('iPhone') || ua.includes('iPad')) deviceRepresentation = 'iOS Mobile';

              const newLog: AccessLog = {
                id: logId,
                userName: userObj.name,
                userEmail: userObj.email,
                userRole: userObj.email === 'leojoex@hotmail.com' ? 'Desenvolvedor' : userObj.role === 'admin' ? 'Administrador Pleno' : userObj.role === 'socio' ? 'Sócio' : 'Operador',
                timestamp: timestampStr,
                deviceInfo: `${deviceRepresentation} (Sessão Ativa)`
              };

              parsedAccessLogs = [newLog, ...parsedAccessLogs];
            }
          } catch (e) {}
        }

        // Auto-realize future installments if their due date is reached or passed
        const todayStr = getBrasiliaDateStr();
        const autoTransactions: Transaction[] = [];

        const processedFuture = (parsedFuture || []).map(expense => {
          if (!expense) return expense;
          let expenseChanged = false;
          const installments = expense.installments || [];
          const updatedInstallments = installments.map(inst => {
            if (inst && inst.status === 'pending' && inst.dueDate <= todayStr) {
              hasChanges = true;
              expenseChanged = true;
              
              const transactionId = 't_auto_realized_' + Math.random().toString(36).substr(2, 9);
              autoTransactions.push({
                id: transactionId,
                date: inst.dueDate,
                type: 'despesa',
                value: expense.value,
                category: expense.category,
                description: `${expense.category} - Parc. ${inst.installmentNumber}/${expense.installmentsCount} (Efetivada Automaticamente no Vencimento)`,
                vehicleId: expense.vehicleId
              });

              return {
                ...inst,
                status: 'realized' as const,
                realizedTransactionId: transactionId
              };
            }
            return inst;
          });

          if (expenseChanged) {
            return { ...expense, installments: updatedInstallments };
          }
          return expense;
        });

        if (hasChanges) {
          parsedFuture = processedFuture;
          parsedTransactions = [...parsedTransactions, ...autoTransactions];
          setTimeout(() => {
            showNotification(`Foram efetivadas automaticamente ${autoTransactions.length} parcela(s) vencida(s) no caixa principal.`, 'success');
          }, 1500);
        }

        // Proactive migration of legacy transaction records to avoid double counting and visual distortion:
        let migratedTransactions = [...parsedTransactions];
        
        // 1. Remove any legacy t_refund_ret_discharge_ transactions (Baixa de Custódia)
        migratedTransactions = migratedTransactions.filter(t => t && t.id && !t.id.startsWith('t_refund_ret_discharge_'));
        
        // 2. Pair up and correct any legacy caucao_devolvido (e.g., 2600.00) and receita (Retenção de Caução, e.g., 2400.00)
        for (let i = 0; i < migratedTransactions.length; i++) {
          const t1 = migratedTransactions[i];
          if (
            t1 &&
            t1.type === 'receita' && 
            t1.category && (t1.category === 'Retenção de Caução' || t1.category.includes('Retenção'))
          ) {
            // Find matching caucao_devolvido on the same date and same vehicle
            const t2Index = migratedTransactions.findIndex(t => 
              t &&
              t.type === 'caucao_devolvido' && 
              t.date === t1.date && 
              t.vehicleId === t1.vehicleId && 
              t.value >= t1.value &&
              t.value > 100 // only match non-trivial amounts
            );

            if (t2Index !== -1) {
              const t2 = migratedTransactions[t2Index];
              const originalVal = t2.value;
              const newVal = originalVal - t1.value; // e.g., 2600 - 2400 = 200

              if (newVal <= 0) {
                // If newVal is 0 or less, we delete it entirely (there was no actual refund)
                migratedTransactions.splice(t2Index, 1);
                // Decrement index if we spliced something before the current element
                if (t2Index < i) {
                  i--;
                }
              } else {
                // Otherwise, update the value to the real refund value (e.g. 200)
                migratedTransactions[t2Index] = {
                  ...t2,
                  value: newVal,
                  description: `Devolução de Caução (Restituição ao Motorista) - Restituído: ${newVal}, Retido: ${t1.value}`
                };
              }
            }
          }
        }

        parsedTransactions = migratedTransactions;

      } catch (err) {
        console.error("Critical error inside loadData, falling back to safe defaults:", err);
        if (parsedVehicles.length === 0) parsedVehicles = INITIAL_VEHICLES;
        if (parsedRentals.length === 0) parsedRentals = INITIAL_RENTALS;
        if (parsedTransactions.length === 0) parsedTransactions = INITIAL_TRANSACTIONS;
        if (parsedUsers.length === 0) parsedUsers = INITIAL_USERS;
      }

      // Sync local state
      setVehicles(parsedVehicles);
      setRentals(parsedRentals);
      setTransactions(parsedTransactions);
      setFutureExpenses(parsedFuture);
      setUsers(parsedUsers);
      setAccessLogs(parsedAccessLogs);
      setInterestedLeads(parsedLeads);

      // Write standard local storage keys to keep things fully synced
      localStorage.setItem('loca_vehicles', JSON.stringify(parsedVehicles));
      localStorage.setItem('loca_rentals', JSON.stringify(parsedRentals));
      localStorage.setItem('loca_transactions', JSON.stringify(parsedTransactions));
      localStorage.setItem('loca_future_expenses', JSON.stringify(parsedFuture));
      localStorage.setItem('loca_users', JSON.stringify(parsedUsers));
      localStorage.setItem('loca_access_logs', JSON.stringify(parsedAccessLogs));
      localStorage.setItem('loca_interested_leads', JSON.stringify(parsedLeads));

      const backupObj = { 
        vehicles: parsedVehicles, 
        rentals: parsedRentals, 
        transactions: parsedTransactions, 
        futureExpenses: parsedFuture, 
        users: parsedUsers, 
        accessLogs: parsedAccessLogs,
        interestedLeads: parsedLeads
      };
      localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));

      // Save changes to backend if auto-realized installments took place
      if (hasChanges) {
        console.log("[Database] Automatically realized installments on load. Saving to server database to avoid desync...");
        persistToBackend(parsedVehicles, parsedRentals, parsedTransactions, parsedFuture, parsedUsers, parsedAccessLogs, parsedLeads);
      }
    };

    loadData();
  }, []);

  // Sync state mutations helpers with safety auto-saving duplicates
  const triggerAutoBackup = (
    vList: Vehicle[],
    rList: Rental[],
    tList: Transaction[],
    fList: FutureExpense[],
    uList?: AppUser[]
  ) => {
    const activeUsers = uList || users;
    const backupObj = { vehicles: vList, rentals: rList, transactions: tList, futureExpenses: fList, users: activeUsers };
    localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));
    persistToBackend(vList, rList, tList, fList, activeUsers);
  };

  const syncAndSetAll = (
    updatedVehicles?: Vehicle[],
    updatedRentals?: Rental[],
    updatedTransactions?: Transaction[],
    updatedFutureExpenses?: FutureExpense[]
  ) => {
    const nextVehicles = updatedVehicles !== undefined ? updatedVehicles : vehicles;
    const nextRentals = updatedRentals !== undefined ? updatedRentals : rentals;
    const nextTransactions = updatedTransactions !== undefined ? updatedTransactions : transactions;
    const nextFutureExpenses = updatedFutureExpenses !== undefined ? updatedFutureExpenses : futureExpenses;

    if (updatedVehicles !== undefined) {
      setVehicles(nextVehicles);
      localStorage.setItem('loca_vehicles', JSON.stringify(nextVehicles));
    }
    if (updatedRentals !== undefined) {
      setRentals(nextRentals);
      localStorage.setItem('loca_rentals', JSON.stringify(nextRentals));
    }
    if (updatedTransactions !== undefined) {
      setTransactions(nextTransactions);
      localStorage.setItem('loca_transactions', JSON.stringify(nextTransactions));
    }
    if (updatedFutureExpenses !== undefined) {
      setFutureExpenses(nextFutureExpenses);
      localStorage.setItem('loca_future_expenses', JSON.stringify(nextFutureExpenses));
    }

    const backupObj = { 
      vehicles: nextVehicles, 
      rentals: nextRentals, 
      transactions: nextTransactions, 
      futureExpenses: nextFutureExpenses, 
      users 
    };
    localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));
    persistToBackend(nextVehicles, nextRentals, nextTransactions, nextFutureExpenses, users);
  };

  const syncAndSetVehicles = (updated: Vehicle[]) => {
    setVehicles(updated);
    localStorage.setItem('loca_vehicles', JSON.stringify(updated));
    triggerAutoBackup(updated, rentals, transactions, futureExpenses);
  };

  const syncAndSetRentals = (updated: Rental[]) => {
    setRentals(updated);
    localStorage.setItem('loca_rentals', JSON.stringify(updated));
    triggerAutoBackup(vehicles, updated, transactions, futureExpenses);
  };

  const syncAndSetTransactions = (updated: Transaction[]) => {
    setTransactions(updated);
    localStorage.setItem('loca_transactions', JSON.stringify(updated));
    triggerAutoBackup(vehicles, rentals, updated, futureExpenses);
  };

  const syncAndSetFutureExpenses = (updated: FutureExpense[]) => {
    setFutureExpenses(updated);
    localStorage.setItem('loca_future_expenses', JSON.stringify(updated));
    triggerAutoBackup(vehicles, rentals, transactions, updated);
  };

  const handleAddInterestedLead = (leadData: Omit<InterestedLead, 'id' | 'createdAt'>) => {
    const newLead: InterestedLead = {
      ...leadData,
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString()
    };
    const updated = [...interestedLeads, newLead];
    setInterestedLeads(updated);
    localStorage.setItem('loca_interested_leads', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, updated);
    showNotification('Interessado cadastrado com sucesso!', 'success');
  };

  const handleDeleteInterestedLead = (id: string) => {
    const updated = interestedLeads.filter(l => l.id !== id);
    setInterestedLeads(updated);
    localStorage.setItem('loca_interested_leads', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, updated);
    showNotification('Interessado removido com sucesso!', 'success');
  };

  const handleToggleLeadDocApproved = (id: string) => {
    const updated = interestedLeads.map(l => {
      if (l.id === id) {
        return { ...l, docApproved: !l.docApproved };
      }
      return l;
    });
    setInterestedLeads(updated);
    localStorage.setItem('loca_interested_leads', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, updated);
    const lead = updated.find(l => l.id === id);
    if (lead) {
      if (lead.docApproved) {
        showNotification(`Documentação de ${lead.name} aprovada!`, 'success');
      } else {
        showNotification(`Documentação de ${lead.name} desmarcada.`, 'info');
      }
    }
  };

  const handleIncrementLeadContactCount = (id: string) => {
    const updated = interestedLeads.map(l => {
      if (l.id === id) {
        return { ...l, contactCount: (l.contactCount || 0) + 1 };
      }
      return l;
    });
    setInterestedLeads(updated);
    localStorage.setItem('loca_interested_leads', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, updated);
    const lead = updated.find(l => l.id === id);
    if (lead) {
      showNotification(`Contato com ${lead.name} registrado! (Total: ${lead.contactCount || 0})`, 'success');
    }
  };

  const handleDecrementLeadContactCount = (id: string) => {
    const updated = interestedLeads.map(l => {
      if (l.id === id) {
        const currentCount = l.contactCount || 0;
        return { ...l, contactCount: currentCount > 0 ? currentCount - 1 : 0 };
      }
      return l;
    });
    setInterestedLeads(updated);
    localStorage.setItem('loca_interested_leads', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, updated);
    const lead = updated.find(l => l.id === id);
    if (lead) {
      showNotification(`Contato com ${lead.name} desfeito! (Total: ${lead.contactCount || 0})`, 'info');
    }
  };

  const syncAndSetUsers = (updated: AppUser[]) => {
    setUsers(updated);
    localStorage.setItem('loca_users', JSON.stringify(updated));
    triggerAutoBackup(vehicles, rentals, transactions, futureExpenses, updated);
  };

  const handleAddUser = (newUser: Omit<AppUser, 'id'>): boolean => {
    const emailExists = users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase());
    if (emailExists) return false;

    const createdUser: AppUser = {
      ...newUser,
      id: 'u_' + Math.random().toString(36).substr(2, 9)
    };

    const updatedUsers = [...users, createdUser];
    syncAndSetUsers(updatedUsers);
    return true;
  };

  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter(u => u.id !== userId);
    syncAndSetUsers(updatedUsers);
  };

  const handleClearAccessLogs = (idsToDelete?: string[]) => {
    let updated: AccessLog[];
    if (idsToDelete && idsToDelete.length > 0) {
      updated = accessLogs.filter(log => !idsToDelete.includes(log.id));
      showNotification(`${idsToDelete.length} log(s) de auditoria apagado(s) com sucesso.`, 'success');
    } else {
      updated = [];
      showNotification('Todos os logs de auditoria foram apagados com sucesso.', 'success');
    }
    setAccessLogs(updated);
    localStorage.setItem('loca_access_logs', JSON.stringify(updated));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, updated);
  };

  // Manual trigger of database saves with clear feedback Toast
  const handleManualSave = () => {
    const backupObj = { vehicles, rentals, transactions, futureExpenses, users };
    localStorage.setItem('loca_vehicles', JSON.stringify(vehicles));
    localStorage.setItem('loca_rentals', JSON.stringify(rentals));
    localStorage.setItem('loca_transactions', JSON.stringify(transactions));
    localStorage.setItem('loca_future_expenses', JSON.stringify(futureExpenses));
    localStorage.setItem('loca_users', JSON.stringify(users));
    localStorage.setItem('loca_db_safety_backup', JSON.stringify(backupObj));
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, accessLogs, interestedLeads, true);
  };



  // Export JSON physical backup file
  const handleExportBackup = () => {
    const backupObj = { vehicles, rentals, transactions, futureExpenses };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `locacash_backup_${getBrasiliaDateStr()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Backup exportado e baixado no seu computador!', 'success');
    setShowBackupMenu(false);
  };

  // Plain JSON copy to clipboard
  const handleCopyBackupText = () => {
    const backupObj = { vehicles, rentals, transactions, futureExpenses };
    navigator.clipboard.writeText(JSON.stringify(backupObj));
    showNotification('Cópia do banco de dados salva na área de transferência!', 'success');
    setShowBackupMenu(false);
  };

  // Submit and restore plain text backup string
  const handleImportTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;

    try {
      const parsed = JSON.parse(importText);
      if (parsed.vehicles || parsed.rentals || parsed.transactions) {
        const vList = parsed.vehicles || [];
        const rList = parsed.rentals || [];
        const tList = parsed.transactions || [];
        const fList = parsed.futureExpenses || [];

        setVehicles(vList);
        setRentals(rList);
        setTransactions(tList);
        setFutureExpenses(fList);

        localStorage.setItem('loca_vehicles', JSON.stringify(vList));
        localStorage.setItem('loca_rentals', JSON.stringify(rList));
        localStorage.setItem('loca_transactions', JSON.stringify(tList));
        localStorage.setItem('loca_future_expenses', JSON.stringify(fList));
        localStorage.setItem('loca_db_safety_backup', JSON.stringify(parsed));

        showNotification('✓ Banco de dados importado e restaurado com sucesso!', 'success');
        setShowImportDialog(false);
        setImportText('');
      } else {
        showNotification('Estrutura de dados inválida.', 'error');
      }
    } catch (err) {
      showNotification('Erro ao decodificar texto de backup.', 'error');
    }
  };

  // Drop/file selector database restore file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.vehicles || parsed.rentals || parsed.transactions) {
          const vList = parsed.vehicles || [];
          const rList = parsed.rentals || [];
          const tList = parsed.transactions || [];
          const fList = parsed.futureExpenses || [];

          setVehicles(vList);
          setRentals(rList);
          setTransactions(tList);
          setFutureExpenses(fList);

          localStorage.setItem('loca_vehicles', JSON.stringify(vList));
          localStorage.setItem('loca_rentals', JSON.stringify(rList));
          localStorage.setItem('loca_transactions', JSON.stringify(tList));
          localStorage.setItem('loca_future_expenses', JSON.stringify(fList));
          localStorage.setItem('loca_db_safety_backup', JSON.stringify(parsed));

          showNotification('✓ Backup JSON importado e restaurado com sucesso!', 'success');
          setShowBackupMenu(false);
        } else {
          showNotification('O arquivo selecionado não contém dados de backup válidos.', 'error');
        }
      } catch (err) {
        showNotification('Erro ao interpretar o arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  // FINANCIAL FORMULA CALCULATORS (only effective non-future transactions)
  const financials = React.useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    const effectiveTransactions = transactions.filter(t => t.date <= todayStr);

    const totalRevenues = effectiveTransactions
      .filter((t) => t.type === 'receita')
      .reduce((sum, t) => sum + t.value, 0);

    const totalExpenses = effectiveTransactions
      .filter((t) => t.type === 'despesa')
      .reduce((sum, t) => sum + t.value, 0);

    // Caução Retido Activo = Received - Returned - Retained
    const caucoesReceived = effectiveTransactions
      .filter((t) => t.type === 'caucao_recebido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesReturned = effectiveTransactions
      .filter((t) => t.type === 'caucao_devolvido')
      .reduce((sum, t) => sum + t.value, 0);

    const caucoesRetained = effectiveTransactions
      .filter((t) => t.type === 'receita' && (t.category === 'Retenção de Caução' || t.category.includes('Retenção')))
      .reduce((sum, t) => sum + t.value, 0);

    const netCaucaoInCustody = Math.max(0, caucoesReceived - caucoesReturned - caucoesRetained);

    // Grand total: Dinheiro em Caixa = Somatório Receitas + Cauções em custódia - Despesas
    const currentCash = totalRevenues + netCaucaoInCustody - totalExpenses;

    return {
      totalRevenues,
      totalExpenses,
      netCaucaoInCustody,
      currentCash,
      caucoesReceived,
      caucoesReturned
    };
  }, [transactions]);

  // CORE MUTATIVE EVENTS handlers
  // 1. Add Vehicle
  const handleAddVehicle = (newVeh: Omit<Vehicle, 'id'>) => {
    const created: Vehicle = {
      ...newVeh,
      id: 'v_' + Math.random().toString(36).substr(2, 9),
      mileageHistory: newVeh.mileage !== undefined && newVeh.mileage !== null ? [
        {
          id: 'ml_' + Math.random().toString(36).substr(2, 9),
          mileage: Number(newVeh.mileage),
          date: newVeh.mileageDate || getBrasiliaDateStr(),
          source: 'Cadastro Inicial',
          notes: 'Quilometragem informada no cadastro inicial do veículo.'
        }
      ] : []
    };
    const updated = [...vehicles, created];
    syncAndSetVehicles(updated);
    showNotification(`Veículo ${created.brandModel} (${created.plate}) cadastrado com sucesso!`, 'success');
  };

  // 2. Change Vehicle status
  const handleUpdateVehicleStatus = (id: string, status: Vehicle['status']) => {
    const updated = vehicles.map(v => v.id === id ? { ...v, status } : v);
    syncAndSetVehicles(updated);
    showNotification('Status do veículo atualizado!', 'success');
  };

  // 3. Delete Vehicle
  const handleDeleteVehicle = (id: string, purgeHistory: boolean = false) => {
    if (purgeHistory) {
      // Complete purge: delete vehicle, related rentals, and related transactions
      const updatedVehicles = vehicles.filter(v => v.id !== id);
      const updatedRentals = rentals.filter(r => r.vehicleId !== id);
      const updatedTransactions = transactions.filter(t => t.vehicleId !== id);
      
      syncAndSetAll(updatedVehicles, updatedRentals, updatedTransactions);
      
      showNotification('Veículo e todo o seu histórico financeiro foram excluídos permanentemente!', 'success');
    } else {
      // Simple deletion (preserve history): soft delete the vehicle
      const updatedVehicles = vehicles.map(v => v.id === id ? { ...v, isDeleted: true } : v);
      // Soft-delete related rentals as well so they are also soft-deleted
      const updatedRentals = rentals.map(r => r.vehicleId === id ? { ...r, isDeleted: true } : r);
      
      // Also release vehicle state to available if the status was active (just in case they need safety)
      const finalizedVehicles = updatedVehicles.map(v => v.id === id ? { ...v, status: 'available' as const } : v);
      
      syncAndSetAll(finalizedVehicles, updatedRentals);
      
      showNotification('Veículo excluído. Registros financeiros preservados com sucesso!', 'success');
    }
  };

  // Delete Rental Contract
  const handleDeleteRental = (id: string, purgeHistory: boolean = false) => {
    const targetRental = rentals.find(r => r.id === id);
    if (!targetRental) return;

    if (purgeHistory) {
      // Complete purge: delete rental and all transactions associated with this rental
      const updatedRentals = rentals.filter(r => r.id !== id);
      
      const updatedTransactions = transactions.filter(t => {
        const isRelated = t.vehicleId === targetRental.vehicleId && (
          t.description.toLowerCase().includes(targetRental.tenantName.toLowerCase()) ||
          t.category.toLowerCase().includes('aluguel') ||
          t.category.toLowerCase().includes('caução')
        );
        return !isRelated;
      });

      // Set vehicle status to available if it was rented by this rental
      const updatedVehicles = vehicles.map(v => 
        (v.id === targetRental.vehicleId) ? { ...v, status: 'available' as const } : v
      );

      syncAndSetAll(updatedVehicles, updatedRentals, updatedTransactions);

      showNotification('Contrato e todo o seu histórico financeiro foram excluídos permanentemente!', 'success');
    } else {
      // Simple deletion (preserve history): soft delete the rental
      const updatedRentals = rentals.map(r => r.id === id ? { ...r, isDeleted: true } : r);
      
      // Set vehicle status to available
      const updatedVehicles = vehicles.map(v => 
        (v.id === targetRental.vehicleId) ? { ...v, status: 'available' as const } : v
      );

      syncAndSetAll(updatedVehicles, updatedRentals);

      showNotification('Contrato excluído. Registros financeiros preservados com sucesso!', 'success');
    }
  };

  // 4. Start Rental Contract
  const handleStartRental = (
    newRental: Omit<Rental, 'id' | 'status'>
  ) => {
    const rentalId = 'r_' + Math.random().toString(36).substr(2, 9);
    const created: Rental = {
      ...newRental,
      id: rentalId,
      status: 'active'
    };

    const updatedRentals = [...rentals, created];

    // Automatically set the vehicle status to RENTED
    const updatedVehicles = vehicles.map(v =>
      v.id === newRental.vehicleId ? { ...v, status: 'rented' as const } : v
    );

    // Auto-generate starting transactions for better user experience
    const newTransactions = [...transactions];
    
    // 1. If deposit value is supplied, log it as caucao_recebido
    if (newRental.depositValue > 0) {
      newTransactions.push({
        id: 't_start_deposit_' + Math.random().toString(36).substr(2, 9),
        date: newRental.startDate,
        type: 'caucao_recebido',
        value: newRental.depositValue,
        vehicleId: newRental.vehicleId,
        category: 'Depósito de Garantia',
        description: `Depósito de garantia (Caução) - Locatário: ${newRental.tenantName}`
      });
    }

    // 2. If pay first week now is checked, log it as revenue (Aluguel Semanal)
    if (newRental.semanaAdiantada) {
      newTransactions.push({
        id: 't_start_rent_' + Math.random().toString(36).substr(2, 9),
        date: newRental.startDate,
        type: 'receita',
        value: newRental.weeklyRate,
        vehicleId: newRental.vehicleId,
        category: 'Aluguel Semanal',
        description: `Aluguel Semanal (Semana Adiantada) - Locatário: ${newRental.tenantName}`
      });
    }

    syncAndSetAll(updatedVehicles, updatedRentals, newTransactions);

    showNotification(`Contrato iniciado com sucesso para ${created.tenantName}!`, 'success');
  };

  // 5. Terminate / Finish Rental Contract
  const handleTerminateRental = (rentalId: string, refundDeposit: boolean, refundValue: number) => {
    const targetRental = rentals.find(r => r.id === rentalId);
    if (!targetRental) return;

    // Set rental to completed
    const updatedRentals = rentals.map(r => r.id === rentalId ? { ...r, status: 'completed' as const } : r);

    // Set corresponding vehicle back to AVAILABLE
    const updatedVehicles = vehicles.map(v =>
      v.id === targetRental.vehicleId ? { ...v, status: 'available' as const } : v
    );

    // Handle refund and retention transactions
    const newTransactions = [...transactions];

    const actualRefundValue = refundDeposit ? refundValue : 0;
    const retainedValue = Math.max(0, targetRental.depositValue - actualRefundValue);

    // 1. If there is an actual refund, log it as caucao_devolvido with actual refund value
    if (actualRefundValue > 0) {
      newTransactions.push({
        id: 't_refund_act_' + Math.random().toString(36).substr(2, 9),
        date: getBrasiliaDateStr(),
        type: 'caucao_devolvido',
        value: actualRefundValue,
        vehicleId: targetRental.vehicleId,
        category: 'Devolução de Garantia',
        description: `Devolução de Caução (Restituição ao Motorista) - Locatário: ${targetRental.tenantName}`
      });
    }

    // 2. If there is a retained portion, log it ONLY as standard credit/receita (no duplicate discharge transaction)
    if (retainedValue > 0) {
      newTransactions.push({
        id: 't_refund_ret_credit_' + Math.random().toString(36).substr(2, 9),
        date: getBrasiliaDateStr(),
        type: 'receita',
        value: retainedValue,
        vehicleId: targetRental.vehicleId,
        category: 'Retenção de Caução',
        description: `Retenção de Caução (Crédito de Receita) - Locatário: ${targetRental.tenantName}`
      });
    }

    syncAndSetAll(updatedVehicles, updatedRentals, newTransactions);

    showNotification(`Locação de ${targetRental.tenantName} finalizada com sucesso!`, 'success');
  };

  // 6. Manual additions to core transaction ledger
  const handleAddTransaction = (newTrans: Omit<Transaction, 'id'>) => {
    const created: Transaction = {
      ...newTrans,
      id: 't_man_' + Math.random().toString(36).substr(2, 9)
    };
    const updated = [...transactions, created];
    syncAndSetTransactions(updated);
    showNotification('Lançamento registrado com sucesso!', 'success');
  };

  // 6b. Update transactions
  const handleUpdateTransaction = (id: string, updatedFields: Partial<Transaction>) => {
    const updated = transactions.map(t => t.id === id ? { ...t, ...updatedFields } : t);
    syncAndSetTransactions(updated);
    showNotification('Lançamento financeiro atualizado com sucesso!', 'success');
  };

  // 6c. Update vehicle information
  const handleUpdateVehicle = (id: string, updatedFields: Partial<Vehicle>) => {
    const updated = vehicles.map(v => {
      if (v.id === id) {
        let history = v.mileageHistory ? [...v.mileageHistory] : [];
        const todayStr = getBrasiliaDateStr();

        // Check if there was an initial mileage that we need to populate retroactively
        if (history.length === 0 && v.mileage !== undefined && v.mileage !== null) {
          history.push({
            id: 'ml_init_' + Math.random().toString(36).substr(2, 9),
            mileage: Number(v.mileage),
            date: v.mileageDate || todayStr,
            source: 'Registro Retroativo',
            notes: 'Quilometragem inicial registrada.'
          });
        }

        // 1. Manual/Modal mileage update
        if (updatedFields.mileage !== undefined && updatedFields.mileage !== null && updatedFields.mileage !== v.mileage) {
          history.push({
            id: 'ml_' + Math.random().toString(36).substr(2, 9),
            mileage: Number(updatedFields.mileage),
            date: updatedFields.mileageDate || todayStr,
            source: 'Ajuste de Quilometragem',
            notes: 'Atualização/Aferição realizada no painel do veículo.'
          });
        }

        // 2. Monthly mileage updates
        if (updatedFields.monthlyMileages) {
          const oldMonthly = v.monthlyMileages || {};
          const newMonthly = updatedFields.monthlyMileages;
          Object.keys(newMonthly).forEach(month => {
            const newVal = newMonthly[month];
            const oldVal = oldMonthly[month];
            if (newVal !== undefined && newVal !== oldVal) {
              history.push({
                id: 'ml_m_' + Math.random().toString(36).substr(2, 9),
                mileage: Number(newVal),
                date: `${month}-01`, // Use 1st day of the updated month
                source: `Fechamento ${month}`,
                notes: `Aferição mensal fechamento do mês de ${month}.`
              });
            }
          });
        }

        // Sort history by date descending
        history.sort((a, b) => b.date.localeCompare(a.date));

        return {
          ...v,
          ...updatedFields,
          mileageHistory: history
        };
      }
      return v;
    });
    syncAndSetVehicles(updated);
    showNotification('Veículo atualizado com sucesso!', 'success');
  };

  // 6d. Update rental contract
  const handleUpdateRental = (id: string, updatedFields: Partial<Rental>) => {
    const updated = rentals.map(r => r.id === id ? { ...r, ...updatedFields } : r);
    syncAndSetRentals(updated);
    showNotification('Contrato de locação atualizado com sucesso!', 'success');
  };

  // 7. Delete transaction entries
  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    syncAndSetTransactions(updated);
    showNotification('Lançamento removido do histórico.', 'success');
  };

  // 8. Future Expenses Management
  const handleAddFutureExpense = (newExp: {
    description?: string;
    category: string;
    value: number;
    installmentsCount: number;
    startDate: string;
    dueDay: number;
    vehicleId?: string;
  }) => {
    const expenseId = 'fe_' + Math.random().toString(36).substr(2, 9);
    
    // Generate individual installments monthly based on first date and due recurrent day
    const installments: FutureExpenseInstallment[] = [];
    const start = new Date(newExp.startDate + 'T00:00:00');
    
    for (let i = 1; i <= newExp.installmentsCount; i++) {
       const dateCopy = new Date(start);
       dateCopy.setMonth(start.getMonth() + (i - 1));
       const theoreticalDay = newExp.dueDay;
       dateCopy.setDate(1); // avoid rollover
       const maxDays = new Date(dateCopy.getFullYear(), dateCopy.getMonth() + 1, 0).getDate();
       dateCopy.setDate(Math.min(theoreticalDay, maxDays));
       
       const dueDateStr = toLocalDateStr(dateCopy);
       
       installments.push({
         id: 'fei_' + Math.random().toString(36).substr(2, 9),
         installmentNumber: i,
         dueDate: dueDateStr,
         status: 'pending'
       });
    }

    const created: FutureExpense = {
      id: expenseId,
      description: newExp.description || '',
      category: newExp.category,
      value: newExp.value,
      installmentsCount: newExp.installmentsCount,
      startDate: newExp.startDate,
      dueDay: newExp.dueDay,
      vehicleId: newExp.vehicleId || undefined,
      installments
    };

    const updated = [...futureExpenses, created];
    syncAndSetFutureExpenses(updated);
    showNotification(`Despesa parcelada "${created.category}" de ${created.installmentsCount} parcelas criada com sucesso!`, 'success');
  };

  const handleRealizeFutureInstallment = (expenseId: string, installmentId: string, customDate: string) => {
    const expense = futureExpenses.find(fe => fe.id === expenseId);
    if (!expense) return;

    const inst = expense.installments.find(item => item.id === installmentId);
    if (!inst || inst.status === 'realized') return;

    const transactionId = 't_realized_' + Math.random().toString(36).substr(2, 9);
    const newTrans: Transaction = {
      id: transactionId,
      date: customDate || inst.dueDate,
      type: 'despesa',
      value: expense.value,
      category: expense.category,
      description: `${expense.category} - Parc. ${inst.installmentNumber}/${expense.installmentsCount}${expense.description ? ` (${expense.description})` : ''}`,
      vehicleId: expense.vehicleId
    };

    const updatedInstallments = expense.installments.map(item =>
      item.id === installmentId ? { ...item, status: 'realized' as const, realizedTransactionId: transactionId } : item
    );

    const updatedExpenses = futureExpenses.map(fe =>
      fe.id === expenseId ? { ...fe, installments: updatedInstallments } : fe
    );

    syncAndSetAll(undefined, undefined, [...transactions, newTrans], updatedExpenses);
    showNotification(`Parcela ${inst.installmentNumber}/${expense.installmentsCount} de despesa efetivada para o balanço.`, 'success');
  };

  const handleDeleteFutureExpense = (expenseId: string) => {
    const updated = futureExpenses.filter(fe => fe.id !== expenseId);
    syncAndSetFutureExpenses(updated);
    showNotification('Despesa parcelada excluída com sucesso.', 'success');
  };

  const handleUpdateFutureInstallmentDate = (expenseId: string, installmentId: string, newDate: string) => {
    const updated = futureExpenses.map(fe => {
      if (fe.id !== expenseId) return fe;
      const updatedInstallments = fe.installments.map(inst =>
        inst.id === installmentId ? { ...inst, dueDate: newDate } : inst
      );
      return { ...fe, installments: updatedInstallments };
    });
    syncAndSetFutureExpenses(updated);
    showNotification('Vencimento estimado atualizado!', 'success');
  };

  // QUICK ACTIONS TRIGGER
  // Quick weekly rent log
  const handleQuickRentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRentPaymentContractId || !quickRentPaymentValue) return;

    const rental = rentals.find(r => r.id === quickRentPaymentContractId);
    if (!rental) return;

    const newPayment: Transaction = {
      id: 't_quick_rent_' + Math.random().toString(36).substr(2, 9),
      date: getBrasiliaDateStr(),
      type: 'receita',
      value: Number(quickRentPaymentValue),
      vehicleId: rental.vehicleId,
      category: 'Aluguel Semanal',
      description: `Pagamento recorrente de Aluguel Semanal - Motorista: ${rental.tenantName}`
    };

    syncAndSetTransactions([...transactions, newPayment]);
    setQuickRentPaymentContractId('');
    setQuickRentPaymentValue('');
    showNotification(`Pagamento de aluguel para ${rental.tenantName} registrado!`, 'success');
  };

  // Quick maintenance log
  const handleQuickMaintenanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMaintenanceVehicleId || !quickMaintenanceCost || !quickMaintenanceDesc) return;

    const vehicle = vehicles.find(v => v.id === quickMaintenanceVehicleId);
    if (!vehicle) return;

    const newMaintenance: Transaction = {
      id: 't_quick_maint_' + Math.random().toString(36).substr(2, 9),
      date: getBrasiliaDateStr(),
      type: 'despesa',
      value: Number(quickMaintenanceCost),
      vehicleId: quickMaintenanceVehicleId,
      category: 'Manutenção',
      description: `${quickMaintenanceDesc} (Placa: ${vehicle.plate})`
    };

    const nextTransactions = [...transactions, newMaintenance];
    let nextVehicles: Vehicle[] | undefined = undefined;

    // Optionally set status to maintenance if it was available
    if (vehicle.status === 'available') {
      nextVehicles = vehicles.map(v =>
        v.id === quickMaintenanceVehicleId ? { ...v, status: 'maintenance' as const } : v
      );
    }

    syncAndSetAll(nextVehicles, undefined, nextTransactions);

    setQuickMaintenanceVehicleId('');
    setQuickMaintenanceCost('');
    setQuickMaintenanceDesc('');
    showNotification(`Gasto de manutenção estruturado para placa: ${vehicle.plate}!`, 'success');
  };

  // Hard Reset Application Storage to Seeding Values
  const handleHardReset = () => {
    setShowResetConfirm(true);
  };

  const confirmHardReset = () => {
    localStorage.removeItem('loca_vehicles');
    localStorage.removeItem('loca_rentals');
    localStorage.removeItem('loca_transactions');
    localStorage.removeItem('loca_future_expenses');

    setVehicles(INITIAL_VEHICLES);
    setRentals(INITIAL_RENTALS);
    setTransactions(INITIAL_TRANSACTIONS);
    setFutureExpenses([]);
    showNotification('Aplicativo redefinido para os dados iniciais.', 'info');
    setShowResetConfirm(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleLogin = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem('loca_current_user', JSON.stringify(user));

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Sao_Paulo'
    });
    const timestampStr = formatter.format(now);

    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    const ua = navigator.userAgent;
    let deviceRepresentation = 'Navegador Padrão';
    if (ua.includes('Windows')) deviceRepresentation = 'Windows OS (Computador)';
    else if (ua.includes('Macintosh')) deviceRepresentation = 'Apple macOS (Computador)';
    else if (ua.includes('Linux')) deviceRepresentation = 'Linux OS (Computador)';
    else if (ua.includes('Android')) deviceRepresentation = 'Android Mobile';
    else if (ua.includes('iPhone') || ua.includes('iPad')) deviceRepresentation = 'iOS Mobile';

    const newLog: AccessLog = {
      id: logId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.email === 'leojoex@hotmail.com' ? 'Desenvolvedor' : user.role === 'admin' ? 'Administrador Pleno' : user.role === 'socio' ? 'Sócio' : 'Operador',
      timestamp: timestampStr,
      deviceInfo: deviceRepresentation
    };

    const updatedLogs = [newLog, ...accessLogs];
    setAccessLogs(updatedLogs);
    persistToBackend(vehicles, rentals, transactions, futureExpenses, users, updatedLogs);

    showNotification(`✓ Bem-vindo de volta, ${user.name}! Sessão administrativa estabelecida.`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('loca_current_user');
    setActiveTab('dashboard');
    showNotification('Sessão administrativa encerrada com sucesso.', 'info');
  };

  // Most recent transactions lists for the quick overview grid (up to 10 entries)
  const recentTransactions = React.useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    return transactions
      .filter((t) => t.date <= todayStr)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [transactions]);

  // Future only transactions for the "box chamada despesas futuras"
  const futureTransactions = React.useMemo(() => {
    const todayStr = getBrasiliaDateStr();
    return transactions
      .filter((t) => t.date > todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  if (!currentUser) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} users={users} />
        {toast && (
          <div className="fixed top-4 right-4 z-50 animate-bounce">
            <div className={`p-4 rounded-xl shadow-premium border flex items-center gap-3 text-xs font-semibold ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' :
              toast.type === 'info' ? 'bg-indigo-600 text-white border-indigo-700' :
              'bg-rose-500 text-white border-rose-600'
            }`}>
              <CheckCircle2 className="h-4.5 w-4.5" />
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
                &times;
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans overflow-x-hidden w-full">
      {/* Elegant mobile pull-to-refresh indicators with clean micro-interaction animations */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          style={{ 
            transform: `translateY(${pullDistance - 50}px)`, 
            opacity: Math.min(pullDistance / 35, 1) 
          }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-150 pointer-events-none"
        >
          <div className="bg-slate-900 border border-slate-800 text-white shadow-xl rounded-full px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold font-sans">
            {isRefreshing ? (
              refreshSuccess ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="font-bold">✓ Sincronizado</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <RefreshCcw className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Sincronizando...</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5">
                <ArrowDown className={`h-4 w-4 text-indigo-400 transition-transform duration-200 ${pullDistance >= 65 ? 'rotate-180' : ''}`} />
                <span>{pullDistance >= 65 ? 'Solte para atualizar' : 'Arraste para atualizar'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Alert Banner Notifications / Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-bounce">
          <div className={`p-4 rounded-xl shadow-premium border flex items-center gap-3 text-xs font-semibold ${
            toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' :
            toast.type === 'info' ? 'bg-indigo-600 text-white border-indigo-700' :
            'bg-rose-500 text-white border-rose-600'
          }`}>
            <CheckCircle2 className="h-4.5 w-4.5" />
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Administrative Navigation Header */}
      <header className="bg-brand-500 border-b border-brand-600 shadow-premium sticky top-0 z-40">
        <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-6">
          {/* DESKTOP HEADER */}
          <div className="hidden lg:flex justify-between items-center h-16">
            {/* Logo Brand Segment */}
            <div className="shrink-0 flex items-center pr-3 border-r border-brand-600/60 mr-1.5">
              <EletroflowLogo variant="compact" iconSize={32} />
            </div>

            {/* Nav Menu Tab links - Equal distribution and perfect center alignment */}
            <nav className="flex-1 flex items-center justify-center gap-1 xl:gap-2 px-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                    : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Geral</span>
              </button>
              <button
                onClick={() => setActiveTab('financials')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                  activeTab === 'financials'
                    ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                    : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <Coins className="h-4 w-4 shrink-0" />
                <span>Financeiro</span>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                  activeTab === 'transactions'
                    ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                    : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                <span>Lançamentos</span>
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                  activeTab === 'vehicles'
                    ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                    : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <CarFront className="h-4 w-4 shrink-0 animate-pulse" />
                <span>Frota</span>
              </button>
              <button
                onClick={() => setActiveTab('rentals')}
                className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                  activeTab === 'rentals'
                    ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                    : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <Key className="h-4 w-4 shrink-0" />
                <span>Contratos</span>
              </button>
              {(currentUser?.role === 'admin' || currentUser?.role === 'socio') && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-lg lg:text-[11px] xl:text-xs font-bold transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 ${
                    activeTab === 'users'
                      ? 'bg-emerald-500 text-white shadow-inner font-semibold'
                      : 'text-brand-100 hover:bg-brand-600 hover:text-white'
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Usuários</span>
                </button>
              )}
            </nav>
            
            {/* Database controls, backup drop and calendar indication */}
            <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
              
              {/* PROMINENT USER BADGE IN THE UPPER RIGHT HAND SIDE */}
              <div className="bg-brand-950/40 border border-white text-white px-3.5 rounded-lg select-none shadow-inner flex items-center gap-2.5 shrink-0 min-w-[140px] max-w-[260px] xl:max-w-[360px] h-[34px] cursor-default">
                <div className="h-5 w-5 rounded bg-brand-800 text-brand-200 border border-brand-700/50 flex items-center justify-center font-black text-[10px] xl:text-[11px] uppercase font-mono shrink-0">
                  {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="flex flex-col text-left truncate justify-center min-w-0 gap-0.5">
                  <div className="flex items-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[6.5px] xl:text-[7.5px] font-black uppercase tracking-wider leading-none select-none border-b-2 bg-gradient-to-b from-emerald-400 to-emerald-500 text-emerald-950 border-emerald-600 shadow-[0_1.5px_0_rgba(16,185,129,0.3)]">
                      {currentUser?.email === 'leojoex@hotmail.com' ? 'DESENVOLVEDOR' : currentUser?.role === 'admin' ? 'ADMINISTRADOR' : currentUser?.role === 'socio' ? 'SÓCIO' : 'OPERADOR'}
                    </span>
                  </div>
                  <span className="text-[10px] xl:text-[11.5px] text-slate-100 font-bold tracking-wide leading-none truncate" title={currentUser?.name}>
                    {currentUser?.name || 'Acesso Ativo'}
                  </span>
                </div>
              </div>

              {/* LOGOUT BUTTON */}
              <button
                onClick={handleLogout}
                title="Sair do Sistema"
                className="px-3 h-[34px] bg-brand-600/50 hover:bg-rose-600 hover:text-white text-brand-100 rounded-lg border border-brand-700/60 transition-all hover:scale-105 active:scale-95 duration-200 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer text-[10px] xl:text-[11px] font-bold font-sans"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sair</span>
              </button>

              {/* MONGODB CLOUD CONFIG INDICATOR */}
              {dbStatus && currentUser?.email === 'leojoex@hotmail.com' && (
                <button
                  type="button"
                  onClick={() => setShowDbDiagnosticsModal(true)}
                  className={`px-3 h-[34px] rounded-lg border font-mono text-[10px] xl:text-[11px] font-bold transition-all hover:scale-105 active:scale-95 duration-200 flex items-center justify-center gap-1.5 shrink-0 hover:brightness-110 cursor-pointer shadow-sm ${
                    dbStatus.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/35 animate-pulse'
                  }`}
                  title="Clique para ver o status da conexão com o MongoDB Atlas"
                >
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dbStatus.connected ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
                  <span>DB: {dbStatus.connected ? 'OK' : 'OFFLINE'}</span>
                </button>
              )}



              {/* SAVING IN OUTSTANDING HIGHLIGHT */}
              {currentUser?.email === 'leojoex@hotmail.com' && (
                <button
                  onClick={handleManualSave}
                  title="Salvar alterações no LocalStorage e Backup"
                  className="px-3 h-[34px] bg-brand-600/50 hover:bg-brand-700 text-brand-100 hover:text-white rounded-lg border border-brand-700/60 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5 justify-center text-[10px] xl:text-[11px] font-bold"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-sans">Salvar</span>
                </button>
              )}

              {/* BACKUP CONTROLLER ACTION */}
              {currentUser?.email === 'leojoex@hotmail.com' && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowBackupMenu(!showBackupMenu)}
                    title="Exportar/Importar Banco de Dados ou Restaurar"
                    className="px-3 h-[34px] bg-brand-600/50 hover:bg-brand-700 text-brand-100 hover:text-white rounded-lg border border-brand-700/60 transition-all hover:scale-105 active:scale-95 duration-200 text-[10px] xl:text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
                    <span>Backup</span>
                  </button>

                  {showBackupMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-100 shadow-premium p-1.5 z-50 text-xs text-slate-700">
                      <button
                        onClick={handleExportBackup}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        Exportar Backup (JSON)
                      </button>
                      <label className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer">
                        <ArrowDownRight className="h-4 w-4 text-brand-500" />
                        Importar Backup (JSON)
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleCopyBackupText}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <span>📋 Copiar p/ Área de Transf.</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowImportDialog(true);
                          setShowBackupMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-2 font-medium text-brand-600 cursor-pointer"
                      >
                        <span>📥 Importar via Texto</span>
                      </button>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button
                        onClick={() => {
                          setShowResetConfirm(true);
                          setShowBackupMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Resetar p/ Padrão Demo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Auxiliary calendar indicator - shown only on wide xl screens to completely prevent overflow */}
              <div className="hidden xl:flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 font-mono text-xs font-medium shrink-0">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                <span>{getBrasiliaUiDateStr()}</span>
              </div>
            </div>
          </div>

          {/* MOBILE SPECIFIC HEADER (Fully anti-overflow, lightweight design) */}
          <div className="lg:hidden flex flex-col py-3 gap-3">
            {/* Top Row: Brand Segment + Mini Control Panel */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 matches-compact">
                <EletroflowLogo variant="icon" iconSize={28} />
                <div>
                  <span className="font-display font-black text-emerald-300 text-[10px] leading-none tracking-tight block">
                    Olá, {currentUser?.name}!
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-white font-bold font-mono mt-0.5 block">
                    ELETROFLOW ADMIN
                  </span>
                </div>
              </div>

              {/* Controls Wrapper */}
              <div className="flex items-center gap-1.5 shrink-0">
                {dbStatus && currentUser?.email === 'leojoex@hotmail.com' && (
                  <button
                    type="button"
                    onClick={() => setShowDbDiagnosticsModal(true)}
                    className={`px-2 py-1.5 rounded-lg border font-mono text-[9px] font-bold transition-all flex items-center gap-1 hover:brightness-110 cursor-pointer ${
                      dbStatus.connected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/35 animate-pulse'
                    }`}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
                    <span>DB: {dbStatus.connected ? 'OK' : 'OFF'}</span>
                  </button>
                )}



                {currentUser?.email === 'leojoex@hotmail.com' && (
                  <button
                    onClick={handleManualSave}
                    className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-[10px] font-bold text-white rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shrink-0" />
                    <span>Salvar</span>
                  </button>
                )}

                {currentUser?.email === 'leojoex@hotmail.com' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowBackupMenu(!showBackupMenu)}
                      className="p-1.5 bg-brand-600/50 hover:bg-brand-700 text-brand-100 hover:text-white rounded-lg border border-brand-700/60 transition-all cursor-pointer"
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${showBackupMenu ? 'rotate-90' : ''} transition-transform`} />
                    </button>

                    {showBackupMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-100 shadow-premium p-1.5 z-50 text-xs text-slate-700">
                        <button
                          onClick={handleExportBackup}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                          Exportar Backup
                        </button>
                        <label className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 font-medium cursor-pointer">
                          <ArrowDownRight className="h-3.5 w-3.5 text-brand-500" />
                          Importar Backup
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={handleCopyBackupText}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <span>📋 Copiar Texto</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowImportDialog(true);
                            setShowBackupMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 font-medium text-brand-600 cursor-pointer"
                        >
                          <span>📥 Importar Texto</span>
                        </button>
                        <div className="border-t border-slate-100 my-1"></div>
                        <button
                          onClick={() => {
                            setShowResetConfirm(true);
                            setShowBackupMenu(false);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <RefreshCcw className="h-3 w-3" />
                          Resetar Sistema
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* MOBILE LOGOUT BUTTON */}
                <button
                  onClick={handleLogout}
                  title="Sair do Sistema"
                  className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg border border-rose-600 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Snug responsive columns: perfectly even tab allocation */}
            <nav className={`grid ${currentUser?.role === 'admin' || currentUser?.role === 'socio' ? 'grid-cols-6' : 'grid-cols-5'} gap-0.5`}>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="truncate max-w-full">Painel</span>
              </button>
              <button
                onClick={() => setActiveTab('financials')}
                className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'financials'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <Coins className="h-4 w-4" />
                <span className="truncate max-w-full">Finanças</span>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'transactions'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="truncate max-w-full">Extrato</span>
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'vehicles'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <CarFront className="h-4 w-4" />
                <span className="truncate max-w-full">Frota</span>
              </button>
              <button
                onClick={() => setActiveTab('rentals')}
                className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'rentals'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                }`}
              >
                <Key className="h-4 w-4" />
                <span className="truncate max-w-full">Contratos</span>
              </button>
              {(currentUser?.role === 'admin' || currentUser?.role === 'socio') && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-2 px-1 rounded-lg text-[10px] font-bold text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === 'users'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-brand-100 bg-brand-600/35 hover:bg-brand-600 hover:text-white'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span className="truncate max-w-full">Usuários</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Primary Area Container for Tabs rendering */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* ROW 1: PRIMARY FINANCIAL STAT CARDS (Revenues + Cauções in hand - Expenses) */}
            <div className="space-y-4">
              
              {/* PRIMARY CASH CARD */}
              <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl py-10 px-8 text-white shadow-premium relative overflow-hidden group">
                {/* Decorative subtle background elements */}
                <div className="absolute -right-8 -bottom-8 h-40 w-40 bg-white/5 rounded-full blur-xl group-hover:scale-115 transition-transform duration-500"></div>
                <div className="absolute left-1/4 -top-12 h-36 w-36 bg-emerald-500/10 rounded-full blur-lg"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 z-10 relative">
                  <div className="space-y-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-200 flex items-center gap-1.5 font-mono">
                      <Coins className="h-4 w-4 text-emerald-300" />
                      Dinheiro em Caixa
                    </span>
                    <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight font-mono text-white">
                      {formatCurrency(financials.currentCash)}
                    </h1>
                  </div>
                  
                  <div className="flex flex-col sm:items-start md:items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setShowSubFinancials(!showSubFinancials)}
                      className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer select-none"
                    >
                      {showSubFinancials ? (
                        <>
                          <span>Ocultar Detalhes</span>
                          <ChevronUp className="h-4 w-4 text-emerald-700" />
                        </>
                      ) : (
                        <>
                          <span>Exibir Detalhes</span>
                          <ChevronDown className="h-4 w-4 text-emerald-700" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* COLLAPSIBLE KPIs PANEL */}
              {showSubFinancials && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                  
                  {/* REVENUE KPI (Green Font Style) */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 h-28 w-28 bg-brand-50 rounded-full opacity-55 group-hover:scale-115 transition-transform"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Faturamento de Receitas</span>
                        <h2 className="font-display font-black text-emerald-600 text-2xl lg:text-3xl mt-1 tracking-tight font-mono font-bold">
                          {formatCurrency(financials.totalRevenues)}
                        </h2>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                        <ArrowUpRight className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 z-10">
                      <span>Aluguel semanal e estornos</span>
                      <span className="font-semibold text-slate-700">Entradas</span>
                    </div>
                  </div>

                  {/* CAUÇÃO SAFE KPI (Blue Font Style) */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 h-28 w-28 bg-blue-50 rounded-full opacity-55 group-hover:scale-115 transition-transform"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Depósitos de Caução Retidos</span>
                        <h2 className="font-display font-black text-blue-600 text-2xl lg:text-3xl mt-1 tracking-tight font-mono font-bold">
                          {formatCurrency(financials.netCaucaoInCustody)}
                        </h2>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 z-10">
                      <span>Custodiado em conta (Ativo)</span>
                      <span className="text-blue-600 font-semibold text-right" title={`Recebido: ${formatCurrency(financials.caucoesReceived)} / Devolvido: ${formatCurrency(financials.caucoesReturned)}`}>
                        Garantia
                      </span>
                    </div>
                  </div>

                  {/* EXPENSES KPI (Red Font Style) */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between relative overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-1">
                    <div className="absolute -top-12 -right-12 h-28 w-28 bg-rose-50 rounded-full opacity-55 group-hover:scale-115 transition-transform"></div>
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Despesas de Frota</span>
                        <h2 className="font-display text-rose-600 text-2xl lg:text-3xl mt-1 font-normal font-sans">
                          {formatCurrency(financials.totalExpenses)}
                        </h2>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                        <ArrowDownRight className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 z-10">
                      <span>Oficina, IPVA, taxas e peças</span>
                      <span className="font-semibold text-rose-600 font-sans">Saídas</span>
                    </div>
                  </div>

                </div>
              )}

              {/* FAST REGISTER ACTIONS ROW (moved logo abaixo do dinheiro em caixa - No header/comments) */}
              {currentUser?.role !== 'socio' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Lançar Aluguel Semanal Card */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase flex items-center gap-1">
                      <Coins className="h-4.5 w-4.5 text-emerald-500 animate-pulse" /> Lançar Aluguel Semanal
                    </h4>
                    
                    <form onSubmit={handleQuickRentSubmit} className="space-y-3">
                      <div>
                        <select
                          required
                          value={quickRentPaymentContractId}
                          onChange={(e) => {
                            setQuickRentPaymentContractId(e.target.value);
                            const found = rentals.find(r => r.id === e.target.value);
                            if (found) setQuickRentPaymentValue(found.weeklyRate);
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">Selecione o contrato...</option>
                          {rentals
                            .filter(r => r.status === 'active' && !r.isDeleted)
                            .map(r => {
                              const v = vehicles.find(item => item.id === r.vehicleId);
                              return (
                                <option key={r.id} value={r.id}>
                                  {r.tenantName} - {v?.brandModel || 'Carro'}
                                </option>
                              );
                            })}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            required
                            placeholder="Valor Semanal (R$)"
                            value={quickRentPaymentValue}
                            onChange={(e) => setQuickRentPaymentValue(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!quickRentPaymentContractId || !quickRentPaymentValue}
                          className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all cursor-pointer select-none"
                        >
                          Confirmar Recebimento
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Lançar Despesa Card */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase flex items-center gap-1">
                      <Wrench className="h-4.5 w-4.5 text-rose-500" /> Lançar Despesa
                    </h4>
                    
                    <form onSubmit={handleQuickMaintenanceSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          required
                          value={quickMaintenanceVehicleId}
                          onChange={(e) => setQuickMaintenanceVehicleId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">Veículo...</option>
                          {vehicles.filter(v => !v.isDeleted).map(v => {
                            const activeRental = rentals.find(r => r.vehicleId === v.id && r.status === 'active' && !r.isDeleted);
                            const label = activeRental 
                              ? `${v.plate} - ${v.brandModel} (${activeRental.tenantName})`
                              : `${v.plate} - ${v.brandModel} (${v.status === 'maintenance' ? 'Oficina' : 'S/ Contrato'})`;
                            return (
                              <option key={v.id} value={v.id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="number"
                          required
                          placeholder="Custo (R$)"
                          value={quickMaintenanceCost}
                          onChange={(e) => setQuickMaintenanceCost(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                        />
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Qual o reparo? Ex: Troca de óleo"
                          value={quickMaintenanceDesc}
                          onChange={(e) => setQuickMaintenanceDesc(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          type="submit"
                          disabled={!quickMaintenanceVehicleId || !quickMaintenanceCost || !quickMaintenanceDesc}
                          className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all cursor-pointer select-none"
                        >
                          Lançar
                        </button>
                      </div>
                    </form>
                  </div>

                </div>
              )}
            </div>

            {/* ROW 2: CASH FLOW GRAPH TIMELINE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <CashFlowChart 
                  transactions={transactions} 
                  onHoverPointChange={(point, meta) => setHoveredPointData({ point, meta })}
                />
              </div>

              {/* DETALHAMENTO DE FLUXO (BOX INTEGRADA AO GRÁFICO - NUNCA SOBREPÕE O GRÁFICO) */}
              <div className={`lg:col-span-4 bg-white rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 ease-in-out border-2 ${
                hoveredPointData.point
                  ? 'border-brand-500 shadow-[0_10px_30px_rgba(10,28,53,0.15)] ring-4 ring-brand-500/5 translate-y-[-2px]' 
                  : 'border-brand-500/20 shadow-premium-lg'
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2.5 border-b border-slate-100">
                    <div className="p-1.5 bg-brand-50 text-brand-600 rounded-lg">
                      <Coins className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-800 text-sm leading-tight">
                        Detalhamento do Fluxo
                      </h3>
                      <p className="text-[9.5px] text-slate-400 font-sans leading-none mt-0.5">
                        Valores consolidados em tempo real
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 font-sans leading-relaxed bg-slate-50 border border-slate-100 p-2.5 rounded-lg mt-2 mb-1">
                    💡 Passe o mouse sobre as barras/linhas do gráfico para detalhar valores consolidados de qualquer ponto.
                  </p>

                  {/* Render point info */}
                  {(() => {
                    const activePoint = hoveredPointData.point || (hoveredPointData.meta ? hoveredPointData.meta.latestPoint : null);
                    if (!activePoint) {
                      return (
                        <div className="my-8 text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                          <p className="text-xs text-slate-400 font-sans italic">Aguardando dados gráficos...</p>
                        </div>
                      );
                    }

                    const isHovered = !!hoveredPointData.point;
                    const meta = hoveredPointData.meta;
                    
                    const formatVal = (val: number) => {
                      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                    };

                    const formatDateLabel = (dateStr: string) => {
                      const parts = dateStr.split('-');
                      if (parts.length === 3) {
                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                      }
                      return dateStr;
                    };

                    const dateLabel = meta?.timeFrame === 'semanal' 
                      ? `Semana de ${formatDateLabel(activePoint.date)}`
                      : meta?.timeFrame === 'mensal'
                        ? `Mês: ${activePoint.date}`
                        : `Dia: ${formatDateLabel(activePoint.date)}`;

                    return (
                      <div className="mt-4 space-y-4">
                        {/* Point Header Tag */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-sans ${isHovered ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600'}`}>
                            {isHovered ? 'Ponto Selecionado' : 'Consolidado Geral'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                            <Calendar className="h-3 w-3" />
                            {dateLabel}
                          </span>
                        </div>

                        {/* Values details */}
                        <div className="space-y-2.5">
                          {/* Receitas */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 border border-emerald-100/40">
                            <div>
                              <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider font-bold">Receitas</span>
                              <span className="text-emerald-700 font-mono font-bold text-xs sm:text-sm">
                                {formatVal(activePoint.receitas || 0)}
                              </span>
                            </div>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>

                          {/* Despesas */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50/50 border border-rose-100/40">
                            <div>
                              <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider font-bold">Despesas</span>
                              <span className="text-rose-700 font-mono font-bold text-xs sm:text-sm">
                                {formatVal(activePoint.despesas || 0)}
                              </span>
                            </div>
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          </div>

                          {/* Cauções Net */}
                          <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/50 border border-indigo-100/40">
                            <div>
                              <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider font-bold">Garantia (Caução Líquido)</span>
                              <span className="text-indigo-700 font-mono font-bold text-xs sm:text-sm">
                                {formatVal(activePoint.caucao || 0)}
                              </span>
                            </div>
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-dashed border-slate-100 my-2"></div>

                          {/* Saldo Líquido do Período */}
                          <div className="flex items-center justify-between px-1 py-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Saldo do Período</span>
                            <span className={`font-mono text-xs font-bold ${activePoint.saldoDia >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {activePoint.saldoDia >= 0 ? '+' : ''}{formatVal(activePoint.saldoDia)}
                            </span>
                          </div>

                          {/* Saldo Acumulado */}
                          <div className="flex items-center justify-between px-1 py-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Saldo Acumulado</span>
                            <span className={`font-mono text-xs font-bold ${activePoint.acumulado >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                              {formatVal(activePoint.acumulado)}
                            </span>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-dotted border-slate-200 my-2"></div>

                          {/* Acumulados Totais (Discreto) */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-sans mt-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            <div>
                              <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 font-bold">Rec. Acumuladas</span>
                              <span className="font-mono font-bold text-emerald-600/90 text-[11px]">
                                {formatVal(activePoint.acumuladoReceitas || 0)}
                              </span>
                            </div>
                            <div className="border-l border-slate-200 pl-2">
                              <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 font-bold">Desp. Acumuladas</span>
                              <span className="font-mono font-bold text-rose-600/90 text-[11px]">
                                {formatVal(activePoint.acumuladoDespesas || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ROW 3: RECENT ACTIVITIES */}
            <div className="grid grid-cols-1 gap-6 pb-6">
              
              {/* Box 1: Últimas Movimentações */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-premium flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-display font-semibold text-slate-800 text-base">
                        Últimas Movimentações
                      </h3>
                      <p className="text-xs text-slate-400">Registros financeiros consolidados (previstas em cinza).</p>
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-[350px] border border-slate-100 rounded-xl">
                    {/* View for Desktop and Tablet */}
                    <table className="w-full text-left border-collapse text-xs hidden md:table">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider sticky top-0 bg-white">
                          <th className="px-5 py-3">Data</th>
                          <th className="px-5 py-3">Descrição / Lançamento</th>
                          <th className="px-5 py-3">Categoria</th>
                          <th className="px-5 py-3 text-right">Entrada/Saídas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {recentTransactions.map((t) => {
                          const increment = t.type === 'receita' || t.type === 'caucao_recebido';
                          const isFuture = t.date > getBrasiliaDateStr();
                          return (
                            <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors ${isFuture ? 'bg-slate-50/50 text-slate-400 opacity-70 font-mono italic' : ''}`}>
                              <td className={`px-5 py-3.5 font-mono whitespace-nowrap ${isFuture ? 'text-slate-400 italic font-medium' : 'text-black font-semibold'}`}>
                                {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-5 py-3.5 flex-1">
                                <span className={`font-semibold block truncate max-w-[170px] ${isFuture ? 'text-slate-400 font-normal italic' : 'text-slate-800'}`} title={t.description}>
                                  {isFuture && <span className="text-[8px] bg-slate-200 text-slate-500 font-semibold px-1 py-0.2 rounded mr-1 uppercase font-sans not-italic">Previsto</span>}
                                  {t.description}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${isFuture ? 'bg-slate-100 border-slate-200 text-slate-450' : 'bg-slate-100 text-slate-650 border-slate-200'}`}>
                                  {t.category}
                                </span>
                              </td>
                              <td className={`px-5 py-3.5 text-right font-mono whitespace-nowrap ${isFuture ? 'text-slate-400 font-normal italic' : increment ? 'text-emerald-600 font-bold' : 'text-rose-600 font-normal'}`}>
                                {increment ? '+' : '-'} {formatCurrency(t.value)}
                              </td>
                            </tr>
                          );
                        })}
                        {recentTransactions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-slate-400 font-semibold">
                              Nenhum lançamento no extrato recente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* View optimized for Smartphone (Mobile List Layout, completely vertical, no scrolling) */}
                    <div className="block md:hidden divide-y divide-slate-100 p-1 bg-white">
                      {recentTransactions.map((t) => {
                        const increment = t.type === 'receita' || t.type === 'caucao_recebido';
                        const isFuture = t.date > getBrasiliaDateStr();
                        return (
                          <div key={t.id} className={`p-3.5 flex flex-col gap-2 rounded-lg my-1 border transition-colors ${isFuture ? 'bg-slate-50/90 border-slate-200/80 opacity-75 text-slate-400' : 'bg-slate-50/30 hover:bg-slate-50 border-slate-100/50'}`}>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-mono text-black font-bold bg-white px-2 py-0.5 rounded border border-slate-205">
                                {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                              <div className="flex items-center gap-1">
                                {isFuture && <span className="text-[8px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase font-sans">Previsto</span>}
                                <span className="text-[9px] bg-indigo-50/70 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-100/60">
                                  {t.category}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-end">
                              <span className={`text-xs font-semibold max-w-[190px] break-words line-clamp-2 ${isFuture ? 'text-slate-500 italic' : 'text-slate-800'}`}>
                                {t.description}
                              </span>
                              <span className={`font-mono text-xs font-bold text-right ${isFuture ? 'text-slate-400 italic font-medium' : increment ? 'text-emerald-600' : 'text-rose-600 font-normal'}`}>
                                {increment ? '+' : '-'} {formatCurrency(t.value)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {recentTransactions.length === 0 && (
                        <div className="py-12 text-center text-slate-400 font-semibold text-xs">
                          Nenhum lançamento no extrato recente.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="px-4 py-2 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Ver Extrato Completo
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'financials' && (
          <div className="animate-fade-in">
            <FinancialsTab
              vehicles={vehicles}
              futureExpenses={futureExpenses}
              transactions={transactions}
              onUpdateVehicle={handleUpdateVehicle}
            />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="animate-fade-in">
            <TransactionsTab
              transactions={transactions}
              vehicles={vehicles}
              rentals={rentals}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              futureExpenses={futureExpenses}
              onAddFutureExpense={handleAddFutureExpense}
              onRealizeFutureInstallment={handleRealizeFutureInstallment}
              onDeleteFutureExpense={handleDeleteFutureExpense}
              onUpdateFutureInstallmentDate={handleUpdateFutureInstallmentDate}
              currentUser={currentUser}
            />
          </div>
        )}

        {activeTab === 'vehicles' && (
          <div className="animate-fade-in">
            <VehiclesTab
              vehicles={vehicles}
              rentals={rentals}
              transactions={transactions}
              futureExpenses={futureExpenses}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicle={handleUpdateVehicle}
              onUpdateVehicleStatus={handleUpdateVehicleStatus}
              onDeleteVehicle={handleDeleteVehicle}
              currentUser={currentUser}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          </div>
        )}

        {activeTab === 'rentals' && (
          <div className="animate-fade-in">
            <RentalsTab
               vehicles={vehicles}
              rentals={rentals}
              transactions={transactions}
              onStartRental={handleStartRental}
              onUpdateRental={handleUpdateRental}
              onTerminateRental={handleTerminateRental}
              onDeleteRental={handleDeleteRental}
              currentUser={currentUser}
              interestedLeads={interestedLeads}
              onAddInterestedLead={handleAddInterestedLead}
              onDeleteInterestedLead={handleDeleteInterestedLead}
              onToggleLeadDocApproved={handleToggleLeadDocApproved}
              onIncrementLeadContactCount={handleIncrementLeadContactCount}
              onDecrementLeadContactCount={handleDecrementLeadContactCount}
            />
          </div>
        )}

        {activeTab === 'users' && (currentUser?.role === 'admin' || currentUser?.role === 'socio') && (
          <div className="animate-fade-in">
            <UsersTab
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onChangePasswordClick={() => setShowChangePasswordModal(true)}
              accessLogs={accessLogs}
              onClearAccessLogs={handleClearAccessLogs}
            />
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 mt-auto select-none font-sans">
        <p>© 2026 Eletroflow. Desenvolvido para o controle completo de locação e recarga de frotas de veículos.</p>
        <p className="mt-1 font-mono text-[10px] text-slate-350">
          Saldo Disponível = Receitas Totais + Depósitos Caução Ativos - Despesas da Frota
        </p>
      </footer>

      {/* MODAL: IMPORT DATA VIA PLAIN TEXT */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                Importar Banco de Dados via Texto
              </h3>
              <button
                onClick={() => setShowImportDialog(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImportTextSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Cole abaixo o texto de backup copiado anteriormente para restabelecer todos os veículos, contratos ativos, receitas e despesas salvos.
              </p>
              <div>
                <textarea
                  required
                  placeholder='Cole o backup JSON aqui. Ex: {"vehicles": [], "rentals": []...}'
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-44 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportDialog(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium cursor-pointer"
                >
                  Confirmar e Restaurar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET DEMO DATA CONFIRMATION */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in animate-duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 animate-pulse" />
                Restaurar Dados de Demonstração
              </h3>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Você tem certeza que deseja restaurar o aplicativo aos dados originais de demonstração?
              </p>
              <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl space-y-1.5 label text-rose-850">
                <span className="block text-xs font-bold text-rose-800">Esta ação é irreversível:</span>
                <ul className="text-[11px] text-rose-700 list-disc pl-4 space-y-1">
                  <li>Apaga todos os veículos adicionados ou modificações em seus dados</li>
                  <li>Invalida todos os atuais contratos cadastrados de locação</li>
                  <li>Limpa por completo o histórico do livro-caixa, despesas e receitas</li>
                  <li>Carrega os conjuntos originais de veículos e locações fictícias</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-semibold font-sans transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmHardReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium"
              >
                Restaurar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MONGODB DATABASE CONNECTION DIAGNOSTICS */}
      {showDbDiagnosticsModal && dbStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-brand-500" />
                Diagnóstico de Conexão: MongoDB Cloud
              </h3>
              <button
                onClick={() => setShowDbDiagnosticsModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans text-slate-600 leading-relaxed max-h-[450px] overflow-y-auto pr-1">
              {/* STATUS CARD */}
              <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                dbStatus.connected 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                <div className={`h-3 w-3 rounded-full mt-1.5 shrink-0 ${
                  dbStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'
                }`} />
                <div>
                  <h4 className="font-extrabold text-sm mb-1">
                    {dbStatus.connected ? '✓ Conexão Ativa com o MongoDB' : '✗ Fora de Linha (Offline)'}
                  </h4>
                  <p className="text-[11px] opacity-90 leading-normal">
                    {dbStatus.connected 
                      ? 'Seus dados já estão sendo salvos e sincronizados com segurança na nuvem! Qualquer usuário que acessar o aplicativo em outro dispositivo (inclusive celular) verá as informações em tempo real.' 
                      : 'O aplicativo não está conectado ao MongoDB Atlas. Atualmente, as alterações que você faz se mantêm localmente no cache do seu navegador (localStorage) e não são compartilhadas com e nem salvas para os demais usuários.'
                    }
                  </p>
                </div>
              </div>

              {/* TECHNICAL TELEMETRY */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-2.5 font-sans">
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500 block mb-1">Parâmetros de Telemetria</span>
                
                <div className="grid grid-cols-3 gap-1 border-b border-slate-200/30 pb-2">
                  <span className="text-slate-400 font-medium">Nome da Variável:</span>
                  <span className="col-span-2 font-mono font-bold text-slate-700">MONGODB_URI</span>
                </div>

                <div className="grid grid-cols-3 gap-1 border-b border-slate-200/30 pb-2">
                  <span className="text-slate-400 font-medium">Status no Servidor:</span>
                  <span className="col-span-2 font-semibold">
                    {dbStatus.uriConfigured 
                      ? <span className="text-emerald-600 font-bold">Configurada na Nuvem</span> 
                      : <span className="text-rose-500 font-bold">NÃO CONFIGURADA ou INEXISTENTE</span>
                    }
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 border-b border-slate-200/30 pb-2">
                  <span className="text-slate-400 font-medium">String de Conexão:</span>
                  <span className="col-span-2 font-mono text-[10px] break-all bg-white px-2 py-1 border border-slate-100 rounded text-slate-500 select-all">
                    {dbStatus.uriMasked}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <span className="text-slate-400 font-medium">Mecanismo Ativo:</span>
                  <span className="col-span-2 font-bold text-slate-700">
                    {dbStatus.connected ? 'MongoDB Atlas (Produção Real)' : 'Modo Offline (Espelho Local via Navegador)'}
                  </span>
                </div>
              </div>

              {/* CONNECTIVITY ERROR DETAIL */}
              {dbStatus.lastError && (
                <div className="bg-rose-100 border border-rose-200 text-rose-800 p-3.5 rounded-xl space-y-1">
                  <span className="block text-[11px] font-extrabold text-rose-900 uppercase tracking-wide">Último erro reportado pelo MongoDB:</span>
                  <p className="font-mono text-[11px] break-all bg-white/70 p-2 rounded border border-rose-200/50 leading-relaxed text-rose-950 font-bold select-all">
                    {dbStatus.lastError}
                  </p>
                </div>
              )}

              {/* EDUCATIONAL TROUBLESHOOTING STEP-BY-STEP */}
              <div className="border border-brand-100 bg-brand-50/20 rounded-xl p-4 space-y-2">
                <span className="font-extrabold text-[11px] text-brand-800 uppercase tracking-wider block">Como Configurar & Resolver o MongoDB Atlas</span>
                <ol className="list-decimal pl-4 text-[11px] text-slate-700 space-y-2 leading-relaxed">
                  <li>
                    Acesse as <strong>Configurações (Settings)</strong> ou o <strong>Secret Manager (Secrets)</strong> do Google AI Studio / IDX.
                  </li>
                  <li>
                    Crie uma nova variável de ambiente com o nome exato: <strong className="font-mono font-bold bg-white px-1.5 py-0.5 border border-slate-250 rounded">MONGODB_URI</strong> (em maiúsculas, exatamente igual).
                  </li>
                  <li>
                    No valor, cole a url fornecida pelo MongoDB Atlas, que deve ser parecida com:
                    <div className="font-mono text-[10px] bg-white p-1.5 my-1 border rounded select-all break-all text-slate-500">
                      mongodb+srv://&lt;usuario&gt;:&lt;senha&gt;@cluster0.xxxxx.mongodb.net/eletroflow?retryWrites=true&amp;w=majority
                    </div>
                  </li>
                  <li>
                    <strong className="text-rose-700 font-bold">Importante (Acesso de IP):</strong> No console do seu MongoDB Atlas, vá em <strong className="font-bold">Security &gt; Network Access</strong>, adicione um novo registro e escolha <strong className="font-bold">Allow Access from Anywhere</strong> (ou seja, adicione o IP <code className="bg-white px-1 border rounded">0.0.0.0/0</code>). Caso contrário, a nuvem do Google AI Studio será bloqueada pelo firewall do seu MongoDB Atlas!
                  </li>
                </ol>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={checkDbStatus}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold font-sans transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Validar Agora
              </button>
              <button
                type="button"
                onClick={() => setShowDbDiagnosticsModal(false)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium cursor-pointer"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALTERAR SENHA DO USUÁRIO ATUAL */}
      {showChangePasswordModal && currentUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-premium-lg border border-slate-100 transform scale-100 transition-all font-sans">
            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
              <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Alterar Minha Senha
              </h3>
              <button
                onClick={() => {
                  setCurrentPasswordInput('');
                  setNewPasswordInput('');
                  setConfirmNewPasswordInput('');
                  setShowChangePasswordModal(false);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed font-sans mb-3 flex items-start gap-2">
                <span className="text-base select-none">ℹ️</span>
                <span>
                  Olá, <strong>{currentUser.name}</strong> (<span className="font-mono text-[10px] bg-slate-150 px-1 py-0.5 rounded text-slate-700">{currentUser.email}</span>). 
                  Insira sua senha atual e a nova combinação abaixo para efetivar a mudança.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1 font-sans">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="Insera sua senha de acesso atual"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1 font-sans">
                  Nova Senha (Mínimo 4 caracteres)
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Nova senha robusta"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1 font-sans">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  placeholder="Repita a nova senha criada"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmNewPasswordInput('');
                    setShowChangePasswordModal(false);
                  }}
                  className="px-4 py-2 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold font-sans transition-all shadow-premium flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5 text-white/80" />
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
