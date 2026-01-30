
import React from 'react';
import { ServiceOrder, ServiceType } from '@gestao-leitos/types';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

interface OrderDependencyTableProps {
    orders: ServiceOrder[];
    services: ServiceType[];
}

const OrderDependencyTable: React.FC<OrderDependencyTableProps> = ({ orders, services }) => {
    // Filter only orders that have dependencies or are blocking others
    const dependentOrders = orders.filter(o =>
        (o.dependsOnOrderIds && o.dependsOnOrderIds.length > 0) ||
        orders.some(other => other.dependsOnOrderIds?.includes(o.id))
    );

    if (dependentOrders.length === 0) {
        return (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Nenhuma dependência ativa encontrada</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Lock size={16} className="text-slate-400" />
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Tabela de Dependências</h3>
            </div>
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="px-6 py-4">ID / Ação</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Depende De (Espera por...)</th>
                        <th className="px-6 py-4">Bloqueia (Impede...)</th>
                    </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                    {dependentOrders.map(order => {
                        const serviceName = services.find(s => s.id === order.serviceTypeId)?.name || 'N/A';

                        // Quem este bloqueia?
                        const blockedByThis = orders.filter(o => o.dependsOnOrderIds?.includes(order.id));

                        return (
                            <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="font-bold text-slate-700 block">{order.subServiceName || serviceName}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded">#{order.id.slice(-6)}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${order.status === 'BLOQUEADO' ? 'bg-slate-200 text-slate-600' :
                                            order.status === 'PENDENTE' ? 'bg-amber-100 text-amber-600' :
                                                order.status === 'EM_ANDAMENTO' ? 'bg-sky-100 text-sky-600' :
                                                    'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {order.dependsOnOrderIds && order.dependsOnOrderIds.length > 0 ? (
                                        <div className="space-y-1">
                                            {order.dependsOnOrderIds.map(depId => {
                                                const depOrder = orders.find(o => o.id === depId);
                                                return (
                                                    <div key={depId} className="flex items-center gap-2 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                                                        <Lock size={10} />
                                                        <span>{depOrder?.subServiceName || depId.slice(-6)}</span>
                                                        <span className="text-rose-300">({depOrder?.status || '?'})</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 font-bold">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {blockedByThis.length > 0 ? (
                                        <div className="space-y-1">
                                            {blockedByThis.map(blocked => (
                                                <div key={blocked.id} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                    <ShieldAlert size={10} />
                                                    <span>{blocked.subServiceName || blocked.id.slice(-6)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 font-bold">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default OrderDependencyTable;
