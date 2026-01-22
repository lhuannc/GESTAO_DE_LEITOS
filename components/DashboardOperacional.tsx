
import React, { useMemo } from 'react';
import { Bed, ServiceOrder, ServiceType, Step } from '../types';
import { Layers, Clock, CheckCircle2, Circle, PlayCircle, Lock, AlertCircle } from 'lucide-react';

interface DashboardOperacionalProps {
  beds: Bed[];
  orders: ServiceOrder[];
  services: ServiceType[];
  steps: Step[];
}

// Função auxiliar para calcular tempo entre duas datas em minutos
const calculateDuration = (start: string | undefined, end: string | undefined): number => {
  if (!start) return 0;
  const endDate = end ? new Date(end) : new Date();
  const startDate = new Date(start);
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60); // em minutos
};

// Função para calcular tempo total excluindo períodos bloqueados
const calculateDurationExcludingBlocked = (order: ServiceOrder): number => {
  if (!order.requestedAt) return 0;
  
  const endTime = order.finishedAt ? new Date(order.finishedAt) : new Date();
  const startTime = new Date(order.requestedAt);
  
  // Tempo total
  let totalDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  
  // Se não tem histórico, retorna o tempo total
  if (!order.history || order.history.length === 0) {
    return totalDuration;
  }
  
  // Ordenar histórico por timestamp
  const sortedHistory = [...order.history].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Calcular tempo total bloqueado
  let blockedDuration = 0;
  
  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];
    
    // Se o status atual é BLOQUEADO, adicionar o tempo até a próxima mudança
    if (current.status === 'BLOQUEADO') {
      const blockedStart = new Date(current.timestamp);
      const blockedEnd = new Date(next.timestamp);
      blockedDuration += (blockedEnd.getTime() - blockedStart.getTime()) / (1000 * 60);
    }
  }
  
  // Verificar último status (se ainda está bloqueado)
  if (sortedHistory.length > 0) {
    const lastStatus = sortedHistory[sortedHistory.length - 1];
    if (lastStatus.status === 'BLOQUEADO') {
      const blockedStart = new Date(lastStatus.timestamp);
      blockedDuration += (endTime.getTime() - blockedStart.getTime()) / (1000 * 60);
    }
  }
  
  // Retornar tempo total menos tempo bloqueado
  return Math.max(0, totalDuration - blockedDuration);
};

