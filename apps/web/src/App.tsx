import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ClipboardPlus, Settings, Kanban, LogOut, Menu, X, Loader2, RefreshCw, ChevronDown, ChevronRight, TrendingUp, Search, XCircle
} from 'lucide-react';
import { ViewType } from '@gestao-leitos/types';
import Dashboard from './components/Dashboard';
import DashboardOperacional from './components/DashboardOperacional';
import ServiceRequestForm from './components/ServiceRequestForm';
import ServiceOrdersKanban from './components/ServiceOrdersKanban';
import ActionsList from './components/ActionsList';
import RegistrationManager from './components/RegistrationManager';
import Login from './components/Login';
import { useAuth } from './contexts/AuthContext';
import { trpc } from './lib/trpc';

const MemoizedDashboard = React.memo(Dashboard);
const MemoizedDashboardOperacional = React.memo(DashboardOperacional);
const MemoizedServiceRequestForm = React.memo(ServiceRequestForm);
const MemoizedServiceOrdersKanban = React.memo(ServiceOrdersKanban);
const MemoizedRegistrationManager = React.memo(RegistrationManager);
const MemoizedActionsList = React.memo(ActionsList);

const App: React.FC = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const utils = trpc.useContext();

  // Auto-login: Check if user is already authenticated via cookie
  const { data: sessionUser, isLoading: sessionLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: !currentUser, // Only check if not already logged in
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Logout mutation to clear cookie on backend
  const logoutMutation = trpc.auth.logout.useMutation();

  // Auto-login effect: Set user from session if available
  useEffect(() => {
    if (sessionUser && !currentUser) {
      setCurrentUser(sessionUser as any);
    }
  }, [sessionUser, currentUser, setCurrentUser]);

  // Logout handler - clears session and redirects to login
  const handleLogout = async () => {
    try {
      // Clear user state (triggers redirect to login)
      setCurrentUser(null);
      
      // Destroy the cookie on backend
      await logoutMutation.mutateAsync();
      
      // Reset view to dashboard for next login
      setActiveView('DASHBOARD');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if backend fails, ensure user is logged out locally
      setCurrentUser(null);
      setActiveView('DASHBOARD');
    }
  };

  // Fetch all data using tRPC
  const { data: beds = [], isLoading: bedsLoading, refetch: refetchBeds } = trpc.leitos.list.useQuery({}, {
    enabled: !!currentUser,
    refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time updates
  });
  
  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = trpc.orders.list.useQuery({}, {
    enabled: !!currentUser,
    refetchInterval: 3000, // Auto-refresh every 3 seconds for real-time updates
  });

  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = trpc.services.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = trpc.users.list.useQuery(undefined, {
    enabled: !!currentUser,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const { data: teams = [], isLoading: teamsLoading, refetch: refetchTeams } = trpc.teams.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: companies = [], isLoading: companiesLoading, refetch: refetchCompanies } = trpc.companies.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: units = [], isLoading: unitsLoading, refetch: refetchUnits } = trpc.units.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: sectors = [], isLoading: sectorsLoading, refetch: refetchSectors } = trpc.sectors.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: steps = [], isLoading: stepsLoading, refetch: refetchSteps } = trpc.steps.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: complementItems = [], isLoading: itemsLoading, refetch: refetchItems } = trpc.config.listComplementItems.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: bedStatusConfigs = [], isLoading: statusLoading, refetch: refetchStatus } = trpc.config.listBedStatusConfigs.useQuery(undefined, {
    enabled: !!currentUser,
  });

  const { data: reasons = [], isLoading: reasonsLoading, refetch: refetchReasons } = trpc.reasons.list.useQuery(undefined, {
    enabled: !!currentUser,
  });

  // No longer using legacy standalone actions array

  // Mutations for RegistrationManager
  const deleteMutation = {
    beds: trpc.leitos.delete.useMutation(),
    users: trpc.users.delete.useMutation(),
    teams: trpc.teams.delete.useMutation(),
    services: trpc.services.delete.useMutation(),
    companies: trpc.companies.delete.useMutation(),
    units: trpc.units.delete.useMutation(),
    sectors: trpc.sectors.delete.useMutation(),
    steps: trpc.steps.delete.useMutation(),
    complementItems: trpc.config.deleteComplementItem.useMutation(),
    bedStatusConfigs: trpc.config.deleteBedStatusConfig.useMutation(),
    reasons: trpc.reasons.delete.useMutation(),
  };

  const saveMutation = {
    beds: { create: trpc.leitos.create.useMutation(), update: trpc.leitos.update.useMutation() },
    users: { create: trpc.users.create.useMutation(), update: trpc.users.update.useMutation() },
    teams: { create: trpc.teams.create.useMutation(), update: trpc.teams.update.useMutation() },
    services: { create: trpc.services.create.useMutation(), update: trpc.services.update.useMutation() },
    companies: { create: trpc.companies.create.useMutation(), update: trpc.companies.update.useMutation() },
    units: { create: trpc.units.create.useMutation(), update: trpc.units.update.useMutation() },
    sectors: { create: trpc.sectors.create.useMutation(), update: trpc.sectors.update.useMutation() },
    steps: { create: trpc.steps.create.useMutation(), update: trpc.steps.update.useMutation() },
    complementItems: { create: trpc.config.createComplementItem.useMutation(), update: trpc.config.updateComplementItem.useMutation() },
    bedStatusConfigs: { create: trpc.config.createBedStatusConfig.useMutation(), update: trpc.config.updateBedStatusConfig.useMutation() },
    reasons: { create: trpc.reasons.create.useMutation(), update: trpc.reasons.update.useMutation() },
  };

  const loading = bedsLoading || ordersLoading || servicesLoading || usersLoading || teamsLoading || 
                  companiesLoading || unitsLoading || sectorsLoading || stepsLoading || itemsLoading || statusLoading || reasonsLoading;
  
  // Track if we have completed at least one load of basic data
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!loading && currentUser && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [loading, currentUser, initialLoadDone]);

  const handleRefetchAll = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        refetchBeds(), refetchOrders(), refetchServices(), refetchUsers(), refetchTeams(),
        refetchCompanies(), refetchUnits(), refetchSectors(), refetchSteps(), refetchItems(), refetchStatus(), refetchReasons()
      ]);
    } finally {
      setSyncing(false);
    }
  };

  const invalidateRegistry = async (type: string) => {
    setSyncing(true);
    try {
      switch (type) {
        case 'beds':
          await Promise.all([utils.leitos.list.invalidate(), utils.orders.list.invalidate()]);
          break;
        case 'users':
          await Promise.all([utils.users.list.invalidate(), utils.teams.list.invalidate()]);
          break;
        case 'teams':
          await Promise.all([utils.teams.list.invalidate(), utils.users.list.invalidate()]);
          break;
        case 'services':
          await Promise.all([utils.services.list.invalidate(), utils.steps.list.invalidate()]);
          break;
        case 'companies':
          await Promise.all([utils.companies.list.invalidate(), utils.units.list.invalidate()]);
          break;
        case 'units':
          await Promise.all([utils.units.list.invalidate(), utils.sectors.list.invalidate()]);
          break;
        case 'sectors':
          await Promise.all([utils.sectors.list.invalidate(), utils.leitos.list.invalidate()]);
          break;
        case 'steps':
          await Promise.all([utils.steps.list.invalidate(), utils.services.list.invalidate()]);
          break;
        case 'complementItems':
          await utils.config.listComplementItems.invalidate();
          break;
        case 'bedStatusConfigs':
          await Promise.all([utils.config.listBedStatusConfigs.invalidate(), utils.leitos.list.invalidate()]);
          break;
        case 'reasons':
          await utils.reasons.list.invalidate();
          break;
        default:
          await handleRefetchAll();
      }
    } finally {
      setSyncing(false);
    }
  };

  // Verifica se o usuário pertence a alguma equipe
  const isUserMemberOfAnyTeam = useMemo(() => {
    if (!currentUser) return false;
    return teams.some(t => t.userIds.includes(currentUser.id));
  }, [teams, currentUser]);

  const canAccessKanban = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.permissions.isAdmin || isUserMemberOfAnyTeam;
  }, [currentUser, isUserMemberOfAnyTeam]);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
  };

  const handleUpdateOrder = async () => {
    await refetchOrders();
  };

  const handleSaveRegistry = async (type: string, item: any) => {
    try {
      const isEditing = !!item.id;
      const mutationGroup = (saveMutation as any)[type];
      
      if (!mutationGroup) {
        throw new Error(`Tipo de registro desconhecido: ${type}`);
      }

      const mutation = isEditing ? mutationGroup.update : mutationGroup.create;
      await mutation.mutateAsync(item);
      
      // Invalida em background para não bloquear feedback do UI
      invalidateRegistry(type);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar: ${error.message}`);
    }
  };

  const handleDeleteRegistry = async (type: string, id: string) => {
    if(!confirm('Tem certeza que deseja excluir este registro?')) return;
    
    try {
      const mutation = (deleteMutation as any)[type];
      
      if (!mutation) {
        throw new Error(`Tipo de registro desconhecido: ${type}`);
      }

      await mutation.mutateAsync({ id });
      invalidateRegistry(type);
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      alert(`Erro ao excluir: ${error.message}`);
    }
  };

  if (!initialLoadDone && loading && currentUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Carregando dados...</p>
      </div>
    );
  }

  // Show loading while checking for existing session
  if (sessionLoading && !currentUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Verificando sessão...</p>
      </div>
    );
  }

  // No valid session - show login
  if (!currentUser) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col z-20 shadow-xl`}>
        <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <h1 className={`font-bold text-lg md:text-xl text-sky-400 truncate transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>Gestão de Leitos</h1>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Menu size={20} /></button>
        </div>

        <nav className="flex-1 mt-6 space-y-2 px-3 overflow-y-auto scrollbar-hide">
          <DashboardSubmenu 
            isSidebarOpen={isSidebarOpen} 
            activeView={activeView} 
            setActiveView={setActiveView} 
          />
          <SidebarItem icon={<ClipboardPlus size={20} />} label="Solicitar" active={activeView === 'SOLICITAR'} collapsed={!isSidebarOpen} onClick={() => setActiveView('SOLICITAR')} />
          
          {canAccessKanban && (
            <SidebarItem icon={<Kanban size={20} />} label="Ordens" active={activeView === 'ORDENS'} collapsed={!isSidebarOpen} onClick={() => setActiveView('ORDENS')} />
          )}

          <SidebarItem icon={<Search size={20} />} label="Pesquisa de Ações" active={activeView === 'PESQUISA_ACOES'} collapsed={!isSidebarOpen} onClick={() => setActiveView('PESQUISA_ACOES')} />

          {currentUser.permissions.isAdmin && (
            <SidebarItem icon={<Settings size={20} />} label="Cadastros" active={activeView === 'CADASTROS'} collapsed={!isSidebarOpen} onClick={() => setActiveView('CADASTROS')} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900/50">
          <div className={`flex items-center space-x-3 mb-2 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center font-bold text-sm shrink-0 uppercase">{currentUser.name.charAt(0)}</div>
            {isSidebarOpen && (
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-bold truncate text-slate-100">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 truncate uppercase">{currentUser.permissions.isAdmin ? 'Administrador' : isUserMemberOfAnyTeam ? 'Executor' : 'Solicitante'}</p>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors text-xs font-black uppercase tracking-widest ${!isSidebarOpen ? 'justify-center' : 'mt-2'}`}
          >
            <LogOut size={16} />
            {isSidebarOpen && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-8 bg-slate-50 relative">
          {syncing && <div className="absolute top-3 md:top-4 right-4 md:right-8 z-30 flex items-center space-x-2 bg-white/80 px-3 py-1 rounded-full border border-sky-100 shadow-sm"><RefreshCw className="w-3 h-3 text-sky-500 animate-spin" /></div>}
          
          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 min-h-full p-4 md:p-6">
            {activeView === 'DASHBOARD' && <MemoizedDashboard beds={beds} orders={orders} users={users} services={services} bedStatusConfigs={bedStatusConfigs} />}
            {activeView === 'DASHBOARD_OPERACIONAL' && <MemoizedDashboardOperacional beds={beds} orders={orders} services={services} steps={steps} users={users} bedStatusConfigs={bedStatusConfigs} />}
            {activeView === 'SOLICITAR' && <MemoizedServiceRequestForm beds={beds} services={services} currentUser={currentUser} steps={steps} onSuccess={async () => { await refetchOrders(); setActiveView('DASHBOARD'); }} />}
            {activeView === 'ORDENS' && canAccessKanban && <MemoizedServiceOrdersKanban orders={orders} services={services} beds={beds} sectors={sectors} currentUser={currentUser} teams={teams} users={users} bedStatusConfigs={bedStatusConfigs} onUpdateOrder={handleUpdateOrder} onCompleteOrder={() => refetchOrders()} />}
            {activeView === 'PESQUISA_ACOES' && <MemoizedActionsList orders={orders} services={services} beds={beds} sectors={sectors} users={users} steps={steps} />}
            {activeView === 'CADASTROS' && currentUser.permissions.isAdmin && (
              <MemoizedRegistrationManager 
                currentUser={currentUser} companies={companies} units={units} sectors={sectors} beds={beds} services={services} users={users} teams={teams} complementItems={complementItems} steps={steps} bedStatusConfigs={bedStatusConfigs} reasons={reasons}
                onSave={handleSaveRegistry} onDelete={handleDeleteRegistry}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const DashboardSubmenu: React.FC<{ 
  isSidebarOpen: boolean; 
  activeView: ViewType; 
  setActiveView: (view: ViewType) => void 
}> = ({ isSidebarOpen, activeView, setActiveView }) => {
  const isDashboardActive = activeView === 'DASHBOARD' || activeView === 'DASHBOARD_OPERACIONAL';
  const [isExpanded, setIsExpanded] = useState(isDashboardActive);
  
  // Expandir automaticamente quando muda para uma view de dashboard
  useEffect(() => {
    if (isDashboardActive && isSidebarOpen) {
      setIsExpanded(true);
    }
  }, [isDashboardActive, isSidebarOpen]);

  // Quando sidebar está fechado, abre o dashboard geral ao clicar
  if (!isSidebarOpen) {
    return (
      <button 
        onClick={() => setActiveView('DASHBOARD')}
        className={`w-full flex items-center justify-center p-3 rounded-xl transition-all ${isDashboardActive ? 'bg-sky-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'}`}
        title="Dashboard"
      >
        <LayoutDashboard size={20} />
      </button>
    );
  }

  return (
    <div>
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isDashboardActive ? 'bg-sky-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'}`}
      >
        <div className="flex items-center space-x-3">
          <LayoutDashboard size={20} />
          <span className="font-semibold whitespace-nowrap text-sm">Dashboard</span>
        </div>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isExpanded && (
        <div className="ml-8 mt-1 space-y-1">
          <button
            onClick={() => {
              setActiveView('DASHBOARD');
              setIsExpanded(false);
            }}
            className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-all text-sm ${activeView === 'DASHBOARD' ? 'bg-sky-500/50 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            <TrendingUp size={16} />
            <span>Geral</span>
          </button>
          <button
            onClick={() => {
              setActiveView('DASHBOARD_OPERACIONAL');
              setIsExpanded(false);
            }}
            className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-all text-sm ${activeView === 'DASHBOARD_OPERACIONAL' ? 'bg-sky-500/50 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            <LayoutDashboard size={16} />
            <span>Operacional</span>
          </button>
        </div>
      )}
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void }> = ({ icon, label, active, collapsed, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all ${active ? 'bg-sky-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'} ${collapsed ? 'justify-center' : ''}`}>
    {icon}
    {!collapsed && <span className="font-semibold whitespace-nowrap text-sm">{label}</span>}
  </button>
);

export default App;
