
import React, { useMemo, useState } from 'react';
import { Bed, ServiceOrder, ServiceType, Step, BedStatusConfig } from '../types';
import { Layers, Clock, CheckCircle2, Circle, PlayCircle, Lock, AlertCircle, X } from 'lucide-react';

interface DashboardOperacionalProps {
  beds: Bed[];
  orders: ServiceOrder[];
  services: ServiceType[];
  steps: Step[];
  bedStatusConfigs?: BedStatusConfig[];
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

const DashboardOperacional: React.FC<DashboardOperacionalProps> = ({ beds, orders, services, steps, bedStatusConfigs = [] }) => {
  const [selectedBed, setSelectedBed] = useState<{ bed: Bed; orders: ServiceOrder[] } | null>(null);
  
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

  // Build dependency groups for beds with cross-bed dependencies
  const bedDependencyGroups = useMemo(() => {
    const bedToGroupId = new Map<string, number>();
    const groups: Set<string>[] = [];
    
    // Helper to merge two groups
    const mergeGroups = (groupId1: number, groupId2: number) => {
      if (groupId1 === groupId2) return groupId1;
      const smaller = Math.min(groupId1, groupId2);
      const larger = Math.max(groupId1, groupId2);
      
      // Merge larger into smaller
      groups[larger].forEach(bedId => {
        groups[smaller].add(bedId);
        bedToGroupId.set(bedId, smaller);
      });
      groups[larger].clear();
      
      return smaller;
    };
    
    // Find all cross-bed dependencies
    orders.forEach(order => {
      if (order.dependsOnOrderIds && order.dependsOnOrderIds.length > 0) {
        order.dependsOnOrderIds.forEach(depId => {
          const depOrder = orders.find(o => o.id === depId);
          if (depOrder && depOrder.bedId !== order.bedId) {
            // Cross-bed dependency found
            const bed1 = order.bedId;
            const bed2 = depOrder.bedId;
            
            const group1 = bedToGroupId.get(bed1);
            const group2 = bedToGroupId.get(bed2);
            
            if (group1 !== undefined && group2 !== undefined) {
              // Both beds already in groups, merge them
              mergeGroups(group1, group2);
            } else if (group1 !== undefined) {
              // bed1 in group, add bed2
              groups[group1].add(bed2);
              bedToGroupId.set(bed2, group1);
            } else if (group2 !== undefined) {
              // bed2 in group, add bed1
              groups[group2].add(bed1);
              bedToGroupId.set(bed1, group2);
            } else {
              // Neither in a group, create new group
              const newGroupId = groups.length;
              groups.push(new Set([bed1, bed2]));
              bedToGroupId.set(bed1, newGroupId);
              bedToGroupId.set(bed2, newGroupId);
            }
          }
        });
      }
    });
    
    // Return only non-empty groups
    return groups.filter(g => g.size > 0);
  }, [orders]);

  // Combinar todos os leitos com agrupamento por dependências
  const todosLeitos = useMemo(() => {
    const allBeds = [...leitosComFluxos, ...leitosDisponiveis];
    const bedMap = new Map(allBeds.map(item => [item.bed.id, item]));
    const result: typeof allBeds = [];
    const processedBeds = new Set<string>();
    
    // First, add grouped beds
    bedDependencyGroups.forEach((group, groupIndex) => {
      const groupBeds = Array.from(group)
        .map(bedId => bedMap.get(bedId))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
        .sort((a, b) => a.bed.name.localeCompare(b.bed.name));
      
      groupBeds.forEach(item => {
        result.push(item);
        processedBeds.add(item.bed.id);
      });
    });
    
    // Then add remaining beds alphabetically
    const remainingBeds = allBeds
      .filter(item => !processedBeds.has(item.bed.id))
      .sort((a, b) => a.bed.name.localeCompare(b.bed.name));
    
    result.push(...remainingBeds);
    
    return result;
  }, [leitosComFluxos, leitosDisponiveis, bedDependencyGroups]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONCLUIDO': return <CheckCircle2 size={12} className="text-emerald-500" />;
      case 'EM_ANDAMENTO': return <PlayCircle size={12} className="text-sky-500 animate-pulse" />;
      case 'PENDENTE': return <Circle size={12} className="text-amber-500" />;
      case 'BLOQUEADO': return <Lock size={12} className="text-slate-300" />;
      default: return null;
    }
  };