// Função auxiliar para formatar tempo em minutos para string legível
const formatDuration = (minutes: number): string => {
  if (isNaN(minutes) || minutes === 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${mins}min`;
};

// Função para calcular tempo desde início do pendente até conclusão
const calculateTimeFromPendingToCompletion = (order: ServiceOrder): number => {
  if (!order.history || order.history.length === 0) {
    return 0;
  }

  // Ordenar histórico por timestamp
  const sortedHistory = [...order.history].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Encontrar primeiro momento em PENDENTE
  const primeiroPendente = sortedHistory.find(h => h.status === 'PENDENTE');
  if (!primeiroPendente) return 0;

  const inicioPendente = new Date(primeiroPendente.timestamp);
  const fim = order.finishedAt ? new Date(order.finishedAt) : new Date();
  
  return (fim.getTime() - inicioPendente.getTime()) / (1000 * 60); // em minutos
};

const DashboardOperacional: React.FC<DashboardOperacionalProps> = ({ beds, orders, services, steps }) => {
  // Agrupar ordens por groupId e leito
  const leitosComFluxos = useMemo(() => {
    // Agrupar ordens por groupId
    const groups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!groups[order.groupId]) groups[order.groupId] = [];
      groups[order.groupId].push(order);
    });

    // Encontrar fluxos com etapas pendentes/finalização (não completamente concluídos)
    const fluxosAtivos = Object.values(groups).filter(group => {
      return group.some(order => order.status !== 'CONCLUIDO');
    });

    // Criar mapa de leitos com seus fluxos ativos
    const leitosMap: Record<string, {
      bed: Bed;
      group: ServiceOrder[];
      service: ServiceType | undefined;
    }> = {};

    fluxosAtivos.forEach(group => {
      const firstOrder = group.sort((a, b) => a.step - b.step)[0];
      const bedId = firstOrder.bedId;
      
      if (!leitosMap[bedId]) {
        const bed = beds.find(b => b.id === bedId);
        if (bed) {
          leitosMap[bedId] = {
            bed,
            group: group.sort((a, b) => a.step - b.step),
            service: services.find(s => s.id === firstOrder.serviceId)
          };
        }
      }
    });

    return Object.values(leitosMap);
  }, [beds, orders, services]);

  // Leitos sem fluxos ativos (disponíveis)
  const leitosDisponiveis = useMemo(() => {
    const leitosComFluxoIds = new Set(leitosComFluxos.map(l => l.bed.id));
    return beds
      .filter(bed => !leitosComFluxoIds.has(bed.id))
      .map(bed => ({
        bed,
        group: [] as ServiceOrder[],
        service: undefined as ServiceType | undefined
      }));
  }, [beds, leitosComFluxos]);

  // Combinar todos os leitos
  const todosLeitos = useMemo(() => {
    return [...leitosComFluxos, ...leitosDisponiveis].sort((a, b) => 
      a.bed.name.localeCompare(b.bed.name)
    );
  }, [leitosComFluxos, leitosDisponiveis]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONCLUIDO': return <CheckCircle2 size={12} className="text-emerald-500" />;
      case 'EM_ANDAMENTO': return <PlayCircle size={12} className="text-sky-500 animate-pulse" />;
      case 'PENDENTE': return <Circle size={12} className="text-amber-500" />;
      case 'BLOQUEADO': return <Lock size={12} className="text-slate-300" />;
      default: return null;
    }
  };

  const BED_STATUS_COLORS: Record<string, string> = {
    DISPONIVEL: 'bg-emerald-500',
    OCUPADO: 'bg-rose-500',
    HIGIENIZACAO: 'bg-amber-500',
    MANUTENCAO: 'bg-slate-500',
    AGUARDANDO_ALTA: 'bg-sky-500'
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-4 md:p-6 lg:p-8 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 md:mb-8">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers size={14} className="text-sky-500" /> Leitos - Dashboard Operacional
          </h4>
          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
            Total: {todosLeitos.length} Leitos
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 md:-mx-8">
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-slate-50 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="w-32 px-2 md:px-3 py-2 md:py-2.5">Nome do Leito</th>
                <th className="w-64 px-3 md:px-4 py-2 md:py-2.5">Serviço</th>
                <th className="px-3 md:px-6 py-2 md:py-2.5">Fluxo de Etapas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todosLeitos.map((item) => {
                return (
                  <tr key={item.bed.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="w-32 px-2 md:px-3 py-2 md:py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${BED_STATUS_COLORS[item.bed.status]}`} />
                        <span className="text-xs md:text-sm font-black text-slate-800 uppercase whitespace-nowrap">{item.bed.name}</span>
                      </div>
                    </td>
                    <td className="w-64 px-3 md:px-4 py-2 md:py-3">
                      {item.service ? (
                        <span className="text-[11px] md:text-sm font-bold text-slate-800 break-words">{item.service.name}</span>
                      ) : (
                        <span className="text-[10px] md:text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-2 md:py-3">
                      {item.group.length > 0 ? (
                        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                          {item.group.map((order, idx) => {
                            // Buscar o stepId através do service e do número da etapa (order.step)
                            const service = services.find(s => s.id === order.serviceId);
                            const subOrderConfig = service?.config?.subOrders?.[order.step];
                            const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;
                            
                            // Calcular tempo desde início do pendente até conclusão (ou agora)
                            const tempoDesdePendente = calculateTimeFromPendingToCompletion(order);
                            const tempoFormatado = formatDuration(tempoDesdePendente);
                            
                            // Verificar se excedeu SLA
                            const slaMinutes = step?.slaMinutes;
                            const foraDoPrazo = slaMinutes && tempoDesdePendente > slaMinutes && order.status !== 'BLOQUEADO';
                            
                            return (
                              <div key={order.id} className="flex items-center">
                                <div 
                                  className={`flex flex-col gap-0.5 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border-2 transition-all relative ${
                                    foraDoPrazo ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' :
                                    order.status === 'CONCLUIDO' ? 'bg-emerald-50 border-emerald-200' :
                                    order.status === 'EM_ANDAMENTO' ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-100' :
                                    order.status === 'PENDENTE' ? 'bg-amber-50 border-amber-200' :
                                    'bg-slate-50 border-slate-200 opacity-60'
                                  }`}
                                  title={`${order.subServiceName}: ${order.status}${foraDoPrazo ? ' - FORA DO PRAZO' : ''}`}
                                >
                                  <div className="flex items-center gap-1 md:gap-1.5">
                                    {foraDoPrazo && <AlertCircle size={12} className="text-rose-600 shrink-0" />}
                                    {getStatusIcon(order.status)}
                                    <span className={`text-[10px] md:text-xs font-black uppercase whitespace-nowrap ${
                                      foraDoPrazo ? 'text-rose-700' :
                                      order.status === 'CONCLUIDO' ? 'text-emerald-700' :
                                      order.status === 'EM_ANDAMENTO' ? 'text-sky-700' :
                                      order.status === 'PENDENTE' ? 'text-amber-700' :
                                      'text-slate-400'
                                    }`}>
                                      {order.subServiceName || `Etapa ${idx + 1}`}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] md:text-[9px] font-medium flex items-center gap-0.5 ${
                                    foraDoPrazo ? 'text-rose-600' :
                                    order.status === 'CONCLUIDO' ? 'text-emerald-600' :
                                    order.status === 'EM_ANDAMENTO' ? 'text-sky-600' :
                                    order.status === 'PENDENTE' ? 'text-amber-600' :
                                    'text-slate-400'
                                  }`}>
                                    <Clock size={8} />
                                    {tempoFormatado}
                                    {foraDoPrazo && <span className="ml-1 font-black">FORA DO PRAZO</span>}
                                  </span>
                                </div>
                                {idx < item.group.length - 1 && (
                                  <div className="w-2 h-0.5 bg-slate-200 mx-1 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[10px] md:text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {todosLeitos.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 md:px-8 py-12 md:py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                      <Layers size={32} className="md:w-10 md:h-10" />
                      <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Nenhum leito cadastrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardOperacional;
