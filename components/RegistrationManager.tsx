
import React, { useState, useMemo } from 'react';
import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, OSStatus, SubOrderConfig, Team, ComplementItem, Step, BedStatusConfig } from '../types';
import { 
  Building2, Hospital, Layers, Bed as BedIcon, Settings, 
  Users, Plus, Trash2, Edit2, X, Save,
  ListPlus, Info, Users2, ArrowDown, ArrowUp, Lock,
  Package, DollarSign, CheckSquare, Link as LinkIcon,
  UserCheck, Mail, ShieldCheck, Fingerprint, CreditCard, Clock, Palette
} from 'lucide-react';
import { maskCPF, unmaskCPF, md5 } from '../utils';

type TabId = 'empresa' | 'unidade' | 'setor' | 'leito' | 'servico' | 'usuario' | 'equipe' | 'insumo' | 'etapa' | 'status';

interface RegistrationManagerProps {
  currentUser: User;
  companies: Company[];
  units: Unit[];
  sectors: Sector[];
  beds: Bed[];
  services: ServiceType[];
  actions: ActionStatus[];
  users: User[];
  teams: Team[];
  complementItems?: ComplementItem[]; // Adicionado via DB
  steps?: Step[]; // Etapas cadastradas
  bedStatusConfigs?: BedStatusConfig[]; // Configurações de status
  onSave: (type: string, item: any) => Promise<void>;
  onDelete: (type: string, id: string) => Promise<void>;
}

