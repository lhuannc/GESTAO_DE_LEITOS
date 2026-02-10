
import React, { useMemo, useState, useEffect } from 'react';
import { Bed, ServiceOrder, ServiceType, Step, BedStatusConfig, User } from '@gestao-leitos/types';
import { Layers, Clock, CheckCircle2, Circle, PlayCircle, Lock, AlertCircle, X, Hash, MapPin, User as UserIcon, Timer as TimerIcon, Package, Users as SilhouetteIcon } from 'lucide-react';

interface DashboardOperacionalProps {
  beds: Bed[];
  orders: ServiceOrder[];
  services: ServiceType[];
  steps: Step[];
  users: User[];
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

  const endTime = order.completedAt ? new Date(order.completedAt) : new Date();
  const startTime = new Date(order.createdAt);

  // Tempo total
  let totalDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  // Se não tem histórico, retorna o tempo total
  if (!order.history || !Array.isArray(order.history) || order.history.length === 0) {
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
  if (!order.history || !Array.isArray(order.history) || order.history.length === 0) {
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
  
  // Use completedAt, cancelledAt, or current time for ongoing orders
  const fim = order.completedAt 
    ? new Date(order.completedAt) 
    : order.cancelledAt 
      ? new Date(order.cancelledAt)
      : new Date(); // Use current time for real-time updates

  return (fim.getTime() - inicioPendente.getTime()) / (1000 * 60); // em minutos
};

const DashboardOperacional: React.FC<DashboardOperacionalProps> = ({ beds, orders, services, steps, users, bedStatusConfigs = [] }) => {
  const [selectedBed, setSelectedBed] = useState<{ bed: Bed; orders: ServiceOrder[] } | null>(null);
  const [selectedAction, setSelectedAction] = useState<ServiceOrder | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update timer every second for real-time duration updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
            service: services.find(s => s.id === firstOrder.serviceTypeId)
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

    const mergeGroups = (groupId1: number, groupId2: number) => {
      if (groupId1 === groupId2) return groupId1;
      const smaller = Math.min(groupId1, groupId2);
      const larger = Math.max(groupId1, groupId2);
      groups[larger].forEach(bedId => {
        groups[smaller].add(bedId);
        bedToGroupId.set(bedId, smaller);
      });
      groups[larger].clear();
      return smaller;
    };

    orders.forEach(order => {
      if (order.dependsOnOrderIds && order.dependsOnOrderIds.length > 0) {
        order.dependsOnOrderIds.forEach(depId => {
          const depOrder = orders.find(o => o.id === depId);
          if (depOrder && depOrder.bedId !== order.bedId) {
            const bed1 = order.bedId;
            const bed2 = depOrder.bedId;
            const group1 = bedToGroupId.get(bed1);
            const group2 = bedToGroupId.get(bed2);
            if (group1 !== undefined && group2 !== undefined) {
              mergeGroups(group1, group2);
            } else if (group1 !== undefined) {
              groups[group1].add(bed2);
              bedToGroupId.set(bed2, group1);
            } else if (group2 !== undefined) {
              groups[group2].add(bed1);
              bedToGroupId.set(bed1, group2);
            } else {
              const newGroupId = groups.length;
              groups.push(new Set([bed1, bed2]));
              bedToGroupId.set(bed1, newGroupId);
              bedToGroupId.set(bed2, newGroupId);
            }
          }
        });
      }
    });
    return groups.filter(g => g.size > 0);
  }, [orders]);

  // Combinar todos os leitos com agrupamento por dependências
  const todosLeitos = useMemo(() => {
    const allBeds = [...leitosComFluxos, ...leitosDisponiveis];
    const bedMap = new Map(allBeds.map(item => [item.bed.id, item]));
    const result: typeof allBeds = [];
    const processedBeds = new Set<string>();

    bedDependencyGroups.forEach((group) => {
      const groupBeds = Array.from(group)
        .map(bedId => bedMap.get(bedId))
        .filter((item): item is NonNullable<typeof item> => item !== undefined)
        .sort((a, b) => a.bed.name.localeCompare(b.bed.name));

      groupBeds.forEach(item => {
        result.push(item);
        processedBeds.add(item.bed.id);
      });
    });

    const remainingBeds = allBeds
      .filter(item => !processedBeds.has(item.bed.id))
      .sort((a, b) => a.bed.name.localeCompare(b.bed.name));

    result.push(...remainingBeds);
    return result;
  }, [leitosComFluxos, leitosDisponiveis, bedDependencyGroups]);

