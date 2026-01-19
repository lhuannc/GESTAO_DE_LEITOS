
import React, { useState, useMemo } from 'react';
import { Bed, ServiceType, ActionStatus, User, ServiceOrder, ComplementItem } from '../types';
import { ClipboardCheck, ArrowRight, Layers, Package, Plus, Minus, DollarSign, AlertCircle, Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { db } from '../backend';

interface ServiceRequestFormProps {
  beds: Bed[];
  services: ServiceType[];
  actions: ActionStatus[];
  currentUser: User;
  onSuccess: () => void;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ 
  beds, 
  services, 
  currentUser, 
  onSuccess 
}) => {
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complementItems, setComplementItems] = useState<ComplementItem[]>([]);
  const [showCosts, setShowCosts] = useState(false);

  // Estrutura: { stepIndex: { itemId: quantity } }
  const [selectedItemsPerStep, setSelectedItemsPerStep] = useState<Record<number, Record<string, number>>>({});

  // Carrega insumos do DB
  React.useEffect(() => {
    db.getAllData().then(data => setComplementItems(data.complementItems || []));
  }, []);

  const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);

  const updateItemQuantity = (stepIdx: number, itemId: string, delta: number) => {
    setSelectedItemsPerStep(prev => {
      const stepData = { ...(prev[stepIdx] || {}) };
      const currentQty = stepData[itemId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      if (newQty === 0) delete stepData[itemId];
      else stepData[itemId] = newQty;

      return { ...prev, [stepIdx]: stepData };
    });
  };

  // Validação: Pelo menos um item por etapa
  const validation = useMemo(() => {
    if (!selectedService) return { isValid: false, missingSteps: [] };
    
    const steps = selectedService.config?.subOrders || [{ name: 'Atendimento Geral', allowedItemIds: [] }];
    const missingSteps: number[] = [];

    steps.forEach((_, idx) => {
      const itemsInStep = Object.keys(selectedItemsPerStep[idx] || {}).length;
      if (itemsInStep === 0) {
        missingSteps.push(idx);
      }
    });

    return {
      isValid: missingSteps.length === 0 && selectedBedId !== '' && selectedServiceId !== '',
      missingSteps
    };
  }, [selectedService, selectedItemsPerStep, selectedBedId, selectedServiceId]);

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
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const stepsItems: Record<number, { itemId: string, quantity: number }[]> = {};
      Object.entries(selectedItemsPerStep).forEach(([idx, items]) => {
        stepsItems[parseInt(idx)] = Object.entries(items).map(([id, qty]) => ({ itemId: id, quantity: qty }));
      });

      await db.createOrdersFromService({
        bedId: selectedBedId,
        serviceId: selectedServiceId,
        userId: currentUser.id,
        companyId: currentUser.companyId,
        stepsItems
      });
      onSuccess();
    } catch (error) {
      alert("Erro ao criar solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableBeds = beds.filter(b => b.status !== 'HIGIENIZACAO');

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-100 text-sky-600 rounded-lg">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Nova Solicitação de Fluxo</h3>
            <p className="text-slate-500 text-sm">Selecione obrigatoriamente um item para cada etapa.</p>
          </div>
        </div>
        
        <button 
          type="button"
          onClick={() => setShowCosts(!showCosts)}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase transition-all"
        >
          {showCosts ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{showCosts ? 'Ocultar Valores' : 'Exibir Valores'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
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
                  className={`p-4 border text-left rounded-2xl transition-all ${
                    selectedServiceId === service.id 
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
                        <Layers size={10} /> <span>{service.config.subOrders?.length} Etapas</span>
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
                   <Package size={14} /> Itens por Etapa
                 </h4>
                 {validation.missingSteps.length > 0 && (
                   <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-bounce">
                     Escolha obrigatória pendente
                   </span>
                 )}
               </div>
               
               {(selectedService.config?.subOrders || [{ name: 'Atendimento Geral', allowedItemIds: [] }]).map((sub, idx) => {
                  const allowedItems = complementItems.filter(item => sub.allowedItemIds?.includes(item.id));
                  const isMissing = validation.missingSteps.includes(idx);
                  
                  return (
                    <div key={idx} className={`border rounded-2xl p-6 transition-all ${isMissing ? 'bg-rose-50/30 border-rose-200' : 'bg-slate-50/50 border-slate-200'}`}>
                       <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isMissing ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'}`}>
                              {idx + 1}
                            </span>
                            <span className={`text-sm font-black uppercase tracking-tight ${isMissing ? 'text-rose-600' : 'text-slate-800'}`}>{sub.name}</span>
                          </div>
                          {isMissing && <AlertCircle size={16} className="text-rose-400" />}
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {allowedItems.length > 0 ? (
                           allowedItems.map(item => {
                              const qty = selectedItemsPerStep[idx]?.[item.id] || 0;
                              return (
                                <div key={item.id} className={`p-4 rounded-xl border transition-all flex items-center justify-between ${qty > 0 ? 'bg-white border-sky-300 shadow-md' : 'bg-white/50 border-slate-100 hover:border-slate-300'}`}>
                                   <div className="flex-1 pr-2">
                                      <p className="text-[11px] font-black text-slate-700 uppercase leading-tight">{item.name}</p>
                                      {showCosts && <p className="text-[10px] text-emerald-600 font-bold mt-1">R$ {item.unitCost.toFixed(2)}</p>}
                                   </div>
                                   <div className="flex items-center space-x-3 bg-slate-50 px-2 py-1 rounded-lg">
                                      <button type="button" onClick={() => updateItemQuantity(idx, item.id, -1)} className="p-1 hover:bg-slate-200 rounded text-slate-400"><Minus size={14} /></button>
                                      <span className="text-xs font-black text-slate-800 w-4 text-center">{qty}</span>
                                      <button type="button" onClick={() => updateItemQuantity(idx, item.id, 1)} className="p-1 hover:bg-slate-200 rounded text-sky-600"><Plus size={14} /></button>
                                   </div>
                                </div>
                              );
                           })
                         ) : (
                           <div className="col-span-2 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase italic">Sem itens extras configurados para esta etapa.</p>
                           </div>
                         )}
                       </div>
                    </div>
                  );
               })}
            </div>
          )}
        </div>

        {/* Sidebar de Resumo */}
        <div className="lg:col-span-1">
           <div className="bg-slate-900 text-white rounded-3xl p-8 sticky top-4 shadow-2xl">
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
                     const subName = (selectedService?.config?.subOrders || [])[parseInt(stepIdx)]?.name || 'Geral';
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

              {showCosts && totalCost > 0 && (
                <div className="pt-6 border-t border-sky-900 flex justify-between items-end mb-10">
                   <span className="text-[10px] text-sky-400 font-black uppercase tracking-widest">Custo Estimado</span>
                   <div className="text-right">
                      <p className="text-2xl font-black text-white">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                   </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!validation.isValid || isSubmitting}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-5 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-3 uppercase text-xs tracking-widest active:scale-95"
              >
                {isSubmitting ? 'Gerando Ordens...' : validation.isValid ? 'Confirmar Operação' : 'Checklist Pendente'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
           </div>
        </div>
      </form>
    </div>
  );
};

export default ServiceRequestForm;