const RegistrationManager: React.FC<RegistrationManagerProps> = ({
  currentUser,
  companies,
  units,
  sectors,
  beds,
  services,
  users,
  teams,
  complementItems = [],
  steps = [],
  bedStatusConfigs = [],
  onSave,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('leito');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);

  const tabsConfig = useMemo(() => [
    { id: 'empresa' as TabId, label: 'Empresas', icon: <Building2 size={18} />, module: 'company' },
    { id: 'unidade' as TabId, label: 'Unidades', icon: <Hospital size={18} />, module: 'unit' },
    { id: 'setor' as TabId, label: 'Setores', icon: <Layers size={18} />, module: 'sector' },
    { id: 'leito' as TabId, label: 'Leitos', icon: <BedIcon size={18} />, module: 'bed' },
    { id: 'equipe' as TabId, label: 'Equipes', icon: <Users2 size={18} />, module: 'team' },
    { id: 'insumo' as TabId, label: 'Insumos / Extras', icon: <Package size={18} />, module: 'complementItem' },
    { id: 'etapa' as TabId, label: 'Ações', icon: <ListPlus size={18} />, module: 'step' },
    { id: 'status' as TabId, label: 'Status de Leito', icon: <Palette size={18} />, module: 'bedStatusConfig' },
    { id: 'servico' as TabId, label: 'Fluxos (Serviços)', icon: <Settings size={18} />, module: 'service' },
    { id: 'usuario' as TabId, label: 'Usuários', icon: <Users size={18} />, module: 'user' },
  ], []);

  const filteredItems = useMemo(() => {
    const isAdmin = currentUser.permissions.isAdmin;
    const cid = currentUser.companyId;
    switch(activeTab) {
      case 'empresa': return companies;
      case 'unidade': return units.filter(u => isAdmin || u.companyId === cid);
      case 'setor': return sectors.filter(s => isAdmin || units.some(u => u.id === s.unitId && u.companyId === cid));
      case 'leito': return beds.filter(b => isAdmin || sectors.some(s => s.id === b.sectorId && units.some(u => u.id === s.unitId && u.companyId === cid)));
      case 'servico': return services.filter(s => isAdmin || s.companyId === cid);
      case 'usuario': return users.filter(u => isAdmin || u.companyId === cid);
      case 'equipe': return teams.filter(t => isAdmin || t.companyId === cid);
      case 'insumo': return complementItems.filter(i => isAdmin || i.companyId === cid);
      case 'etapa': return steps.filter(s => isAdmin || s.companyId === cid);
      case 'status': return bedStatusConfigs.filter(s => isAdmin || s.companyId === cid);
      default: return [];
    }
  }, [activeTab, companies, units, sectors, beds, services, users, teams, complementItems, steps, bedStatusConfigs, currentUser]);

  const getAssociationsForItem = (itemId: string) => {
    const associations: { serviceName: string; stepName: string }[] = [];
    services.forEach(service => {
      service.config?.subOrders?.forEach(sub => {
        if (sub.allowedItemIds?.includes(itemId)) {
          associations.push({ serviceName: service.name, stepName: sub.name });
        }
      });
    });
    return associations;
  };

  const openNewModal = () => {
    setIsEditing(false);
    const baseData: any = { 
      companyId: currentUser.companyId
    };
    
    // Inicializar campos específicos por tipo
    if (activeTab === 'etapa') {
      baseData.targetTeamId = '';
      baseData.allowedItemIds = [];
      baseData.slaMinutes = '';
    } else if (activeTab === 'status') {
      baseData.color = 'bg-slate-500';
    } else if (activeTab === 'equipe') {
      baseData.userIds = [];
    } else if (activeTab === 'usuario') {
      baseData.permissions = { pages: ['dashboard', 'ordens'], modules: ['bed'], isAdmin: false };
    } else if (activeTab === 'servico') {
      baseData.config = { generateMultipleOS: false, subOrders: [] };
    } else if (activeTab === 'setor') {
      baseData.unitId = '';
    } else if (activeTab === 'leito') {
      baseData.sectorId = '';
      baseData.status = 'DISPONIVEL';
    }
    
    setFormData(baseData);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setIsEditing(true);
    const formDataToSet: any = { 
      ...item,
      userIds: item.userIds || [],
      config: item.config || { generateMultipleOS: false, subOrders: [] },
      allowedItemIds: item.allowedItemIds || [] // Para etapas
    };
    
    // Se for leito, calcular companyId a partir do setor
    if (activeTab === 'leito' && item.sectorId) {
      const sector = sectors.find(s => s.id === item.sectorId);
      if (sector) {
        const unit = units.find(u => u.id === sector.unitId);
        if (unit) {
          formDataToSet.companyId = unit.companyId;
        }
      }
    }
    
    // Se for setor, calcular companyId a partir da unidade
    if (activeTab === 'setor' && item.unitId) {
      const unit = units.find(u => u.id === item.unitId);
      if (unit) {
        formDataToSet.companyId = unit.companyId;
      }
    }
    
    // Se for usuário e tiver CPF, aplicar máscara
    if (activeTab === 'usuario' && item.cpf) {
      formDataToSet.cpf = maskCPF(item.cpf);
    }
    
    setFormData(formDataToSet);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeMap: Record<TabId, string> = {
      empresa: 'companies', unidade: 'units', setor: 'sectors', leito: 'beds', 
      servico: 'services', usuario: 'users', equipe: 'teams', insumo: 'complementItems',
      etapa: 'steps', status: 'bedStatusConfigs'
    };
    
    // Se for usuário, processar CPF e gerar hash
    if (activeTab === 'usuario' && formData.cpf) {
      const cpfUnmasked = unmaskCPF(formData.cpf);
      if (cpfUnmasked.length === 11) {
        formData.cpf = cpfUnmasked;
        formData.cpfHash = md5(cpfUnmasked);
      }
    }
    
    // Garantir que allowedItemIds seja array para etapas
    if (activeTab === 'etapa') {
      if (!Array.isArray(formData.allowedItemIds)) {
        formData.allowedItemIds = [];
      }
      // Validar campos obrigatórios para etapas
      if (!formData.targetTeamId || formData.targetTeamId.trim() === '') {
        alert('Por favor, selecione uma equipe responsável para a etapa.');
        return;
      }
    }
    if (activeTab === 'setor') {
      if (!formData.unitId || formData.unitId.trim() === '') {
        alert('Por favor, selecione uma unidade para o setor.');
        return;
      }
    }
    if (activeTab === 'leito') {
      if (!formData.sectorId || formData.sectorId.trim() === '') {
        alert('Por favor, selecione um setor para o leito.');
        return;
      }
    }
    
    try {
      await onSave(typeMap[activeTab], formData);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao salvar registro.';
      alert(`Erro ao salvar registro: ${errorMessage}`);
    }
  };

  const addSubOrder = () => {
    const subOrders = [...(formData.config?.subOrders || [])];
    subOrders.push({ 
      stepId: '' // Agora apenas referencia uma etapa existente
    });
    setFormData({ ...formData, config: { ...formData.config, subOrders } });
  };

  const toggleUserInTeam = (userId: string) => {
    const currentIds = [...(formData.userIds || [])];
    const idx = currentIds.indexOf(userId);
    if (idx > -1) currentIds.splice(idx, 1);
    else currentIds.push(userId);
    setFormData({ ...formData, userIds: currentIds });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      <div className="w-full md:w-56 lg:w-64 space-y-1 flex-shrink-0">
        {tabsConfig.map(tab => (
          <button 
            key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center space-x-2 md:space-x-3 p-2.5 md:p-3 rounded-lg font-medium transition-all text-sm ${activeTab === tab.id ? 'bg-sky-50 text-sky-700 shadow-sm border border-sky-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {tab.icon} <span className="text-xs md:text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{tabsConfig.find(t => t.id === activeTab)?.label}</h3>
          <button onClick={openNewModal} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold shadow-md"><Plus size={16} /> <span>Novo Registro</span></button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <TableList 
             items={filteredItems} 
             onEdit={openEditModal} 
             onDelete={(id) => onDelete(
                activeTab === 'servico' ? 'services' : 
                activeTab === 'equipe' ? 'teams' : 
                activeTab === 'leito' ? 'beds' : 
                activeTab === 'usuario' ? 'users' : 
                activeTab === 'unidade' ? 'units' :
                activeTab === 'setor' ? 'sectors' : 
                activeTab === 'insumo' ? 'complementItems' :
                activeTab === 'etapa' ? 'steps' : 'companies'
             , id)}
             renderRow={(item: any) => {
               const associations = activeTab === 'insumo' ? getAssociationsForItem(item.id) : [];
               return (
                 <div className="flex flex-col w-full">
                    <div className="flex justify-between items-start w-full">
                      <div>
                        <div className="font-bold uppercase text-slate-800 text-sm">{item.name}</div>
                        {activeTab === 'usuario' && item.login && (
                          <div className="flex items-center gap-1 text-[10px] text-sky-600 font-black mt-1 uppercase tracking-widest">
                             <Fingerprint size={10} /> Login: {item.login}
                          </div>
                        )}
                        {activeTab === 'insumo' && (
                          <div className="text-[10px] text-sky-600 font-black mt-1">R$ {item.unitCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        )}
                        {activeTab === 'servico' && (
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                            {item.config?.generateMultipleOS ? `${item.config.subOrders?.length} Ações Configuradas` : 'OS de Fluxo Único'}
                            {item.config?.subOrders && item.config.subOrders.length > 0 && (() => {
                              const totalSLA = item.config.subOrders.reduce((total: number, sub: SubOrderConfig) => {
                                const step = steps.find(s => s.id === sub.stepId);
                                return total + (step?.slaMinutes || 0);
                              }, 0);
                              return totalSLA > 0 ? (
                                <span className="ml-2 text-sky-600">• SLA Total: {totalSLA}min</span>
                              ) : null;
                            })()}
                          </div>
                        )}
                        {activeTab === 'equipe' && (
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                            {item.userIds?.length || 0} Membros associados
                          </div>
                        )}
                        {activeTab === 'etapa' && (
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                            {teams.find(t => t.id === item.targetTeamId)?.name || 'Sem equipe'} • {item.allowedItemIds?.length || 0} Insumos
                            {item.slaMinutes && (
                              <span className="ml-2 text-sky-600">• SLA: {item.slaMinutes}min</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {activeTab === 'insumo' && associations.length > 0 && (
                      <div className="mt-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          <LinkIcon size={10} className="text-sky-500" /> 
                          <span>Associações de Fluxo</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {associations.map((assoc, idx) => (
                            <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[9px] font-bold text-slate-600 shadow-sm">
                              {assoc.serviceName} <span className="text-sky-500 mx-1">/</span> {assoc.stepName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Fixed comparison logic: activeTab === 'insumo' check is sufficient and redundant with other tab checks here */}
                    {activeTab === 'insumo' && associations.length === 0 && (
                      <div className="mt-2 text-[9px] font-bold text-slate-400 italic">Registro independente</div>
                    )}
                 </div>
               );
             }}
           />
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200 max-h-[95vh] md:max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm md:text-base">{isEditing ? 'Editar' : 'Novo'} {activeTab}</h4>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 flex-1 overflow-y-auto scrollbar-hide">
              <Input label={activeTab === 'usuario' ? 'Nome Completo' : 'Nome Identificador'} value={formData.name} onChange={v => setFormData({...formData, name: v})} required />

              {activeTab === 'setor' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Hospital size={14} className="text-sky-500" /> Unidade
                  </label>
                  <select
                    value={formData.unitId || ''}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                    required
                  >
                    <option value="">Selecione uma unidade...</option>
                    {units.filter(u => {
                      const companyId = formData.companyId || currentUser.companyId;
                      return u.companyId === companyId;
                    }).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'leito' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Layers size={14} className="text-sky-500" /> Setor
                    </label>
                    <select
                      value={formData.sectorId || ''}
                      onChange={(e) => setFormData({ ...formData, sectorId: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                      required
                    >
                      <option value="">Selecione um setor...</option>
                      {sectors.filter(s => {
                        const companyId = formData.companyId || currentUser.companyId;
                        return units.some(u => u.id === s.unitId && u.companyId === companyId);
                      }).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <BedIcon size={14} className="text-sky-500" /> Status
                    </label>
                    <select
                      value={formData.status || 'DISPONIVEL'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                    >
                      {(() => {
                        const availableStatuses = bedStatusConfigs.filter(s => s.companyId === (formData.companyId || currentUser.companyId));
                        if (availableStatuses.length > 0) {
                          return availableStatuses.map(config => (
                            <option key={config.id} value={config.id}>{config.name}</option>
                          ));
                        }
                        // Fallback apenas se não houver NENHUM status cadastrado para a empresa
                        return (
                          <>
                             <option value="DISPONIVEL">Disponível</option>
                             <option value="OCUPADO">Ocupado</option>
                             <option value="HIGIENIZACAO">Higienização</option>
                             <option value="MANUTENCAO">Manutenção</option>
                             <option value="AGUARDANDO_ALTA">Aguardando Alta</option>
                          </>
                        );
                      })()}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'usuario' && (
                <>
                  <Input label="E-mail" value={formData.email} onChange={v => setFormData({...formData, email: v})} icon={<Mail size={16}/>} required />
                  <Input 
                    label="CPF" 
                    value={formData.cpf ? maskCPF(formData.cpf) : ''} 
                    onChange={v => {
                      const masked = maskCPF(v);
                      setFormData({...formData, cpf: masked});
                    }} 
                    icon={<CreditCard size={16}/>} 
                    required 
                    maxLength={14}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Login de Acesso" value={formData.login} onChange={v => setFormData({...formData, login: v})} icon={<Fingerprint size={16}/>} required />
                    <Input label="Senha" type="password" value={formData.password} onChange={v => setFormData({...formData, password: v})} icon={<ShieldCheck size={16}/>} required />
                  </div>
                </>
              )}

              {activeTab === 'insumo' && (
                <Input label="Custo Unitário (R$)" type="number" step="0.01" value={formData.unitCost} onChange={v => setFormData({...formData, unitCost: parseFloat(v)})} required />
              )}

              {activeTab === 'etapa' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                      <Users2 size={14} className="text-sky-500" /> Equipe Responsável
                    </label>
                    <select 
                      value={formData.targetTeamId || ''} 
                      onChange={(e) => setFormData({...formData, targetTeamId: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                      required
                    >
                      <option value="">Selecione uma equipe...</option>
                      {teams.filter(t => t.companyId === formData.companyId).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                      <Package size={14} className="text-sky-500" /> Insumos Permitidos
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {complementItems.filter(i => i.companyId === formData.companyId).map(item => {
                        const isSelected = (formData.allowedItemIds || []).includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const allowed = [...(formData.allowedItemIds || [])];
                              const idx = allowed.indexOf(item.id);
                              if (idx > -1) allowed.splice(idx, 1);
                              else allowed.push(item.id);
                              setFormData({...formData, allowedItemIds: allowed});
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all ${
                              isSelected 
                                ? 'bg-sky-500 text-white border-sky-600 shadow-md' 
                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                            }`}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                    {complementItems.filter(i => i.companyId === formData.companyId).length === 0 && (
                      <div className="p-4 text-center border-2 border-dashed border-slate-100 rounded-xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase italic">Nenhum insumo cadastrado nesta empresa.</p>
                      </div>
                    )}
                  </div>
                  <Input
                    label="SLA (em minutos)"
                    value={formData.slaMinutes || ''}
                    onChange={(v) => setFormData({...formData, slaMinutes: v ? parseInt(v) : ''})}
                    type="number"
                    icon={<Clock size={14} className="text-sky-500" />}
                  />
                </div>
              )}

              {activeTab === 'status' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                      <Palette size={14} className="text-sky-500" /> Cor do Status
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {[
                        'bg-emerald-500', 'bg-green-500', 'bg-lime-500',
                        'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
                        'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
                        'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
                        'bg-rose-500', 'bg-red-500', 'bg-orange-500',
                        'bg-amber-500', 'bg-yellow-500', 'bg-slate-500'
                      ].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({...formData, color})}
                          className={`h-12 rounded-xl transition-all ${formData.color === color ? 'ring-4 ring-offset-2 ring-sky-500 scale-95' : 'hover:scale-105 hover:shadow-lg'}`}
                        >
                          <div className={`w-full h-full rounded-lg ${color}`}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'equipe' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <UserCheck size={14} className="text-sky-500" /> Associar Membros da Equipe
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {users.filter(u => u.companyId === formData.companyId).map(user => {
                      const isMember = (formData.userIds || []).includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleUserInTeam(user.id)}
                          className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl border text-left transition-all flex items-center gap-2 md:gap-3 ${isMember ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-100 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${isMember ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {user.name.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className={`text-[11px] font-black uppercase truncate ${isMember ? 'text-sky-700' : 'text-slate-600'}`}>{user.name}</p>
                            <p className="text-[9px] text-slate-400 truncate">{user.email}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {users.filter(u => u.companyId === formData.companyId).length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-300 uppercase italic">Nenhum usuário cadastrado nesta empresa.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'servico' && (
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center space-x-2">
                        <ListPlus size={18} className="text-sky-600" />
                        <span className="font-bold text-slate-700 text-sm">Dependência Sequencial Automática</span>
                      </div>
                      <input 
                        type="checkbox" checked={formData.config?.generateMultipleOS} 
                        onChange={(e) => setFormData({...formData, config: {...formData.config, generateMultipleOS: e.target.checked, subOrders: e.target.checked ? (formData.config?.subOrders || []) : []}})}
                        className="w-5 h-5 rounded accent-sky-600 cursor-pointer"
                      />
                   </div>

                   {formData.config?.generateMultipleOS && (
                      <div className="space-y-4">
                        {formData.config.subOrders?.map((sub: SubOrderConfig, idx: number) => {
                          // Buscar etapa completa se tiver stepId
                          const step = sub.stepId ? steps.find(s => s.id === sub.stepId) : null;
                          const stepName = step?.name || sub.name || `Ação ${idx + 1}`;
                          const stepTeamId = step?.targetTeamId || sub.targetTeamId || '';
                          const stepItemIds = step?.allowedItemIds || sub.allowedItemIds || [];
                          
                          return (
                            <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                               <div className="flex justify-between items-center">
                                 <select
                                   value={sub.stepId || ''}
                                   onChange={(e) => {
                                      const subOrders = [...formData.config.subOrders];
                                      const selectedStep = steps.find(s => s.id === e.target.value);
                                      if (selectedStep) {
                                        subOrders[idx] = { 
                                          stepId: selectedStep.id,
                                          name: selectedStep.name,
                                          targetTeamId: selectedStep.targetTeamId,
                                          allowedItemIds: selectedStep.allowedItemIds
                                        };
                                      } else {
                                        subOrders[idx] = { ...subOrders[idx], stepId: e.target.value };
                                      }
                                      setFormData({...formData, config: {...formData.config, subOrders}});
                                   }}
                                   className="flex-1 text-xs font-bold p-2 bg-slate-50 rounded-lg outline-none"
                                   required
                                 >
                                   <option value="">Selecione uma ação...</option>
                                   {steps.filter(s => s.companyId === formData.companyId).map(s => (
                                     <option key={s.id} value={s.id}>{s.name}</option>
                                   ))}
                                 </select>
                                 <button type="button" onClick={() => {
                                   const subOrders = formData.config.subOrders.filter((_:any, i:number) => i !== idx);
                                   setFormData({...formData, config: {...formData.config, subOrders}});
                                 }} className="text-rose-400 p-2 ml-2 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                               </div>
                               
                               {/* Bed Status Configuration */}
                               <div className="flex gap-2 pt-2 border-t border-sky-100/50">
                                  <div className="flex-1">
                                    <label className="text-[9px] font-black text-sky-700 uppercase block mb-1">Status ao Iniciar</label>
                                    <select 
                                      value={sub.bedStatusConfig?.onStart || ''}
                                      onChange={(e) => {
                                        const subOrders = [...formData.config.subOrders];
                                        subOrders[idx] = { 
                                          ...subOrders[idx], 
                                          bedStatusConfig: { 
                                            ...subOrders[idx].bedStatusConfig, 
                                            onStart: e.target.value || undefined 
                                          } 
                                        };
                                        setFormData({...formData, config: {...formData.config, subOrders}});
                                      }}
                                      className="w-full text-[10px] p-1.5 bg-white border border-sky-200 rounded-lg outline-none text-slate-600"
                                    >
                                      <option value="">Manter atual</option>
                                      {(() => {
                                        const availableStatuses = bedStatusConfigs.filter(s => s.companyId === (formData.companyId || currentUser.companyId));
                                        if (availableStatuses.length > 0) {
                                          return availableStatuses.map(config => (
                                            <option key={config.id} value={config.id}>{config.name}</option>
                                          ));
                                        }
                                        return (
                                          <>
                                             <option value="OCUPADO">Ocupado</option>
                                             <option value="HIGIENIZACAO">Higienização</option>
                                             <option value="MANUTENCAO">Manutenção</option>
                                          </>
                                        );
                                      })()}
                                    </select>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[9px] font-black text-sky-700 uppercase block mb-1">Status ao Finalizar</label>
                                    <select 
                                      value={sub.bedStatusConfig?.onFinish || ''}
                                      onChange={(e) => {
                                        const subOrders = [...formData.config.subOrders];
                                        subOrders[idx] = { 
                                          ...subOrders[idx], 
                                          bedStatusConfig: { 
                                            ...subOrders[idx].bedStatusConfig, 
                                            onFinish: e.target.value || undefined 
                                          } 
                                        };
                                        setFormData({...formData, config: {...formData.config, subOrders}});
                                      }}
                                      className="w-full text-[10px] p-1.5 bg-white border border-sky-200 rounded-lg outline-none text-slate-600"
                                    >
                                      <option value="">Manter atual</option>
                                      {(() => {
                                        const availableStatuses = bedStatusConfigs.filter(s => s.companyId === (formData.companyId || currentUser.companyId));
                                        if (availableStatuses.length > 0) {
                                          return availableStatuses.map(config => (
                                            <option key={config.id} value={config.id}>{config.name}</option>
                                          ));
                                        }
                                        return (
                                          <>
                                             <option value="DISPONIVEL">Disponível</option>
                                             <option value="AGUARDANDO_ALTA">Aguardando Alta</option>
                                          </>
                                        );
                                      })()}
                                    </select>
                                  </div>
                               </div>

                               {step && (
                                 <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 space-y-2">
                                   <div className="flex items-center justify-between">
                                     <div>
                                       <p className="text-[10px] font-black text-sky-700 uppercase">{stepName}</p>
                                       <p className="text-[9px] text-slate-500 mt-1">
                                         Equipe: {teams.find(t => t.id === stepTeamId)?.name || 'Não definida'}
                                       </p>
                                       <p className="text-[9px] text-slate-500">
                                         Insumos: {stepItemIds.length} associado(s)
                                       </p>
                                     </div>
                                     <div className="flex items-center space-x-2">
                                        <Lock size={12} className={idx === 0 ? 'text-emerald-500' : 'text-slate-300'} />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{idx === 0 ? 'Liberado' : 'Bloqueado'}</span>
                                     </div>
                                   </div>
                                 </div>
                               )}
                            </div>
                          );
                        })}
                        <button type="button" onClick={addSubOrder} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:text-sky-500 hover:border-sky-300 flex items-center justify-center space-x-2 bg-slate-50/30">
                          <Plus size={16} /> <span>Adicionar Ação ao Fluxo</span>
                        </button>
                        {steps.filter(s => s.companyId === formData.companyId).length === 0 && (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-[10px] font-black text-amber-700 uppercase">
                              ⚠️ Nenhuma ação cadastrada. Cadastre ações primeiro na aba "Ações".
                            </p>
                          </div>
                        )}
                      </div>
                   )}
                </div>
              )}

              <div className="pt-3 md:pt-4 flex space-x-2 md:space-x-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 md:py-4 bg-slate-100 text-slate-600 font-bold rounded-xl md:rounded-2xl hover:bg-slate-200 transition-colors uppercase text-xs">Cancelar</button>
                <button type="submit" className="flex-1 py-3 md:py-4 bg-slate-900 text-white font-bold rounded-xl md:rounded-2xl hover:bg-black transition-colors shadow-lg flex items-center justify-center space-x-2 uppercase text-xs">
                  <Save size={16} className="md:w-[18px] md:h-[18px]" /> <span>Salvar Registro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TableList = ({ items, renderRow, onDelete, onEdit }: { items: any[], renderRow: (i: any) => React.ReactNode, onDelete: (id: string) => void, onEdit: (item: any) => void }) => (
  <div className="divide-y divide-slate-50">
    {items.filter(Boolean).map((item, idx) => (
      <div key={item.id || idx} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors group">
        <div className="flex-1">{renderRow(item)}</div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-3 text-sky-500 hover:bg-sky-100 rounded-xl transition-all"><Edit2 size={16} /></button>
          <button onClick={() => onDelete(item.id)} className="p-3 text-rose-400 hover:bg-rose-100 rounded-xl transition-all"><Trash2 size={16} /></button>
        </div>
      </div>
    ))}
    {items.length === 0 && <div className="p-20 text-center text-slate-300 uppercase font-black text-[10px] tracking-[0.2em]">Sem dados</div>}
  </div>
);

const Input = ({ label, value, onChange, required, type = "text", step, icon, maxLength }: { label: string, value: string | number, onChange: (v: string) => void, required?: boolean, type?: string, step?: string, icon?: React.ReactNode, maxLength?: number }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
       {icon} {label}
    </label>
    <input 
      type={type} step={step} required={required} value={value ?? ''} onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700 transition-all hover:bg-slate-100/50"
    />
  </div>
);

export default RegistrationManager;
