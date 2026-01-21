
import React, { useState, useEffect, useMemo } from 'react';
import { ServiceOrder, ServiceType, ActionStatus, Bed, User, OSStatus, Team } from '../types';
import { 
  ChevronRight, 
  User as UserIcon, 
  MapPin, 
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Play,
  History,
  Lock,
  Users2,
  HandMetal,
  ShieldAlert,
  PauseCircle,
  UserMinus,
  Timer as TimerIcon,
  Hourglass,
  Package,
  Receipt,
  FileCheck,
  CheckSquare,
  HelpCircle,
  ArrowRight,
  Timer,
  Hash,
  User as SilhouetteIcon
} from 'lucide-react';
import { db } from '../backend';
import QRCodeScanner from './QRCodeScanner';

interface ServiceOrdersKanbanProps {
  orders: ServiceOrder[];
  services: ServiceType[];
  actions: ActionStatus[];
  beds: Bed[];
  currentUser: User;
  teams: Team[];
  users: User[];
  onUpdateOrder: (order: ServiceOrder) => void;
  onCompleteOrder: (orderId: string, bedId: string) => void;
}

const COLUMNS: { id: OSStatus, label: string, color: string, icon: React.ReactNode }[] = [
  { id: 'BLOQUEADO', label: 'Bloqueado', color: 'bg-slate-200 text-slate-600', icon: <Lock size={14} /> },
  { id: 'PENDENTE', label: 'Pendente', color: 'bg-amber-100 text-amber-600', icon: <AlertCircle size={14} /> },
  { id: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'bg-sky-100 text-sky-600', icon: <Play size={14} /> },
  { id: 'CONCLUIDO', label: 'Concluído', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle size={14} /> }
];

const formatDuration = (ms: number): string => {
  if (ms < 0) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
};

