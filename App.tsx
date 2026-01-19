
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, ClipboardPlus, Settings, Kanban, LogOut, Menu, X, Loader2, RefreshCw
} from 'lucide-react';
import { 
  Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, ServiceOrder, ViewType, Team, ComplementItem 
} from './types';
import Dashboard from './components/Dashboard';
import ServiceRequestForm from './components/ServiceRequestForm';
import ServiceOrdersKanban from './components/ServiceOrdersKanban';
import RegistrationManager from './components/RegistrationManager';
import Login from './components/Login';
import { db } from './backend';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [actions, setActions] = useState<ActionStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [complementItems, setComplementItems] = useState<ComplementItem[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const loadAllData = useCallback(async () => {
    setSyncing(true);
    const data = await db.getAllData();
    
    setCompanies((data.companies || []).filter(Boolean));
    setUnits((data.units || []).filter(Boolean));
    setSectors((data.sectors || []).filter(Boolean));
    setBeds((data.beds || []).filter(Boolean));
    setServices((data.services || []).filter(Boolean));
    setActions((data.actions || []).filter(Boolean));
    setUsers((data.users || []).filter(Boolean));
    setTeams((data.teams || []).filter(Boolean));
    setComplementItems((data.complementItems || []).filter(Boolean));
    setServiceOrders((data.orders || []).filter(Boolean));
    
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('higibed_session');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    loadAllData();
  }, [loadAllData]);

  // Verifica se o usuário pertence a alguma equipe
  const isUserMemberOfAnyTeam = useMemo(() => {
    if (!currentUser) return false;
    return teams.some(t => t.userIds.includes(currentUser.id));
  }, [teams, currentUser]);

  const canAccessKanban = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.permissions.isAdmin || isUserMemberOfAnyTeam;
  }, [currentUser, isUserMemberOfAnyTeam]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('higibed_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('higibed_session');
    setActiveView('DASHBOARD');
  };

  const handleUpdateOrder = async () => {
    setSyncing(true);
    await loadAllData();
  };

  const handleSaveRegistry = async (type: string, item: any) => {
    setSyncing(true);
    await db.saveRegistry(type, item);
    await loadAllData();
  };

  const handleDeleteRegistry = async (type: string, id: string) => {
    if(!confirm('Tem certeza que deseja excluir este registro?')) return;
    setSyncing(true);
    await db.deleteRegistry(type, id);
    await loadAllData();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Iniciando sistema...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col z-20 shadow-xl`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <h1 className={`font-bold text-xl text-sky-400 truncate transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>HigiBed</h1>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Menu size={20} /></button>
        </div>

        <nav className="flex-1 mt-6 space-y-2 px-3 overflow-y-auto scrollbar-hide">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'DASHBOARD'} collapsed={!isSidebarOpen} onClick={() => setActiveView('DASHBOARD')} />
          <SidebarItem icon={<ClipboardPlus size={20} />} label="Solicitar" active={activeView === 'SOLICITAR'} collapsed={!isSidebarOpen} onClick={() => setActiveView('SOLICITAR')} />
          
          {canAccessKanban && (
            <SidebarItem icon={<Kanban size={20} />} label="Ordens" active={activeView === 'ORDENS'} collapsed={!isSidebarOpen} onClick={() => setActiveView('ORDENS')} />
          )}

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
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 relative">
          {syncing && <div className="absolute top-4 right-8 z-30 flex items-center space-x-2 bg-white/80 px-3 py-1 rounded-full border border-sky-100 shadow-sm"><RefreshCw className="w-3 h-3 text-sky-500 animate-spin" /></div>}
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-full p-6">
            {activeView === 'DASHBOARD' && <Dashboard beds={beds} orders={serviceOrders} users={users} services={services} />}
            {activeView === 'SOLICITAR' && <ServiceRequestForm beds={beds} services={services} actions={actions} currentUser={currentUser} onSuccess={async () => { await loadAllData(); setActiveView('DASHBOARD'); }} />}
            {activeView === 'ORDENS' && canAccessKanban && <ServiceOrdersKanban orders={serviceOrders} services={services} actions={actions} beds={beds} currentUser={currentUser} teams={teams} users={users} onUpdateOrder={handleUpdateOrder} onCompleteOrder={() => loadAllData()} />}
            {activeView === 'CADASTROS' && currentUser.permissions.isAdmin && (
              <RegistrationManager 
                currentUser={currentUser} companies={companies} units={units} sectors={sectors} beds={beds} services={services} actions={actions} users={users} teams={teams} complementItems={complementItems}
                onSave={handleSaveRegistry} onDelete={handleDeleteRegistry}
              />
            )}
          </div>
        </main>
      </div>
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
