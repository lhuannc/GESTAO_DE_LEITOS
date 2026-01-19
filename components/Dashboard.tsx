
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Bed, ServiceOrder, User, BedStatus, OSStatus, ServiceType } from '../types';
import { Hash, Bed as BedIcon, Settings, Layers, Clock, CheckCircle2, Circle, PlayCircle, Lock } from 'lucide-react';

interface DashboardProps {
  beds: Bed[];
  orders: ServiceOrder[];
  users: User[];
  services: ServiceType[];
}

const Dashboard: React.FC<DashboardProps> = ({ beds, orders, users, services }) => {
  const bedStats = useMemo(() => {
    const counts: Record<BedStatus, number> = {
      DISPONIVEL: 0,
      OCUPADO: 0,
      HIGIENIZACAO: 0,
      MANUTENCAO: 0,
      AGUARDANDO_ALTA: 0
    };
    beds.forEach(bed => {
      counts[bed.status]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [beds]);

  const osStats = useMemo(() => {
    const counts: Record<OSStatus, number> = {
      BLOQUEADO: 0,
      PENDENTE: 0,
      EM_ANDAMENTO: 0,
      CONCLUIDO: 0
    };
    orders.forEach(o => {
      counts[o.status]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // Agrupa ordens por groupId para mostrar o progresso do fluxo
  const orderGroups = useMemo(() => {
    const groups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!groups[order.groupId]) groups[order.groupId] = [];
      groups[order.groupId].push(order);
    });
    
    return Object.values(groups)
      .map(group => group.sort((a, b) => a.step - b.step))
      .sort((a, b) => new Date(b[0].requestedAt).getTime() - new Date(a[0].requestedAt).getTime());
  }, [orders]);

  const COLORS = {
    DISPONIVEL: '#10b981',
    OCUPADO: '#f43f5e',
    HIGIENIZACAO: '#f59e0b',
    MANUTENCAO: '#64748b',
    AGUARDANDO_ALTA: '#0ea5e9',
    BLOQUEADO: '#94a3b8',
    PENDENTE: '#fbbf24',
    EM_ANDAMENTO: '#38bdf8',
    CONCLUIDO: '#34d399'
  };

  const getStatusIcon = (status: OSStatus) => {
    switch (status) {
      case 'CONCLUIDO': return <CheckCircle2 size={12} className="text-emerald-500" />;
      case 'EM_ANDAMENTO': return <PlayCircle size={12} className="text-sky-500 animate-pulse" />;
      case 'PENDENTE': return <Circle size={12} className="text-amber-500" />;
      case 'BLOQUEADO': return <Lock size={12} className="text-slate-300" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Resumo de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {osStats.map((stat) => (
          <div key={stat.name} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.name.replace('_', ' ')}</p>
              <h3 className="text-3xl font-black text-slate-800">{stat.value}</h3>
            </div>
            <div className={`w-3 h-12 rounded-full ${COLORS[stat.name as keyof typeof COLORS]}`} />
          </div>
        ))}
      </div>

      {/* Gráficos e Lista Detalhada */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
            <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
              <PieChart size={14} className="text-sky-500" /> Ocupação Geral
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bedStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {bedStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lista de Ordens Detalhada Requisitada */}
        <div className="xl:col-span-2 bg-white p-8 border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers size={14} className="text-sky-500" /> Últimas Solicitações de Fluxo
            </h4>
            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
              Total: {orderGroups.length} Processos
            </span>
          </div>

          <div className="overflow-x-auto -mx-8">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-4"># Número</th>
                  <th className="px-8 py-4">Leito</th>
                  <th className="px-8 py-4">Serviço</th>
                  <th className="px-8 py-4">Etapas do Fluxo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderGroups.slice(0, 10).map((group) => {
                  const firstOrder = group[0];
                  const bed = beds.find(b => b.id === firstOrder.bedId);
                  const service = services.find(s => s.id === firstOrder.serviceId);
                  
                  return (
                    <tr key={firstOrder.groupId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded shadow-sm group-hover:bg-sky-600 transition-colors">
                          {firstOrder.groupId.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${BED_STATUS_COLORS[bed?.status || 'DISPONIVEL']}`} />
                          <span className="text-xs font-black text-slate-700 uppercase">{bed?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{service?.name || 'Fluxo Manual'}</span>
                          <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                            <Clock size={10} /> {new Date(firstOrder.requestedAt).toLocaleDateString()} às {new Date(firstOrder.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-1">
                          {group.map((order, idx) => (
                            <div key={order.id} className="flex items-center">
                              <div 
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase transition-all ${
                                  order.status === 'CONCLUIDO' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                  order.status === 'EM_ANDAMENTO' ? 'bg-sky-50 border-sky-100 text-sky-600 ring-2 ring-sky-50' :
                                  order.status === 'PENDENTE' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                  'bg-slate-50 border-slate-100 text-slate-300 opacity-60'
                                }`}
                                title={`${order.subServiceName}: ${order.status}`}
                              >
                                {getStatusIcon(order.status)}
                                <span className="max-w-[80px] truncate">{order.subServiceName || `Etapa ${idx + 1}`}</span>
                              </div>
                              {idx < group.length - 1 && (
                                <div className="w-2 h-0.5 bg-slate-100 mx-0.5 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orderGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                        <Layers size={40} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma ordem solicitada recentemente</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {orderGroups.length > 0 && (
            <div className="mt-auto pt-6 border-t border-slate-50 text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Exibindo as {Math.min(10, orderGroups.length)} solicitações mais recentes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BED_STATUS_COLORS: Record<BedStatus, string> = {
  DISPONIVEL: 'bg-emerald-500',
  OCUPADO: 'bg-rose-500',
  HIGIENIZACAO: 'bg-amber-500',
  MANUTENCAO: 'bg-slate-500',
  AGUARDANDO_ALTA: 'bg-sky-500'
};

export default Dashboard;
