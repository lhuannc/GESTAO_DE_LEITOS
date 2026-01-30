
import React, { useState, useMemo } from 'react';
import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, OSStatus, SubOrderConfig, Team, ComplementItem, Step, BedStatusConfig } from '@gestao-leitos/types';
import {
  Building2, Hospital, Layers, Bed as BedIcon, Settings,
  Users, Plus, Trash2, Edit2, X, Save,
  ListPlus, Info, Users2, ArrowDown, ArrowUp, Lock,
  Package, DollarSign, CheckSquare, Link as LinkIcon,
  UserCheck, Mail, ShieldCheck, Fingerprint, CreditCard, Clock, Palette
} from 'lucide-react';
import { maskCPF, unmaskCPF, md5 } from '@gestao-leitos/utils';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
    switch (activeTab) {
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
      baseData.serviceTypeId = '';
      baseData.order = 0;
      baseData.description = '';
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
    setSuccess(false);
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
    setSuccess(false);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSuccess(false);
    const typeMap: Record<TabId, string> = {
      empresa: 'companies', unidade: 'units', setor: 'sectors', leito: 'beds',
      servico: 'services', usuario: 'users', equipe: 'teams', insumo: 'complementItems',
      etapa: 'steps', status: 'bedStatusConfigs'
    };

    try {
      // Criar cópia limpa dos dados para enviar
      const dataToSave = { ...formData };

      // Limpar campos de string vazia (converter para undefined/null para o Zod aceitar como opcional)
      Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === '') {
          delete dataToSave[key];
        }
      });

      // Unmask de campos sensíveis
      if (dataToSave.cpf) dataToSave.cpf = unmaskCPF(dataToSave.cpf);
      if (dataToSave.cnpj) dataToSave.cnpj = dataToSave.cnpj.replace(/\D/g, '');

      // Garantir tipos numéricos (HTML inputs podem retornar strings)
      if (dataToSave.unitCost !== undefined) dataToSave.unitCost = parseFloat(dataToSave.unitCost);
      if (dataToSave.slaMinutes !== undefined) dataToSave.slaMinutes = parseInt(dataToSave.slaMinutes);
      if (dataToSave.priority !== undefined) dataToSave.priority = parseInt(dataToSave.priority);

      // Garantir companyId
      if (!dataToSave.companyId && currentUser.companyId) {
        dataToSave.companyId = currentUser.companyId;
      }

      await onSave(typeMap[activeTab], dataToSave);
      setSuccess(true);

      // Delay closing to show success state
      setTimeout(() => {
        setIsModalOpen(false);
        setIsSubmitting(false);
      }, 800);
    } catch (error: any) {
      setIsSubmitting(false);
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
                          {(() => {
                            const serviceSteps = steps.filter(s => s.serviceTypeId === item.id);
                            const totalSLA = serviceSteps.reduce((t, s) => t + (s.slaMinutes || 0), 0);
                            return (
                              <>
                                {item.generateMultipleOS ? `${serviceSteps.length} Ações Configuradas` : 'OS de Fluxo Único'}
                                {totalSLA > 0 && <span className="ml-2 text-sky-600">• SLA Total: {totalSLA}min</span>}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {activeTab === 'equipe' && (
                        <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                          {item.userIds?.length || 0} Membros associados
                        </div>
                      )}
                      {activeTab === 'etapa' && (
                        <>
                          {item.description && <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 italic">{item.description}</div>}
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                            {teams.find(t => t.id === item.targetTeamId)?.name || 'Sem equipe'} • {item.allowedItemIds?.length || 0} Insumos
                            {item.slaMinutes && (
                              <span className="ml-2 text-sky-600">• SLA: {item.slaMinutes}min</span>
                            )}
                          </div>
                        </>
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden animate-in zoom-in fade-in duration-300 max-h-[95vh] md:max-h-[90vh] flex flex-col">
            <div className="p-5 md:p-7 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center">
                  {activeTab === 'servico' ? <Settings size={20} className="text-sky-600" /> :
                    activeTab === 'leito' ? <BedIcon size={20} className="text-sky-600" /> :
                      activeTab === 'usuario' ? <Users size={20} className="text-sky-600" /> :
                        <Building2 size={20} className="text-sky-600" />}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-lg md:text-xl">
                    {isEditing ? 'Editar' : 'Novo'} {activeTab === 'servico' ? 'Fluxo' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {isEditing ? 'Atualize as informações abaixo' : 'Preencha os dados para cadastrar'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={22} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 flex-1 overflow-y-auto scrollbar-hide">
              <Input label={activeTab === 'usuario' ? 'Nome Completo' : 'Nome Identificador'} value={formData.name} onChange={v => setFormData({ ...formData, name: v })} required />

              {activeTab === 'empresa' && (
                <Input
                  label="CNPJ"
                  value={formData.cnpj || ''}
                  onChange={v => setFormData({ ...formData, cnpj: v })}
                  placeholder="00.000.000/0000-00"
                  required
                />
              )}

              {activeTab === 'unidade' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Building2 size={14} className="text-sky-500" /> Empresa
                  </label>
                  <select
                    value={formData.companyId || ''}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                    required
                  >
                    <option value="">Selecione uma empresa...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'servico' && (
                <Input label="Descrição" value={formData.description || ''} onChange={v => setFormData({ ...formData, description: v })} />
              )}

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
                      <option value="DISPONIVEL">Disponível</option>
                      <option value="OCUPADO">Ocupado</option>
                      <option value="HIGIENIZACAO">Higienização</option>
                      <option value="MANUTENCAO">Manutenção</option>
                      <option value="AGUARDANDO_ALTA">Aguardando Alta</option>
                      <option value="BLOQUEADO">Bloqueado</option>

                      {/* Mostrar status personalizados como opções extras se o nome bater com os ENUMs ou se quisermos estender futuramente */}
                      {bedStatusConfigs.filter(s => {
                        const companyId = formData.companyId || currentUser.companyId;
                        return s.companyId === companyId;
                      }).map(config => {
                        // Se o nome não for um dos padrões, ele pode ser um status customizado 
                        // Nota: O backend atual só aceita o ENUM padrão.
                        const isStandard = ['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO', 'MANUTENCAO', 'AGUARDANDO_ALTA', 'BLOQUEADO'].includes(config.name);
                        if (isStandard) return null;
                        return <option key={config.id} value={config.name}>{config.name}</option>;
                      })}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'usuario' && (
                <>
                  <Input label="E-mail" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} icon={<Mail size={16} />} required />
                  <Input
                    label="CPF"
                    value={formData.cpf ? maskCPF(formData.cpf) : ''}
                    onChange={v => {
                      const masked = maskCPF(v);
                      setFormData({ ...formData, cpf: masked });
                    }}
                    icon={<CreditCard size={16} />}
                    required
                    maxLength={14}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Login de Acesso" value={formData.login} onChange={v => setFormData({ ...formData, login: v })} icon={<Fingerprint size={16} />} required />
                    <Input label="Senha" type="password" value={formData.password} onChange={v => setFormData({ ...formData, password: v })} icon={<ShieldCheck size={16} />} required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-sky-500" /> Perfil de Acesso
                    </label>
                    <select
                      value={formData.role || 'VISUALIZADOR'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                      required
                    >
                      <option value="ADMIN">Administrador (Acesso Total)</option>
                      <option value="OPERACIONAL">Operacional (Executa Tarefas)</option>
                      <option value="VISUALIZADOR">Visualizador (Apenas Consulta)</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'insumo' && (
                <Input label="Custo Unitário (R$)" type="number" step="0.01" value={formData.unitCost} onChange={v => setFormData({ ...formData, unitCost: parseFloat(v) })} required />
              )}

              {activeTab === 'etapa' && (
                <div className="space-y-4">
                  <Input label="Descrição da Ação" value={formData.description || ''} onChange={v => setFormData({ ...formData, description: v })} />

                  <div className="grid grid-cols-2 gap-4">

                    <Input
                      label="SLA (minutos)"
                      value={formData.slaMinutes || ''}
                      onChange={(v) => setFormData({ ...formData, slaMinutes: v ? parseInt(v) : '' })}
                      type="number"
                      icon={<Clock size={14} className="text-sky-500" />}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                      <Users2 size={14} className="text-sky-500" /> Equipe Responsável
                    </label>
                    <select
                      value={formData.targetTeamId || ''}
                      onChange={(e) => setFormData({ ...formData, targetTeamId: e.target.value })}
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
                              setFormData({ ...formData, allowedItemIds: allowed });
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-black border transition-all ${isSelected
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
                          onClick={() => setFormData({ ...formData, color })}
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
                      <span className="font-bold text-slate-700 text-sm">Dependência Sequencial Automática (Fluxo de Ações)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.generateMultipleOS || false}
                      onChange={(e) => setFormData({ ...formData, generateMultipleOS: e.target.checked })}
                      className="w-5 h-5 rounded accent-sky-600 cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 italic px-2">
                    * Se ativado, este serviço utilizará as etapas definidas na aba "Etapas" para gerenciar o fluxo de trabalho.
                  </p>


                </div>
              )}

              <div className="pt-3 md:pt-4 flex space-x-2 md:space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3 md:py-4 bg-slate-100 text-slate-600 font-bold rounded-xl md:rounded-2xl hover:bg-slate-200 transition-colors uppercase text-xs disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || success}
                  className={`flex-1 py-3 md:py-4 font-bold rounded-xl md:rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-2 uppercase text-xs ${success ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-black'
                    } disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <Clock size={16} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : success ? (
                    <>
                      <CheckSquare size={16} />
                      <span>Salvo com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} className="md:w-[18px] md:h-[18px]" />
                      <span>Salvar Registro</span>
                    </>
                  )}
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

const Input = ({ label, value, onChange, required, type = "text", step, icon, maxLength, placeholder }: { label: string, value: string | number, onChange: (v: string) => void, required?: boolean, type?: string, step?: string, icon?: React.ReactNode, maxLength?: number, placeholder?: string }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
      {icon} {label}
    </label>
    <input
      type={type} step={step} required={required} value={value ?? ''} onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700 transition-all hover:bg-slate-100/50"
    />
  </div>
);

export default RegistrationManager;
