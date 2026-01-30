
import React, { useState, useMemo } from 'react';
import { Bed, ServiceType, ActionStatus, User, ServiceOrder, ComplementItem, Step } from '@gestao-leitos/types';
import { ClipboardCheck, ArrowRight, Layers, Package, Plus, Minus, DollarSign, AlertCircle, Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { trpc } from '../lib/trpc';

interface ServiceRequestFormProps {
  beds: Bed[];
  services: ServiceType[];
  actions: ActionStatus[];
  currentUser: User;
  steps?: Step[];
  onSuccess: () => void;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({
  beds,
  services,
  currentUser,
  steps = [],
  onSuccess
}) => {
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [notes, setNotes] = useState('');

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      onSuccess();
      // Reset form
      setSelectedBedId('');
      setSelectedServiceId('');
      setNotes('');
    },
    onError: (error) => {
      alert(`Erro ao criar solicitação: ${error.message}`);
    },
  });

  // For now, simplified version without complement items and dependencies
  // TODO: Implement full version with steps, items, and dependencies
  const { data: fetchedComplementItems } = trpc.complementItems.list.useQuery();
  const [complementItems, setComplementItems] = useState<ComplementItem[]>([]);

  React.useEffect(() => {
    if (fetchedComplementItems) {
      setComplementItems(fetchedComplementItems);
    }
  }, [fetchedComplementItems]);

  const [selectedItemsPerStep, setSelectedItemsPerStep] = useState<Record<number, Record<string, number>>>({});
  const [dependencies, setDependencies] = useState<Record<number, {
    bedId: string;
    flowId: string;
    actionId: string;
    type: 'BLOQUEADA' | 'BLOQUEADOR';
  }>>({});
  const [showDependency, setShowDependency] = useState<Record<number, boolean>>({});

  const { data: ordersList } = trpc.orders.list.useQuery({
    limit: 100,
  });

  const [activeOrders, setActiveOrders] = useState<ServiceOrder[]>([]);

  React.useEffect(() => {
    if (ordersList) {
      // Filter out completed/cancelled if needed, but the list might contain them.
      // Usually we want active ones for blocking.
      setActiveOrders(ordersList.filter((o: any) => o.status !== 'CONCLUIDO' && o.status !== 'CANCELADO') as any);
    }
  }, [ordersList]);

  const [activeSteps, setActiveSteps] = useState<Set<number>>(new Set());

  const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);

  const serviceSteps = useMemo(() => {
    if (!selectedService || !selectedService.generateMultipleOS) return [];
    return steps.filter(s => s.serviceTypeId === selectedServiceId).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [selectedService, selectedServiceId, steps]);

  // Determine effective steps from config OR steps relation
  const effectiveSteps = useMemo(() => {
    if (!selectedService) return [];

    // Priority 1: Config subOrders
    if (selectedService.config?.subOrders && Array.isArray(selectedService.config.subOrders) && selectedService.config.subOrders.length > 0) {
      return selectedService.config.subOrders;
    }

    // Priority 2: Service Steps (DB relation)
    if (serviceSteps.length > 0) {
      return serviceSteps.map(s => ({
        stepId: s.id,
        name: s.name,
        targetTeamId: s.targetTeamId,
        allowedItemIds: s.allowedItemIds,
        bedStatusConfig: undefined
      }));
    }

    // Default: Single generic step
    return [{ name: 'Atendimento Geral', allowedItemIds: [] }];
  }, [selectedService, serviceSteps]);



  // Inicializar etapas ativas quando um serviço é selecionado
  React.useEffect(() => {
    if (selectedService) {
      // Initialize active steps based on effective list
      setActiveSteps(new Set(effectiveSteps.map((_, idx) => idx)));

      // Limpar seleções de itens ao trocar de serviço
      setSelectedItemsPerStep({});
      setDependencies({});
      setShowDependency({});
    } else {
      setActiveSteps(new Set());
    }
  }, [selectedServiceId, effectiveSteps]);

  // Alternar etapa ativa/inativa
  const toggleStep = (stepIdx: number) => {
    const isCurrentlyActive = activeSteps.has(stepIdx);

    if (isCurrentlyActive) {
      // Remover
      setActiveSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(stepIdx);
        return newSet;
      });
      // Limpar estados relacionados
      setSelectedItemsPerStep(prev => {
        const newItems = { ...prev };
        delete newItems[stepIdx];
        return newItems;
      });
      setDependencies(prev => {
        const newDeps = { ...prev };
        delete newDeps[stepIdx];
        return newDeps;
      });
      setShowDependency(prev => {
        const next = { ...prev };
        delete next[stepIdx];
        return next;
      });
    } else {
      // Adicionar
      setActiveSteps(prev => {
        const newSet = new Set(prev);
        newSet.add(stepIdx);
        return newSet;
      });
    }
  };

  // Atualizar quantidade de item (limitado a 1 por etapa)
  const updateItemQuantity = (stepIdx: number, itemId: string, delta: number) => {
    setSelectedItemsPerStep(prev => {
      const stepData = { ...(prev[stepIdx] || {}) };
      const currentQty = stepData[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);

      if (newQty === 0) {
        delete stepData[itemId];
      } else {
        // NOVA REGRA: Apenas 1 insumo por etapa
        // Se está adicionando um item, remove todos os outros da mesma etapa
        if (delta > 0 && newQty > 0) {
          // Limpar todos os outros itens desta etapa e manter apenas este
          const newStepData: Record<string, number> = { [itemId]: 1 };
          return { ...prev, [stepIdx]: newStepData };
        } else {
          stepData[itemId] = newQty;
        }
      }

      return { ...prev, [stepIdx]: stepData };
    });
  };

  // Validação: Pelo menos um item por etapa ATIVA
  const validation = useMemo(() => {
    if (!selectedService) return { isValid: false, missingSteps: [] };

    const steps = selectedService.config?.subOrders || [{ name: 'Atendimento Geral', allowedItemIds: [] }];
    const missingSteps: number[] = [];

    // Validar apenas etapas ativas
    activeSteps.forEach(stepIdx => {
      const itemsInStep = Object.keys(selectedItemsPerStep[stepIdx] || {}).length;
      if (itemsInStep === 0) {
        missingSteps.push(stepIdx);
      }
    });

    // Deve ter pelo menos uma etapa ativa
    const hasActiveSteps = activeSteps.size > 0;

    return {
      isValid: missingSteps.length === 0 && selectedBedId !== '' && selectedServiceId !== '' && hasActiveSteps,
      missingSteps
    };
  }, [selectedService, selectedItemsPerStep, selectedBedId, selectedServiceId, activeSteps]);

  const totalCost = useMemo(() => {
    let total = 0;
    Object.entries(selectedItemsPerStep).forEach(([stepIdx, items]) => {
      Object.entries(items).forEach(([itemId, qty]) => {
        const item = complementItems.find(i => i.id === itemId);
        if (item) total += (item.unitCost * qty);
      });
    });
    return total;
  }, [selectedItemsPerStep, complementItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || createOrderMutation.isPending) return;

    const selectedStepsData = Array.from(activeSteps).map(stepIdx => {
      const stepItems = Object.entries(selectedItemsPerStep[stepIdx] || {}).map(([itemId, qty]) => {
        const item = complementItems.find(i => i.id === itemId);
        return {
          itemId,
          name: item?.name || 'Item',
          quantity: qty,
          unitCost: item?.unitCost || 0,
        };
      });

      return {
        stepIdx,
        items: stepItems,
        dependency: dependencies[stepIdx],
      };
    });

    createOrderMutation.mutate({
      bedId: selectedBedId,
      serviceTypeId: selectedServiceId,
      notes: notes || undefined,
      priority: 0,
      selectedSteps: selectedStepsData,
    });
  };

  const availableBeds = beds.filter(b => b.status !== 'HIGIENIZACAO');

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-6 lg:py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-100 text-sky-600 rounded-lg">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Nova Solicitação de Fluxo</h3>
            <p className="text-slate-500 text-sm">Escolha quais ações incluir e selecione 1 insumo por ação.</p>
          </div>
        </div>


      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Leito</label>
            <select
              required
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-shadow text-sm font-bold"
            >
              <option value="">Escolha um leito disponível...</option>
              {availableBeds.map(bed => (
                <option key={bed.id} value={bed.id}>
                  {bed.name} ({bed.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Serviço / Fluxo</label>
            <div className="grid grid-cols-1 gap-3">
              {services.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setSelectedItemsPerStep({});
                  }}
                  className={`p-4 border text-left rounded-2xl transition-all ${selectedServiceId === service.id
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100'
                    : 'border-slate-200 hover:border-sky-300 bg-white shadow-sm'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-black uppercase text-xs ${selectedServiceId === service.id ? 'text-sky-700' : 'text-slate-700'}`}>
                      {service.name}
                    </span>
                    {service.config?.generateMultipleOS && (
                      <span className="flex items-center space-x-1 bg-white border border-sky-100 text-sky-600 text-[9px] px-2 py-0.5 rounded-full font-black uppercase shadow-sm">
                        <Layers size={10} /> <span>{service.config.subOrders?.length} Ações</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedService && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Package size={14} /> Itens por Ação
                </h4>
                {validation.missingSteps.length > 0 && (
                  <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-bounce">
                    Escolha obrigatória pendente
                  </span>
                )}
              </div>

              {/* Seção de Insumos */}
              {effectiveSteps.map((sub: any, idx: number) => {
                // Buscar dados da etapa se stepId estiver presente
                const step = sub.stepId ? steps.find(s => s.id === sub.stepId) : null;
                const stepName = step?.name || sub.name || `Ação ${idx + 1}`;
                const stepItemIds = step?.allowedItemIds || sub.allowedItemIds || [];

                const allowedItems = complementItems.filter(item => stepItemIds.includes(item.id));
                const isMissing = validation.missingSteps.includes(idx);
                const isActive = activeSteps.has(idx);

                return (
                  <div key={idx} className={`border rounded-2xl p-6 transition-all ${!isActive ? 'bg-slate-100/50 border-slate-300 opacity-60' : isMissing ? 'bg-rose-50/30 border-rose-200' : 'bg-slate-50/50 border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggleStep(idx)}
                            className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-2"
                          />
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${!isActive ? 'bg-slate-400 text-white' : isMissing ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'}`}>
                            {idx + 1}
                          </span>
                          <span className={`text-sm font-black uppercase tracking-tight ${!isActive ? 'text-slate-500' : isMissing ? 'text-rose-600' : 'text-slate-800'}`}>{stepName}</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <span className="text-[9px] font-black text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                            DESATIVADA
                          </span>
                        )}
                        {isActive && isMissing && <AlertCircle size={16} className="text-rose-400" />}
                      </div>
                    </div>

                    {isActive && activeOrders.length > 0 && (
                      <div className={`mb-4 p-4 border rounded-xl transition-all ${showDependency[idx] ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            id={`dep-check-${idx}`}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={!!showDependency[idx]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setShowDependency(prev => ({ ...prev, [idx]: checked }));
                              if (!checked) {
                                setDependencies(prev => {
                                  const next = { ...prev };
                                  delete next[idx];
                                  return next;
                                });
                              }
                            }}
                          />
                          <label htmlFor={`dep-check-${idx}`} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 cursor-pointer select-none">
                            <Layers size={12} /> Associar Dependência (Opcional)
                          </label>
                        </div>

                        {showDependency[idx] && (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Hierarquia de Seleção */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {/* 1. Selecionar Leito */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">1. Leito</label>
                                <select
                                  className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg outline-none text-slate-600"
                                  value={dependencies[idx]?.bedId || ''}
                                  onChange={(e) => {
                                    const bedId = e.target.value;
                                    setDependencies(prev => {
                                      if (!bedId) {
                                        const next = { ...prev };
                                        delete next[idx];
                                        return next;
                                      }
                                      return {
                                        ...prev,
                                        [idx]: {
                                          bedId,
                                          flowId: '',
                                          actionId: '',
                                          type: 'BLOQUEADA'
                                        }
                                      };
                                    });
                                  }}
                                >
                                  <option value="">Selecione o Leito...</option>
                                  {Array.from(new Set(activeOrders.map(o => o.bedId))).map(bedId => {
                                    const bedName = beds.find(b => b.id === bedId)?.name || 'Desconhecido';
                                    return <option key={bedId} value={bedId}>{bedName}</option>;
                                  })}
                                </select>
                              </div>

                              {/* 2. Selecionar Fluxo (Group) */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">2. Fluxo</label>
                                <select
                                  className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg outline-none text-slate-600"
                                  disabled={!dependencies[idx]?.bedId}
                                  value={dependencies[idx]?.flowId || ''}
                                  onChange={(e) => {
                                    const flowId = e.target.value;
                                    setDependencies(prev => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], flowId, actionId: '' }
                                    }));
                                  }}
                                >
                                  <option value="">Selecione o Fluxo...</option>
                                  {dependencies[idx]?.bedId && Array.from(new Set(
                                    activeOrders
                                      .filter(o => o.bedId === dependencies[idx].bedId)
                                      .map(o => o.groupId)
                                  )).map(groupId => {
                                    const groupOrders = activeOrders.filter(o => o.groupId === groupId);
                                    const serviceName = services.find(s => s.id === groupOrders[0].serviceId)?.name || 'Fluxo';
                                    const time = new Date(groupOrders[0].requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    return <option key={groupId} value={groupId}>{serviceName} ({time})</option>;
                                  })}
                                </select>
                              </div>
                            </div>

                            {/* 3. Selecionar Ação e Tipo */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">3. Ação Alvo</label>
                                <select
                                  className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg outline-none text-slate-600"
                                  disabled={!dependencies[idx]?.flowId}
                                  value={dependencies[idx]?.actionId || ''}
                                  onChange={(e) => {
                                    const actionId = e.target.value;
                                    setDependencies(prev => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], actionId }
                                    }));
                                  }}
                                >
                                  <option value="">Selecione a Ação...</option>
                                  {dependencies[idx]?.flowId && activeOrders
                                    .filter(o => o.groupId === dependencies[idx].flowId)
                                    .sort((a, b) => a.step - b.step)
                                    .map(o => (
                                      <option key={o.id} value={o.id}>{o.subServiceName} ({o.status})</option>
                                    ))
                                  }
                                </select>
                              </div>

                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">4. Tipo de Associação</label>
                                <select
                                  className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg outline-none text-slate-600"
                                  disabled={!dependencies[idx]?.actionId}
                                  value={dependencies[idx]?.type || 'BLOQUEADA'}
                                  onChange={(e) => {
                                    setDependencies(prev => ({
                                      ...prev,
                                      [idx]: { ...prev[idx], type: e.target.value as any }
                                    }));
                                  }}
                                >
                                  <option value="BLOQUEADA">Bloqueada por (Espera)</option>
                                  <option value="BLOQUEADOR">Bloqueia (Interrompe)</option>
                                </select>
                              </div>
                            </div>

                            {dependencies[idx]?.actionId && (
                              <div className={`text-[9px] font-bold mt-1 p-2 rounded ${dependencies[idx].type === 'BLOQUEADA' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                                {dependencies[idx].type === 'BLOQUEADA'
                                  ? `* Esta nova ação ficará BLOQUEADA aguardando a conclusão da ação selecionada.`
                                  : `* A ação selecionada será BLOQUEADA por esta nova ação.`
                                }
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isActive ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                        {allowedItems.length > 0 ? (
                          allowedItems.map(item => {
                            const qty = selectedItemsPerStep[idx]?.[item.id] || 0;
                            const hasOtherItem = Object.keys(selectedItemsPerStep[idx] || {}).some(id => id !== item.id && (selectedItemsPerStep[idx]?.[id] || 0) > 0);
                            return (
                              <div key={item.id} className={`p-3 md:p-4 rounded-lg md:rounded-xl border transition-all flex items-center justify-between ${qty > 0 ? 'bg-white border-sky-300 shadow-md ring-2 ring-sky-200' : hasOtherItem ? 'bg-slate-100/50 border-slate-200 opacity-50' : 'bg-white/50 border-slate-100 hover:border-slate-300'}`}>
                                <div className="flex-1 pr-2">
                                  <p className={`text-[11px] font-black uppercase leading-tight ${qty > 0 ? 'text-slate-700' : hasOtherItem ? 'text-slate-400' : 'text-slate-700'}`}>{item.name}</p>

                                  {qty > 0 && (
                                    <p className="text-[9px] text-sky-600 font-black mt-1">✓ Selecionado</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-3 bg-slate-50 px-2 py-1 rounded-lg">
                                  <button
                                    type="button"
                                    onClick={() => updateItemQuantity(idx, item.id, -1)}
                                    disabled={qty === 0 || hasOtherItem}
                                    className={`p-1 rounded ${qty === 0 || hasOtherItem ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-200 text-slate-400'}`}
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className={`text-xs font-black w-4 text-center ${qty > 0 ? 'text-sky-600' : 'text-slate-400'}`}>{qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateItemQuantity(idx, item.id, 1)}
                                    disabled={hasOtherItem}
                                    className={`p-1 rounded ${hasOtherItem ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-200 text-sky-600'}`}
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-2 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase italic">Sem itens extras configurados para esta ação.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-100/30">
                        <p className="text-[10px] text-slate-500 font-bold uppercase italic">Etapa desativada - não será incluída no pedido</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar de Resumo */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 sticky top-2 md:top-4 shadow-2xl">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400 mb-8 border-b border-sky-900/50 pb-4">Checklist da Solicitação</h4>

            <div className="space-y-6 mb-10">
              <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-2xl border border-slate-800">
                <UserIcon size={18} className="text-sky-500" />
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Solicitante Responsável</span>
                  <p className="text-xs font-black text-white">{currentUser.name}</p>
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Unidade / Leito</span>
                <p className="text-sm font-black text-white">{beds.find(b => b.id === selectedBedId)?.name || 'Nenhum leito selecionado'}</p>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Processo de Trabalho</span>
                <p className="text-sm font-black text-white truncate">{selectedService?.name || 'Aguardando seleção...'}</p>
              </div>
            </div>

            <div className="space-y-4 mb-10 max-h-[300px] overflow-y-auto scrollbar-hide">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-800 pb-2">Itens e Insumos Selecionados</span>
              {Object.entries(selectedItemsPerStep).map(([stepIdx, items]) => (
                Object.entries(items).map(([itemId, qty]) => {
                  const item = complementItems.find(i => i.id === itemId);
                  const sub = (selectedService?.config?.subOrders || [])[parseInt(stepIdx)];
                  const step = sub?.stepId ? steps.find(s => s.id === sub.stepId) : null;
                  const subName = step?.name || sub?.name || 'Geral';
                  return (
                    <div key={`${stepIdx}-${itemId}`} className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-sky-500 uppercase">{subName}</p>
                        <p className="text-[11px] font-bold text-slate-100">{item?.name}</p>
                      </div>
                      <span className="bg-slate-800 text-white font-black px-2 py-1 rounded text-[10px]">x{qty}</span>
                    </div>
                  );
                })
              ))}
              {Object.keys(selectedItemsPerStep).length === 0 && (
                <p className="text-[10px] text-slate-600 font-bold italic py-2">Nenhum item selecionado ainda.</p>
              )}
            </div>



            <button
              type="submit"
              disabled={!validation.isValid || createOrderMutation.isPending}
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-5 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-3 uppercase text-xs tracking-widest active:scale-95"
            >
              {createOrderMutation.isPending ? 'Gerando Ordens...' : validation.isValid ? 'Confirmar Operação' : 'Checklist Pendente'}
              {!createOrderMutation.isPending && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ServiceRequestForm;
