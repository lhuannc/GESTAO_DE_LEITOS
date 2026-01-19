
import React, { useState, useMemo } from 'react';
import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, OSStatus, SubOrderConfig, Team, ComplementItem } from '../types';
import { 
  Building2, Hospital, Layers, Bed as BedIcon, Settings, 
  Users, Plus, Trash2, Edit2, X, Save,
  ListPlus, Info, Users2, ArrowDown, ArrowUp, Lock,
  Package, DollarSign, CheckSquare, Link as LinkIcon,
  UserCheck, Mail, ShieldCheck, Fingerprint, CreditCard
} from 'lucide-react';
import { maskCPF, unmaskCPF, md5 } from '../utils';

type TabId = 'empresa' | 'unidade' | 'setor' | 'leito' | 'servico' | 'usuario' | 'equipe' | 'insumo';

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
      default: return [];
    }
  }, [activeTab, companies, units, sectors, beds, services, users, teams, complementItems, currentUser]);

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
    setFormData({ 
      companyId: currentUser.companyId,
      userIds: [],
      permissions: { pages: ['dashboard', 'ordens'], modules: ['bed'], isAdmin: false },
      config: { generateMultipleOS: false, subOrders: [] }
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setIsEditing(true);
    const formDataToSet: any = { 
      ...item,
      userIds: item.userIds || [],
      config: item.config || { generateMultipleOS: false, subOrders: [] }
    };
    
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
      servico: 'services', usuario: 'users', equipe: 'teams', insumo: 'complementItems'
    };
    
    // Se for usuário, processar CPF e gerar hash
    if (activeTab === 'usuario' && formData.cpf) {
      const cpfUnmasked = unmaskCPF(formData.cpf);
      if (cpfUnmasked.length === 11) {
        formData.cpf = cpfUnmasked;
        formData.cpfHash = md5(cpfUnmasked);
      }
    }
    
    await onSave(typeMap[activeTab], formData);
    setIsModalOpen(false);
  };

  const addSubOrder = () => {
    const subOrders = [...(formData.config?.subOrders || [])];
    subOrders.push({ 
      name: '', 
      initialStatus: subOrders.length === 0 ? 'PENDENTE' : 'BLOQUEADO', 
      targetTeamId: '',
      allowedItemIds: []
    });
    setFormData({ ...formData, config: { ...formData.config, subOrders } });
  };

  const toggleItemInSubOrder = (stepIdx: number, itemId: string) => {
    const subOrders = [...(formData.config.subOrders || [])];
    const allowed = [...(subOrders[stepIdx].allowedItemIds || [])];
    const idx = allowed.indexOf(itemId);
    if (idx > -1) allowed.splice(idx, 1);
    else allowed.push(itemId);
    subOrders[stepIdx] = { ...subOrders[stepIdx], allowedItemIds: allowed };
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
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-64 space-y-1">
        {tabsConfig.map(tab => (
          <button 
            key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg font-medium transition-all ${activeTab === tab.id ? 'bg-sky-50 text-sky-700 shadow-sm border border-sky-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {tab.icon} <span>{tab.label}</span>
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
                activeTab === 'insumo' ? 'complementItems' : 'companies'
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
                            {item.config?.generateMultipleOS ? `${item.config.subOrders?.length} Etapas Configuradas` : 'OS de Fluxo Único'}
                          </div>
                        )}
                        {activeTab === 'equipe' && (
                          <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">
                            {item.userIds?.length || 0} Membros associados
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-black text-slate-800 uppercase tracking-tight">{isEditing ? 'Editar' : 'Novo'} {activeTab}</h4>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto scrollbar-hide">
              <Input label={activeTab === 'usuario' ? 'Nome Completo' : 'Nome Identificador'} value={formData.name} onChange={v => setFormData({...formData, name: v})} required />

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

              {activeTab === 'equipe' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <UserCheck size={14} className="text-sky-500" /> Associar Membros da Equipe
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {users.filter(u => u.companyId === formData.companyId).map(user => {
                      const isMember = (formData.userIds || []).includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleUserInTeam(user.id)}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${isMember ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-100 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'}`}
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
                        onChange={(e) => setFormData({...formData, config: {...formData.config, generateMultipleOS: e.target.checked}})}
                        className="w-5 h-5 rounded accent-sky-600 cursor-pointer"
                      />
                   </div>

                   {formData.config?.generateMultipleOS && (
                      <div className="space-y-4">
                        {formData.config.subOrders?.map((sub: SubOrderConfig, idx: number) => (
                          <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                               <div className="flex justify-between items-center">
                                 <input 
                                   placeholder={`Etapa ${idx + 1}`} value={sub.name} 
                                   onChange={(e) => {
                                      const subOrders = [...formData.config.subOrders];
                                      subOrders[idx] = { ...subOrders[idx], name: e.target.value };
                                      setFormData({...formData, config: {...formData.config, subOrders}});
                                   }}
                                   className="flex-1 text-xs font-bold p-2 bg-slate-50 rounded-lg outline-none"
                                   required
                                 />
                                 <button type="button" onClick={() => {
                                   const subOrders = formData.config.subOrders.filter((_:any, i:number) => i !== idx);
                                   setFormData({...formData, config: {...formData.config, subOrders}});
                                 }} className="text-rose-400 p-2 ml-2 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                               </div>
                               
                               <div className="grid grid-cols-2 gap-2">
                                 <div>
                                   <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Equipe</label>
                                   <select 
                                     value={sub.targetTeamId} onChange={(e) => {
                                        const subOrders = [...formData.config.subOrders];
                                        subOrders[idx] = { ...subOrders[idx], targetTeamId: e.target.value };
                                        setFormData({...formData, config: {...formData.config, subOrders}});
                                     }}
                                     className="w-full text-[10px] font-black p-2 bg-slate-50 rounded-lg uppercase"
                                     required
                                   >
                                     <option value="">Equipe...</option>
                                     {teams.filter(t => t.companyId === formData.companyId).map(t => (
                                       <option key={t.id} value={t.id}>{t.name}</option>
                                     ))}
                                   </select>
                                 </div>
                                 <div className="flex items-center space-x-2 pt-4">
                                    <Lock size={12} className={idx === 0 ? 'text-emerald-500' : 'text-slate-300'} />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{idx === 0 ? 'Liberado' : 'Bloqueado'}</span>
                                 </div>
                               </div>

                               <div>
                                  <label className="text-[8px] font-black uppercase text-slate-400 block mb-2">Insumos Permitidos nesta Etapa</label>
                                  <div className="flex flex-wrap gap-1">
                                    {complementItems.map(item => (
                                      <button 
                                        key={item.id} type="button" 
                                        onClick={() => toggleItemInSubOrder(idx, item.id)}
                                        className={`px-2 py-1 rounded-full text-[9px] font-black border transition-all ${sub.allowedItemIds?.includes(item.id) ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                      >
                                        {item.name}
                                      </button>
                                    ))}
                                  </div>
                               </div>
                          </div>
                        ))}
                        <button type="button" onClick={addSubOrder} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:text-sky-500 hover:border-sky-300 flex items-center justify-center space-x-2 bg-slate-50/30">
                          <Plus size={16} /> <span>Anexar Etapa</span>
                        </button>
                      </div>
                   )}
                </div>
              )}

              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors uppercase text-xs">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-colors shadow-lg flex items-center justify-center space-x-2 uppercase text-xs">
                  <Save size={18} /> <span>Salvar Registro</span>
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