  // Pre-calculate data for items in groups to avoid heavy calculations in render
  // Recalculates every second due to 'now' dependency for real-time updates
  const processedOrdersData = useMemo(() => {
    const data: Record<string, { duration: number, formattedDuration: string, foraDoPrazo: boolean }> = {};

    orders.forEach(order => {
      const duration = calculateTimeFromPendingToCompletion(order);
      const formattedDuration = formatDuration(duration);
      const service = services.find(s => s.id === order.serviceTypeId);
      const subOrderConfig = service?.config?.subOrders?.find((so: any) => so.order === order.step);
      const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;
      const slaMinutes = step?.slaMinutes;
      const foraDoPrazo = !!(slaMinutes && duration > slaMinutes && order.status !== 'BLOQUEADO');
      data[order.id] = { duration, formattedDuration, foraDoPrazo };
    });

    return data;
  }, [orders, services, steps, now]); // Added 'now' to force recalculation every second

  // Index bed to group for O(1) lookup
  const bedToGroupMap = useMemo(() => {
    const map = new Map<string, number>();
    bedDependencyGroups.forEach((group, index) => {
      group.forEach(bedId => map.set(bedId, index));
    });
    return map;
  }, [bedDependencyGroups]);

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
                  const groupIndex = bedToGroupMap.get(item.bed.id) ?? null;
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
                              const preCalculated = processedOrdersData[order.id];
                              const { formattedDuration, foraDoPrazo } = preCalculated || { formattedDuration: '0 min', foraDoPrazo: false };