  const getBedStatusColor = (status: string) => {
    const config = bedStatusConfigs.find(c => c.id === status);
    return config?.color || 'bg-slate-500';
  };

  // Helper to get group index for a bed
  const getBedGroupIndex = (bedId: string): number | null => {
    for (let i = 0; i < bedDependencyGroups.length; i++) {
      if (bedDependencyGroups[i].has(bedId)) return i;
    }
    return null;
  };

  // Color palette for dependency groups
  const groupColors = [
    { border: 'border-l-sky-400', bg: 'bg-sky-50/30' },
    { border: 'border-l-purple-400', bg: 'bg-purple-50/30' },
    { border: 'border-l-emerald-400', bg: 'bg-emerald-50/30' },
    { border: 'border-l-orange-400', bg: 'bg-orange-50/30' },
    { border: 'border-l-pink-400', bg: 'bg-pink-50/30' },
    { border: 'border-l-indigo-400', bg: 'bg-indigo-50/30' },
  ];

  return (
    <>
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
                <th className="px-3 md:px-6 py-2 md:py-2.5">Fluxo de Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todosLeitos.map((item, index) => {
                const groupIndex = getBedGroupIndex(item.bed.id);
                const groupStyle = groupIndex !== null ? groupColors[groupIndex % groupColors.length] : null;
                
                // Determine position in group
                let positionInGroup: 'single' | 'first' | 'middle' | 'last' = 'single';
                if (groupIndex !== null) {
                  const group = bedDependencyGroups[groupIndex];
                  const groupBeds = todosLeitos.filter(l => group.has(l.bed.id));
                  const posInGroup = groupBeds.findIndex(l => l.bed.id === item.bed.id);
                  
                  if (groupBeds.length > 1) {
                    if (posInGroup === 0) positionInGroup = 'first';
                    else if (posInGroup === groupBeds.length - 1) positionInGroup = 'last';
                    else positionInGroup = 'middle';
                  }
                }
                
                return (
                  <tr 
                    key={item.bed.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="w-32 px-2 md:px-3 py-2 md:py-3 cursor-pointer" title={`Status: ${item.bed.status}`} onClick={() => {
                      const bedOrders = orders.filter(o => o.bedId === item.bed.id);
                      setSelectedBed({ bed: item.bed, orders: bedOrders });
                    }}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${getBedStatusColor(item.bed.status)}`} />
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

    {/* Bed Details Modal */}
    {selectedBed && (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
          {/* Modal Header */}
          <div className="bg-slate-900 text-white p-4 md:p-6 flex justify-between items-center">
            <div>
              <h3 className="text-xl md:text-2xl font-black mb-1">{selectedBed.bed.name}</h3>
              <p className="text-sm text-slate-400">Detalhes das Ordens de Serviço</p>
            </div>
            <button
              onClick={() => setSelectedBed(null)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {selectedBed.orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      <th className="px-3 py-3">Nome do Serviço</th>
                      <th className="px-3 py-3">ID da Ação</th>
                      <th className="px-3 py-3">Nome da Ação</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Última Atualização</th>
                      <th className="px-3 py-3">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBed.orders
                      .sort((a, b) => a.step - b.step)
                      .map((order) => {
                        const service = services.find(s => s.id === order.serviceId);
                        const lastUpdate = order.history && order.history.length > 0
                          ? new Date(order.history[order.history.length - 1].timestamp)
                          : new Date(order.requestedAt);
                        const duration = calculateTimeFromPendingToCompletion(order);
                        
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-3 text-xs md:text-sm font-bold text-slate-800">
                              {service?.name || 'N/A'}
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-slate-500">
                              #{order.id.slice(-6)}
                            </td>
                            <td className="px-3 py-3 text-xs md:text-sm font-bold text-slate-700">
                              {order.subServiceName || `Ação ${order.step + 1}`}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(order.status)}
                                <span className={`text-xs font-black uppercase ${
                                  order.status === 'CONCLUIDO' ? 'text-emerald-600' :
                                  order.status === 'EM_ANDAMENTO' ? 'text-sky-600' :
                                  order.status === 'PENDENTE' ? 'text-amber-600' :
                                  'text-slate-400'
                                }`}>
                                  {order.status.replace('_', ' ')}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-600">
                              {lastUpdate.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-3 py-3 text-xs font-bold text-slate-700">
                              {formatDuration(duration)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Layers size={48} className="mb-4 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhuma ordem encontrada para este leito</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default DashboardOperacional;