const ServiceOrdersKanban: React.FC<ServiceOrdersKanbanProps> = ({ 
  orders, 
  services, 
  beds,
  currentUser,
  teams,
  users,
  onUpdateOrder
}) => {
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [isConfirmingItems, setIsConfirmingItems] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'ASSIGN' | 'COMPLETE' | null>(null);
  const [confirmedItemIds, setConfirmedItemIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanAttempts, setQrScanAttempts] = useState(0);
  const [showLoginFallback, setShowLoginFallback] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ login: '', password: '' });

  useEffect(() => {
    let interval: number;
    if (editingOrder) {
      interval = window.setInterval(() => setNow(Date.now()), 1000);
    }
    return () => clearInterval(interval);
  }, [editingOrder]);

  // Equipes que o usuário atual faz parte
  const currentUserTeams = useMemo(() => 
    teams.filter(t => t.userIds.includes(currentUser.id)).map(t => t.id),
  [teams, currentUser.id]);

  // Filtragem de ordens: Admins veem tudo, usuários comuns veem apenas suas equipes ou tarefas sem equipe
  const visibleOrders = useMemo(() => {
    if (currentUser.permissions.isAdmin) return orders;
    return orders.filter(order => 
      !order.assignedTeamId || currentUserTeams.includes(order.assignedTeamId)
    );
  }, [orders, currentUser.permissions.isAdmin, currentUserTeams]);

  const isMemberOfResponsibleTeam = (order: ServiceOrder) => {
    if (currentUser.permissions.isAdmin) return true;
    if (!order.assignedTeamId) return true;
    return currentUserTeams.includes(order.assignedTeamId);
  };

  const getBlockerOrder = (order: ServiceOrder) => {
    if (order.status !== 'BLOQUEADO' || order.step === 0) return null;
    return orders.find(o => o.groupId === order.groupId && o.step === order.step - 1);
  };

  const handleRequestAssign = () => {
    if (!editingOrder) return;
    setConfirmedItemIds([]);
    setConfirmationType('ASSIGN');
    setQrScanAttempts(0);
    setShowLoginFallback(false);
    setShowQRScanner(true);
  };

  const handleQRScan = async (scannedData: string) => {
    if (!editingOrder) return;
    
    // Verificar se o QR code corresponde ao usuário atual
    // O QR code pode conter o ID do usuário, o cpfHash ou o login
    const scannedUser = users.find(u => 
      u.id === scannedData || 
      u.cpfHash === scannedData ||
      u.login === scannedData ||
      u.cpf === scannedData
    );

    if (scannedUser && scannedUser.id === currentUser.id) {
      // QR code válido - prosseguir com atribuição
      setShowQRScanner(false);
      setQrScanAttempts(0);
      await performAssign();
    } else {
      // QR code inválido
      const newAttempts = qrScanAttempts + 1;
      setQrScanAttempts(newAttempts);
      
      if (newAttempts >= 2) {
        setShowLoginFallback(true);
        setShowQRScanner(false);
      } else {
        alert(`QR code inválido. Tentativa ${newAttempts} de 2.`);
      }
    }
  };

  const handleLoginFallback = async () => {
    if (!editingOrder) return;
    
    // Autenticar com login e senha
    const authenticatedUser = await db.authenticate(loginCredentials.login, loginCredentials.password);
    
    if (authenticatedUser && authenticatedUser.id === currentUser.id) {
      // Login válido - prosseguir com atribuição
      setShowLoginFallback(false);
      await performAssign();
    } else {
      alert('Login ou senha inválidos');
    }
  };

  const performAssign = async () => {
    if (!editingOrder) return;
    const assigned = await db.assignOrder(editingOrder.id, currentUser.id);
    if (assigned) {
      const updated = await db.updateOrderStatus(assigned.id, 'EM_ANDAMENTO', currentUser.id, 'Tarefa assumida e iniciada após conferência.');
      if (updated) {
        onUpdateOrder(updated);
        setEditingOrder(null);
        setIsConfirmingItems(false);
        setShowQRScanner(false);
        setShowLoginFallback(false);
        setQrScanAttempts(0);
      }
    }
  };

  const handleUnassign = async () => {
    if (!editingOrder || !currentUser.permissions.isAdmin) return;
    if (!confirm("Deseja remover o responsável atual desta tarefa?")) return;
    const updated = await db.unassignOrder(editingOrder.id, currentUser.id);
    if (updated) {
      onUpdateOrder(updated);
      setEditingOrder(updated);
    }
  };

  const handleRequestComplete = () => {
    if (!editingOrder) return;
    setConfirmedItemIds([]);
    setConfirmationType('COMPLETE');
    setIsConfirmingItems(true);
  };

  const handleConfirmAssign = async () => {
    if (!editingOrder) return;
    setIsConfirmingItems(false);
    setConfirmationType(null);
    await performAssign();
  };

  const handleConfirmComplete = async () => {
    if (!editingOrder) return;
    const updated = await db.updateOrderStatus(editingOrder.id, 'CONCLUIDO', currentUser.id, 'Etapa finalizada após conferência final de itens.');
    if (updated) {
      onUpdateOrder(updated);
      setEditingOrder(null);
      setIsConfirmingItems(false);
    }
  };

  const getDurations = (order: ServiceOrder) => {
    const statusTimes: Record<string, number> = { BLOQUEADO: 0, PENDENTE: 0, EM_ANDAMENTO: 0, CONCLUIDO: 0 };
    const history = [...order.history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < history.length; i++) {
      const start = new Date(history[i].timestamp).getTime();
      const end = i < history.length - 1 
        ? new Date(history[i+1].timestamp).getTime() 
        : (order.status === 'CONCLUIDO' ? new Date(order.finishedAt!).getTime() : now);
      statusTimes[history[i].status] += (end - start);
    }
    const totalTime = (order.status === 'CONCLUIDO' ? new Date(order.finishedAt!).getTime() : now) - new Date(order.requestedAt).getTime();
    return { statusTimes, totalTime, history };
  };

  const calculateItemsTotal = (order: ServiceOrder) => {
    return (order.items || []).reduce((acc, it) => acc + (it.unitCost * it.quantity), 0);
  };

  const toggleItemConfirmation = (itemId: string) => {
    setConfirmedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const allItemsConfirmed = editingOrder ? confirmedItemIds.length === (editingOrder.items || []).length : false;
  const requesterName = editingOrder ? users.find(u => u.id === editingOrder.requesterUserId)?.name : 'N/A';
  const blocker = editingOrder ? getBlockerOrder(editingOrder) : null;

  return (
    <div className="relative">
      <div className="flex space-x-3 md:space-x-4 overflow-x-auto pb-4 md:pb-8 min-h-[500px] md:min-h-[600px] scrollbar-hide">
        {COLUMNS.map(col => (
          <div key={col.id} className="min-w-[280px] md:min-w-[300px] w-[280px] md:w-[300px] flex-shrink-0">
            <div className={`p-2 md:p-3 rounded-t-lg md:rounded-t-xl border-b-2 flex justify-between items-center ${col.color}`}>
              <div className="flex items-center space-x-2">
                {col.icon}
                <span className="font-bold text-[10px] md:text-xs uppercase tracking-widest">{col.label}</span>
              </div>
              <span className="bg-white/50 text-[9px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded-full font-black">
                {visibleOrders.filter(o => o.status === col.id).length}
              </span>
            </div>
            <div className="bg-slate-50/50 p-2 md:p-3 rounded-b-lg md:rounded-b-xl border-x border-b border-slate-200 space-y-3 md:space-y-4 min-h-[400px] md:min-h-[500px]">
              {visibleOrders
                .filter(o => o.status === col.id)
                .map(order => (
                  <KanbanCard 
                    key={order.id} 
                    order={order} 
                    currentUser={currentUser}
                    team={teams.find(t => t.id === order.assignedTeamId)}
                    bed={beds.find(b => b.id === order.bedId)} 
                    responsibleName={users.find(u => u.id === order.responsibleUserId)?.name}
                    blockerStepName={getBlockerOrder(order)?.subServiceName}
                    onClick={() => {
                      setEditingOrder(order);
                      setIsConfirmingItems(false);
                      setConfirmationType(null);
                    }} 
                  />
                ))
              }
            </div>
          </div>
        ))}
      </div>

      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col lg:flex-row h-[95vh] md:h-[90vh] lg:h-auto">
            
            <div className="bg-slate-900 lg:w-80 text-white p-4 md:p-6 lg:p-8 flex flex-col shrink-0 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <span className="bg-sky-500 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                  <Hash size={10} /> {editingOrder.id.slice(-6)}
                </span>
              </div>
              
              <h4 className="text-2xl font-black mb-1 leading-tight">{editingOrder.subServiceName || services.find(s => s.id === editingOrder.serviceId)?.name}</h4>
              <p className="text-sky-400 font-bold text-sm mb-6 flex items-center gap-2"><MapPin size={14}/> {beds.find(b => b.id === editingOrder.bedId)?.name}</p>

              <div className="space-y-6 flex-1">
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Solicitante da Ordem</p>
                  <p className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    <UserIcon size={12} className="text-sky-500" />
                    {requesterName}
                  </p>
                </div>

                {blocker && (
                   <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Lock size={12} /> Status: Bloqueado
                      </p>
                      <p className="text-[10px] font-bold text-white">Aguardando a conclusão de: <span className="text-rose-300 uppercase">{blocker.subServiceName}</span></p>
                   </div>
                )}

                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Custo da Etapa</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-emerald-400">R$ {calculateItemsTotal(editingOrder).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SLA da Etapa</p>
                  <div className="flex items-end gap-2">
                    <span className="text-xl font-black text-white">{formatDuration(getDurations(editingOrder).totalTime)}</span>
                    <TimerIcon size={16} className="text-sky-400 mb-1 animate-pulse" />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Executor Responsável</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-black text-sky-400 text-sm shrink-0 border border-slate-600">
                      {editingOrder.responsibleUserId ? users.find(u => u.id === editingOrder.responsibleUserId)?.name.charAt(0) : <SilhouetteIcon size={20} className="text-slate-500" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Atribuído a:</p>
                      <p className="text-xs font-bold truncate text-white">
                        {editingOrder.responsibleUserId ? users.find(u => u.id === editingOrder.responsibleUserId)?.name : 'Ninguém atribuído'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 md:p-6 lg:p-8 bg-white flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 md:pr-4 scrollbar-hide mb-4 md:mb-6 space-y-6 md:space-y-8">
                {isConfirmingItems ? (
                  <div className="animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg">
                        <CheckSquare size={24} />
                      </div>
                      <div>
                        <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none mb-1">
                          {confirmationType === 'ASSIGN' ? 'Conferência para Atribuição' : 'Conferência Final'}
                        </h5>
                        <p className="text-xs text-slate-500 font-medium">Confirme fisicamente os itens para prosseguir.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {(editingOrder.items || []).map((it, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => toggleItemConfirmation(it.itemId)}
                          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${confirmedItemIds.includes(it.itemId) ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                        >
                          <div className="flex items-center gap-4">
                             <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${confirmedItemIds.includes(it.itemId) ? 'bg-emerald-500 text-white' : 'bg-white text-slate-200 border border-slate-200'}`}>
                               <CheckCircle size={18} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{it.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qtd Solicitada: {it.quantity}</p>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button 
                        onClick={() => { setIsConfirmingItems(false); setConfirmationType(null); }}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200"
                      >
                        Voltar
                      </button>
                      <button 
                        disabled={!allItemsConfirmed}
                        onClick={confirmationType === 'ASSIGN' ? handleConfirmAssign : handleConfirmComplete}
                        className={`flex-1 py-4 font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 ${allItemsConfirmed ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                        <FileCheck size={18} /> 
                        <span>{confirmationType === 'ASSIGN' ? 'Confirmar e Iniciar' : 'Confirmar e Concluir'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                                  <th className="px-6 py-4 text-right">Valor Unit.</th>
                                  <th className="px-6 py-4 text-right">Subtotal</th>
                               </tr>
                            </thead>
                            <tbody className="text-xs">
                               {(editingOrder.items || []).map((it, idx) => (
                                 <tr key={idx} className="border-t border-slate-100 hover:bg-white transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700 uppercase text-[10px]">{it.name}</td>
                                    <td className="px-6 py-4 text-center font-black text-slate-500">{it.quantity}</td>
                                    <td className="px-6 py-4 text-right text-slate-400 font-medium">R$ {it.unitCost.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-800">R$ {(it.unitCost * it.quantity).toFixed(2)}</td>
                                 </tr>
                               ))}
                               {(!editingOrder.items || editingOrder.items.length === 0) && (
                                 <tr><td colSpan={4} className="px-6 py-8 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">Nenhum item associado à OS</td></tr>
                               )}
                            </tbody>
                          </table>
                       </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center space-x-2">
                        <History size={16} className="text-sky-500" /> <span>Rastreabilidade de Execução</span>
                      </h5>
                      <div className="space-y-6">
                        {getDurations(editingOrder).history.map((h, i, arr) => {
                          const prevTime = i === 0 ? new Date(editingOrder.requestedAt).getTime() : new Date(arr[i-1].timestamp).getTime();
                          const diff = new Date(h.timestamp).getTime() - prevTime;
                          const isTooFast = diff < 60000 && diff > 0 && h.status === 'CONCLUIDO';
                          
                          return (
                            <div key={i} className="relative pl-8 pb-4 border-l-2 border-slate-100 ml-2">
                              <div className={`absolute left-[-9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                                h.status === 'CONCLUIDO' ? 'bg-emerald-500' : 
                                h.status === 'EM_ANDAMENTO' ? 'bg-sky-500' : 'bg-amber-500'
                              }`} />
                              <div className="flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider">{h.status.replace('_', ' ')}</span>
                                  <div className="flex items-center gap-2">
                                     {i > 0 && (
                                       <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm ${isTooFast ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                         {isTooFast && <Timer size={10} className="animate-pulse" />}
                                         +{formatDuration(diff)}
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
                  </>
                )}
              </div>

              {!isConfirmingItems && (
                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    {editingOrder.status === 'BLOQUEADO' ? (
                      <button 
                        onClick={() => setEditingOrder(null)}
                        className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-black transition-all"
                      >
                        <Lock size={18} /> <span>Tarefa Bloqueada - Fechar</span>
                      </button>
                    ) : editingOrder.status === 'CONCLUIDO' ? (
                       <button 
                        onClick={() => setEditingOrder(null)}
                        className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-black transition-all"
                      >
                        <span>Histórico Finalizado - Fechar</span>
                      </button>
                    ) : isMemberOfResponsibleTeam(editingOrder) ? (
                      <div className="flex flex-1 gap-3">
                        {!editingOrder.responsibleUserId ? (
                          <button 
                            onClick={handleRequestAssign}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
                          >
                            <HandMetal size={18} /> <span>Atribuir Atendimento</span>
                          </button>
                        ) : (
                          <>
                             {editingOrder.status === 'PENDENTE' && (
                                <button onClick={handleRequestAssign} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95">
                                  <Play size={18} /> <span>Retomar Trabalho</span>
                                </button>
                             )}
                             {editingOrder.status === 'EM_ANDAMENTO' && (
                                <button onClick={handleRequestComplete} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95">
                                  <CheckCircle size={18} /> <span>Finalizar Etapa</span>
                                </button>
                             )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 text-center p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Executor sem permissão</p>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setEditingOrder(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 rounded-2xl font-black uppercase text-[10px] transition-all"
                    >
                      Fechar
                    </button>
                  </div>

                  {editingOrder.responsibleUserId && currentUser.permissions.isAdmin && editingOrder.status !== 'CONCLUIDO' && (
                    <button 
                      onClick={handleUnassign}
                      className="w-full bg-rose-50 text-rose-500 py-3 rounded-2xl hover:bg-rose-100 transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 flex items-center justify-center gap-2"
                    >
                      <UserMinus size={14} /> <span>Forçar Remoção de Executor</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showQRScanner && (
        <QRCodeScanner
          onScan={handleQRScan}
          onClose={() => {
            setShowQRScanner(false);
            if (qrScanAttempts >= 2) {
              setShowLoginFallback(true);
            }
          }}
          onError={(error) => {
            // Ignorar erros de play interrompido (comuns em React StrictMode)
            if (error.includes('play() request was interrupted') || 
                error.includes('media was removed from the document')) {
              console.debug('Erro de play ignorado (comum em desenvolvimento):', error);
              return;
            }
            
            console.error('Erro no scanner:', error);
            setQrScanAttempts(prev => {
              const newAttempts = prev + 1;
              if (newAttempts >= 2) {
                setShowQRScanner(false);
                setShowLoginFallback(true);
              }
              return newAttempts;
            });
          }}
        />
      )}

      {showLoginFallback && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ShieldAlert size={20} className="text-amber-500" />
                Autenticação Alternativa
              </h4>
              <button onClick={() => setShowLoginFallback(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 font-medium">
                O scanner de QR code falhou. Por favor, insira suas credenciais para continuar:
              </p>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Login
                </label>
                <input
                  type="text"
                  value={loginCredentials.login}
                  onChange={(e) => setLoginCredentials({ ...loginCredentials, login: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                  placeholder="Digite seu login"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={loginCredentials.password}
                  onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
                  placeholder="Digite sua senha"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowLoginFallback(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLoginFallback}
                  className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KanbanCard: React.FC<{ order: ServiceOrder; bed: Bed | undefined; team: Team | undefined; responsibleName?: string; currentUser: User; blockerStepName?: string; onClick: () => void }> = ({ order, bed, team, responsibleName, currentUser, blockerStepName, onClick }) => {
  const [totalTime, setTotalTime] = useState('');
  useEffect(() => {
    const update = () => {
      const end = order.status === 'CONCLUIDO' ? new Date(order.finishedAt!).getTime() : Date.now();
      const diff = end - new Date(order.requestedAt).getTime();
      setTotalTime(formatDuration(diff));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [order]);

  const itemsCost = (order.items || []).reduce((acc, it) => acc + (it.unitCost * it.quantity), 0);

  return (
    <div onClick={onClick} className={`bg-white p-4 md:p-5 rounded-xl md:rounded-2xl border shadow-sm transition-all cursor-pointer group relative overflow-hidden flex flex-col min-h-[170px] md:min-h-[190px] h-[170px] md:h-[190px] ${order.status === 'BLOQUEADO' ? 'border-slate-100 grayscale-[0.5]' : 'border-slate-200 hover:shadow-xl hover:-translate-y-1'}`}>
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-black border border-slate-100">
        <Hash size={8} /> {order.id.slice(-6)}
      </div>

      {order.status === 'BLOQUEADO' && (
        <div className="absolute top-2 right-2 bg-slate-100 text-slate-400 p-1 rounded-lg">
          <Lock size={12} />
        </div>
      )}
      
      <div className="flex justify-between items-start mb-2 mt-2">
        <h5 className="text-lg font-black text-slate-800 leading-none truncate pr-2">{bed?.name}</h5>
        <div className={`w-2 h-2 rounded-full shrink-0 ${order.status === 'BLOQUEADO' ? 'bg-slate-300' : order.status === 'EM_ANDAMENTO' ? 'bg-sky-500 animate-pulse' : order.status === 'CONCLUIDO' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      </div>
      
      <div className="flex-1 space-y-2">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-tight truncate">{order.subServiceName || 'Atendimento Geral'}</p>
        
        {order.status === 'BLOQUEADO' && blockerStepName && (
           <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-400 bg-rose-50 px-2 py-1 rounded-lg uppercase tracking-tighter">
              <ShieldAlert size={10} />
              <span className="truncate">Aguardando: {blockerStepName}</span>
           </div>
        )}

        <div className="flex flex-wrap gap-2">
          {itemsCost > 0 && (
            <div className="flex items-center space-x-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg w-fit">
              <Receipt size={10} /> <span>R$ {itemsCost.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
        <div className="flex items-center gap-2">
           <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm border ${responsibleName ? 'bg-sky-500 border-sky-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
              {responsibleName ? (
                <span className="text-[10px] font-black">{responsibleName.charAt(0)}</span>
              ) : (
                <SilhouetteIcon size={14} />
              )}
           </div>
           <div className="flex flex-col">
              <div className="flex items-center space-x-1 text-[9px] text-slate-400 font-black uppercase">
                <Clock size={10} />
                <span>{totalTime}</span>
              </div>
           </div>
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
};

export default ServiceOrdersKanban;