                              return (
                                <div key={order.id} className="flex items-center">
                                  <div
                                    className={`flex flex-col gap-0.5 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border-2 transition-all relative cursor-pointer hover:scale-105 ${foraDoPrazo ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 hover:bg-rose-100' :
                                        order.status === 'CONCLUIDO' ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' :
                                          order.status === 'EM_ANDAMENTO' ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-100 hover:bg-sky-100' :
                                            order.status === 'PENDENTE' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' :
                                              'bg-slate-50 border-slate-200 opacity-60 hover:opacity-80'
                                      }`}
                                    title={`${order.subServiceName}: ${order.status}${foraDoPrazo ? ' - FORA DO PRAZO' : ''}`}
                                    onClick={() => setSelectedAction(order)}
                                  >
                                    <div className="flex items-center gap-1 md:gap-1.5">
                                      {foraDoPrazo && <AlertCircle size={12} className="text-rose-600 shrink-0" />}
                                      {getStatusIcon(order.status)}
                                      <span className={`text-[10px] md:text-xs font-black uppercase whitespace-nowrap ${foraDoPrazo ? 'text-rose-700' :
                                          order.status === 'CONCLUIDO' ? 'text-emerald-700' :
                                            order.status === 'EM_ANDAMENTO' ? 'text-sky-700' :
                                              order.status === 'PENDENTE' ? 'text-amber-700' :
                                                'text-slate-400'
                                        }`}>
                                        {order.subServiceName || `Etapa ${idx + 1}`}
                                      </span>
                                    </div>
                                    <span className={`text-[8px] md:text-[9px] font-medium flex items-center gap-0.5 ${foraDoPrazo ? 'text-rose-600' :
                                        order.status === 'CONCLUIDO' ? 'text-emerald-600' :
                                          order.status === 'EM_ANDAMENTO' ? 'text-sky-600' :
                                            order.status === 'PENDENTE' ? 'text-amber-600' :
                                              'text-slate-400'
                                      }`}>
                                      <Clock size={8} />
                                      {formattedDuration}
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
                          const service = services.find(s => s.id === order.serviceTypeId);
                          const lastUpdate = order.history && Array.isArray(order.history) && order.history.length > 0
                            ? new Date(order.history[order.history.length - 1].timestamp)
                            : new Date(order.createdAt);
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
                                  <span className={`text-xs font-black uppercase ${order.status === 'CONCLUIDO' ? 'text-emerald-600' :
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

      {/* Action Details Modal (Read-Only) */}
      {selectedAction && (() => {
        const service = services.find(s => s.id === selectedAction.serviceTypeId);
        const bed = beds.find(b => b.id === selectedAction.bedId);
        const sector = bed ? null : null; // sectors not passed to this component

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col lg:flex-row h-[95vh] md:h-[90vh] lg:h-auto">

              {/* Sidebar */}
              <div className="bg-slate-900 lg:w-80 text-white p-4 md:p-6 lg:p-8 flex flex-col shrink-0 overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                  <span className="bg-sky-500 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                    <Hash size={10} /> {selectedAction.id.slice(-6)}
                  </span>
                </div>

                <h4 className="text-2xl font-black mb-1 leading-tight">{selectedAction.subServiceName || service?.name || 'Ação'}</h4>
                <p className="text-sky-400 font-bold text-sm flex items-center gap-2 mb-6"><MapPin size={14} /> {bed?.name || '-'}</p>

                <div className="space-y-6 flex-1">
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Ação</p>
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase ${selectedAction.status === 'CONCLUIDO' ? 'bg-emerald-500 text-white' :
                        selectedAction.status === 'EM_ANDAMENTO' ? 'bg-sky-500 text-white' :
                          selectedAction.status === 'PENDENTE' ? 'bg-amber-500 text-white' :
                            'bg-slate-500 text-white'
                      }`}>
                      {selectedAction.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tempo Decorrido</p>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-black text-white">{formatDuration(calculateTimeFromPendingToCompletion(selectedAction))}</span>
                      <TimerIcon size={16} className="text-sky-400 mb-1 animate-pulse" />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Executor Responsável</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-black text-sky-400 text-sm shrink-0 border border-slate-600">
                        {selectedAction.assignedToUserId ? users.find(u => u.id === selectedAction.assignedToUserId)?.name.charAt(0) : <SilhouetteIcon size={20} className="text-slate-500" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Atribuído a:</p>
                        <p className="text-xs font-bold truncate text-white">
                          {selectedAction.assignedToUserId ? users.find(u => u.id === selectedAction.assignedToUserId)?.name : 'Ninguém atribuído'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Serviço/Fluxo</p>
                    <p className="text-xs font-bold text-slate-100">
                      {service?.name || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-4 md:p-6 lg:p-8 bg-white flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto pr-2 md:pr-4 scrollbar-hide mb-4 md:mb-6 space-y-6">
                  <div>
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Informações da Ação</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data de Solicitação</p>
                        <p className="text-sm text-slate-700">
                          {new Date(selectedAction.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {selectedAction.completedAt && (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data de Conclusão</p>
                          <p className="text-sm text-slate-700">
                            {new Date(selectedAction.completedAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checklist de Insumos */}
                  <div>
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center space-x-2">
                      <Package size={16} className="text-sky-500" /> <span>Checklist de Insumos</span>
                    </h5>
                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Insumo</th>
                            <th className="px-6 py-4 text-center">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {(selectedAction.items || []).map((it, idx) => (
                            <tr key={idx} className="border-t border-slate-100 hover:bg-white transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-700 uppercase text-[10px]">{it.name}</td>
                              <td className="px-6 py-4 text-center font-black text-slate-500">{it.quantity}</td>
                            </tr>
                          ))}
                          {(!selectedAction.items || selectedAction.items.length === 0) && (
                            <tr><td colSpan={2} className="px-6 py-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">Nenhum item associado à OS</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Rastreabilidade de Execução */}
                  {selectedAction.history && Array.isArray(selectedAction.history) && selectedAction.history.length > 0 && (
                    <div>
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center space-x-2">
                        <Clock size={16} className="text-sky-500" /> <span>Rastreabilidade de Execução</span>
                      </h5>
                      <div className="space-y-1">
                        {selectedAction.history
                          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                          .map((h, i, arr) => {
                            const prevTime = i === 0 ? new Date(selectedAction.createdAt).getTime() : new Date(arr[i - 1].timestamp).getTime();
                            const diff = new Date(h.timestamp).getTime() - prevTime;
                            const isTooFast = diff < 60000 && diff > 0 && h.status === 'CONCLUIDO';

                            return (
                              <div key={i} className="relative pl-8 pb-4 border-l-2 border-slate-100 ml-2">
                                <div className={`absolute left-[-9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${h.status === 'CONCLUIDO' ? 'bg-emerald-500' :
                                    h.status === 'EM_ANDAMENTO' ? 'bg-sky-500' : 'bg-amber-500'
                                  }`} />
                                <div className="flex flex-col">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">{h.status.replace('_', ' ')}</span>
                                    <div className="flex items-center gap-2">
                                      {i > 0 && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm ${isTooFast ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                          {isTooFast && <TimerIcon size={10} className="animate-pulse" />}
                                          +{formatDuration(diff / 60000)}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-bold text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">{h.note || 'Evento de sistema'}</p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setSelectedAction(null)}
                    className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl transition-all text-sm uppercase tracking-wide"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default DashboardOperacional;
