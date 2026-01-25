import React, { useMemo, useState } from 'react';
import { Bed, ServiceOrder, ServiceType, Sector, User, Step } from '../types';
import { Download, Filter, Search as SearchIcon } from 'lucide-react';

interface ActionsListProps {
  orders: ServiceOrder[];
  services: ServiceType[];
  beds: Bed[];
  sectors: Sector[];
  users: User[];
  steps: Step[];
}

interface ProcessedAction {
  // Flow info
  flowId: string;
  flowName: string;
  flowStatus: string;
  flowRequestDate: string;
  flowCompletionDate: string;
  
  // Action info
  actionId: string;
  actionName: string;
  actionStatus: string;
  sector: string;
  bed: string;
  requesterUser: string;
  assignedUser: string;
  
  // Dates
  requestDate: string;
  blockStartDate: string;
  blockEndDate: string;
  pendingStartDate: string;
  pendingEndDate: string;
  inProgressStartDate: string;
  completionDate: string;
  
  // Cost and SLA
  actionCost: string;
  actionSLA: string;
  slaStatus: string;
  
  // Dependencies
  associatedActionId: string;
  associatedActionName: string;
  associatedFlowName: string;
  associatedCompletionDate: string;
}

const ActionsList: React.FC<ActionsListProps> = ({ orders, services, beds, sectors, users, steps }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to calculate duration from PENDENTE to completion
  const calculateDuration = (order: ServiceOrder): number => {
    if (!order.history || order.history.length === 0) return 0;
    
    const sortedHistory = [...order.history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const firstPending = sortedHistory.find(h => h.status === 'PENDENTE');
    if (!firstPending) return 0;
    
    const start = new Date(firstPending.timestamp);
    const end = order.finishedAt ? new Date(order.finishedAt) : new Date();
    
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  };

  // Helper to get status transition dates
  const getStatusDates = (order: ServiceOrder) => {
    if (!order.history || order.history.length === 0) {
      return {
        blockStart: '',
        blockEnd: '',
        pendingStart: '',
        pendingEnd: '',
        inProgressStart: '',
      };
    }

    const sortedHistory = [...order.history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const blockStart = sortedHistory.find(h => h.status === 'BLOQUEADO');
    const blockEnd = sortedHistory.findLast((h, i) => 
      h.status === 'BLOQUEADO' && i < sortedHistory.length - 1 && sortedHistory[i + 1].status !== 'BLOQUEADO'
    );
    
    const pendingStart = sortedHistory.find(h => h.status === 'PENDENTE');
    const pendingEnd = sortedHistory.findLast((h, i) => 
      h.status === 'PENDENTE' && i < sortedHistory.length - 1 && sortedHistory[i + 1].status !== 'PENDENTE'
    );
    
    const inProgressStart = sortedHistory.find(h => h.status === 'EM_ANDAMENTO');

    return {
      blockStart: blockStart?.timestamp || '',
      blockEnd: blockEnd?.timestamp || '',
      pendingStart: pendingStart?.timestamp || '',
      pendingEnd: pendingEnd?.timestamp || '',
      inProgressStart: inProgressStart?.timestamp || '',
    };
  };

  // Process orders into table data
  const processedActions = useMemo(() => {
    const flowGroups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!flowGroups[order.groupId]) flowGroups[order.groupId] = [];
      flowGroups[order.groupId].push(order);
    });

    const actions: ProcessedAction[] = [];

    orders.forEach(order => {
      const service = services.find(s => s.id === order.serviceId);
      const bed = beds.find(b => b.id === order.bedId);
      const sector = bed ? sectors.find(s => s.id === bed.sectorId) : null;
      const requester = users.find(u => u.id === order.requestedBy);
      const assigned = users.find(u => u.id === order.responsibleUserId);
      
      const flowOrders = flowGroups[order.groupId] || [];
      const flowStatus = flowOrders.every(o => o.status === 'CONCLUIDO') ? 'CONCLUIDO' : 
                        flowOrders.some(o => o.status === 'EM_ANDAMENTO') ? 'EM_ANDAMENTO' : 'PENDENTE';
      const flowStart = flowOrders.reduce((min, o) => {
        const date = new Date(o.requestedAt);
        return date < min ? date : min;
      }, new Date(flowOrders[0]?.requestedAt || Date.now()));
      const flowEnd = flowStatus === 'CONCLUIDO' ? 
        flowOrders.reduce((max, o) => {
          if (!o.finishedAt) return max;
          const date = new Date(o.finishedAt);
          return date > max ? date : max;
        }, new Date(0)) : new Date(0);

      const statusDates = getStatusDates(order);
      const duration = calculateDuration(order);
      
      const subOrderConfig = service?.config?.subOrders?.[order.step];
      const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;
      const slaStatus = step?.slaMinutes && duration > step.slaMinutes && order.status !== 'BLOQUEADO' ? 'Fora do Prazo' : 'No Prazo';

      // Get first dependency
      const depOrderId = order.dependsOnOrderIds?.[0];
      const depOrder = depOrderId ? orders.find(o => o.id === depOrderId) : null;
      const depService = depOrder ? services.find(s => s.id === depOrder.serviceId) : null;

      actions.push({
        flowId: order.groupId,
        flowName: service?.name || '',
        flowStatus,
        flowRequestDate: flowStart.toISOString(),
        flowCompletionDate: flowStatus === 'CONCLUIDO' ? flowEnd.toISOString() : '',
        
        actionId: order.id,
        actionName: order.subServiceName || `Ação ${order.step + 1}`,
        actionStatus: order.status,
        sector: sector?.name || '',
        bed: bed?.name || '',
        requesterUser: requester?.name || '',
        assignedUser: assigned?.name || '',
        
        requestDate: order.requestedAt,
        blockStartDate: statusDates.blockStart,
        blockEndDate: statusDates.blockEnd,
        pendingStartDate: statusDates.pendingStart,
        pendingEndDate: statusDates.pendingEnd,
        inProgressStartDate: statusDates.inProgressStart,
        completionDate: order.finishedAt || '',
        
        actionCost: step?.cost?.toString() || '0',
        actionSLA: step?.slaMinutes?.toString() || '',
        slaStatus,
        
        associatedActionId: depOrder?.id || '',
        associatedActionName: depOrder?.subServiceName || '',
        associatedFlowName: depService?.name || '',
        associatedCompletionDate: depOrder?.finishedAt || '',
      });
    });

    return actions;
  }, [orders, services, beds, sectors, users, steps]);

  // Apply filters
  const filteredActions = useMemo(() => {
    return processedActions.filter(action => {
      if (startDate && new Date(action.requestDate) < new Date(startDate)) return false;
      if (endDate && new Date(action.requestDate) > new Date(endDate)) return false;
      if (statusFilter && action.actionStatus !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return action.flowName.toLowerCase().includes(search) ||
               action.actionName.toLowerCase().includes(search) ||
               action.bed.toLowerCase().includes(search) ||
               action.sector.toLowerCase().includes(search);
      }
      return true;
    });
  }, [processedActions, startDate, endDate, statusFilter, searchTerm]);

  // CSV Export
  const exportToCSV = () => {
    const headers = [
      'ID do Fluxo', 'Nome do Fluxo', 'Status do Fluxo', 'Data da Solicitação do Fluxo', 'Data da Conclusão do Fluxo',
      'ID da Ação', 'Nome da Ação', 'Status da Ação', 'Setor', 'Leito',
      'Usuário Solicitante', 'Usuário Atribuído',
      'Data da Solicitação da Ação', 'Data de Início Bloqueio', 'Data de Fim Bloqueio',
      'Data de Início Pendente', 'Data de Fim Pendente', 'Data de Início Em Andamento', 'Data de Conclusão',
      'Custo da Ação', 'SLA da Ação', 'Status SLA da Ação',
      'ID da Ação Associada', 'Nome da Ação Associada', 'Nome do Fluxo da Ação Associada', 'Data de Conclusão da Ação Associada'
    ];

    const formatDate = (date: string) => date ? new Date(date).toLocaleString('pt-BR') : '';

    const rows = filteredActions.map(action => [
      action.flowId,
      action.flowName,
      action.flowStatus,
      formatDate(action.flowRequestDate),
      formatDate(action.flowCompletionDate),
      action.actionId,
      action.actionName,
      action.actionStatus,
      action.sector,
      action.bed,
      action.requesterUser,
      action.assignedUser,
      formatDate(action.requestDate),
      formatDate(action.blockStartDate),
      formatDate(action.blockEndDate),
      formatDate(action.pendingStartDate),
      formatDate(action.pendingEndDate),
      formatDate(action.inProgressStartDate),
      formatDate(action.completionDate),
      action.actionCost,
      action.actionSLA,
      action.slaStatus,
      action.associatedActionId,
      action.associatedActionName,
      action.associatedFlowName,
      formatDate(action.associatedCompletionDate)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const filename = `acoes_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = (date: string) => date ? new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Pesquisa de Ações</h2>
          <p className="text-sm text-slate-500 mt-1">Visualize e exporte dados detalhados das ações</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
        >
          <Download size={16} />
          Exportar CSV ({filteredActions.length})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-wider">
          <Filter size={16} />
          Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="EM_ANDAMENTO">EM ANDAMENTO</option>
              <option value="CONCLUIDO">CONCLUÍDO</option>
              <option value="BLOQUEADO">BLOQUEADO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Buscar</label>
            <div className="relative">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Fluxo, ação, leito..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                <th className="px-3 py-3 whitespace-nowrap">ID Fluxo</th>
                <th className="px-3 py-3 whitespace-nowrap">Nome Fluxo</th>
                <th className="px-3 py-3 whitespace-nowrap">Status Fluxo</th>
                <th className="px-3 py-3 whitespace-nowrap">Solicitação Fluxo</th>
                <th className="px-3 py-3 whitespace-nowrap">Conclusão Fluxo</th>
                <th className="px-3 py-3 whitespace-nowrap">ID Ação</th>
                <th className="px-3 py-3 whitespace-nowrap">Nome Ação</th>
                <th className="px-3 py-3 whitespace-nowrap">Status Ação</th>
                <th className="px-3 py-3 whitespace-nowrap">Setor</th>
                <th className="px-3 py-3 whitespace-nowrap">Leito</th>
                <th className="px-3 py-3 whitespace-nowrap">Solicitante</th>
                <th className="px-3 py-3 whitespace-nowrap">Atribuído</th>
                <th className="px-3 py-3 whitespace-nowrap">Solicitação Ação</th>
                <th className="px-3 py-3 whitespace-nowrap">Início Bloqueio</th>
                <th className="px-3 py-3 whitespace-nowrap">Fim Bloqueio</th>
                <th className="px-3 py-3 whitespace-nowrap">Início Pendente</th>
                <th className="px-3 py-3 whitespace-nowrap">Fim Pendente</th>
                <th className="px-3 py-3 whitespace-nowrap">Início Andamento</th>
                <th className="px-3 py-3 whitespace-nowrap">Conclusão</th>
                <th className="px-3 py-3 whitespace-nowrap">Custo</th>
                <th className="px-3 py-3 whitespace-nowrap">SLA</th>
                <th className="px-3 py-3 whitespace-nowrap">Status SLA</th>
                <th className="px-3 py-3 whitespace-nowrap">ID Ação Assoc.</th>
                <th className="px-3 py-3 whitespace-nowrap">Nome Ação Assoc.</th>
                <th className="px-3 py-3 whitespace-nowrap">Fluxo Assoc.</th>
                <th className="px-3 py-3 whitespace-nowrap">Conclusão Assoc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActions.map((action, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-slate-500">{action.flowId.slice(-6)}</td>
                  <td className="px-3 py-2 font-bold text-slate-700">{action.flowName}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${action.flowStatus === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' : action.flowStatus === 'EM_ANDAMENTO' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{action.flowStatus}</span></td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.flowRequestDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.flowCompletionDate)}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{action.actionId.slice(-6)}</td>
                  <td className="px-3 py-2 font-bold text-slate-700">{action.actionName}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${action.actionStatus === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' : action.actionStatus === 'EM_ANDAMENTO' ? 'bg-sky-100 text-sky-700' : action.actionStatus === 'PENDENTE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{action.actionStatus}</span></td>
                  <td className="px-3 py-2 text-slate-600">{action.sector}</td>
                  <td className="px-3 py-2 font-bold text-slate-700">{action.bed}</td>
                  <td className="px-3 py-2 text-slate-600">{action.requesterUser}</td>
                  <td className="px-3 py-2 text-slate-600">{action.assignedUser}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.requestDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.blockStartDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.blockEndDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.pendingStartDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.pendingEndDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.inProgressStartDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.completionDate)}</td>
                  <td className="px-3 py-2 text-slate-700 font-bold">R$ {action.actionCost}</td>
                  <td className="px-3 py-2 text-slate-600">{action.actionSLA ? `${action.actionSLA} min` : '-'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${action.slaStatus === 'No Prazo' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{action.slaStatus}</span></td>
                  <td className="px-3 py-2 font-mono text-slate-500">{action.associatedActionId ? action.associatedActionId.slice(-6) : '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{action.associatedActionName || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{action.associatedFlowName || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{formatDateTime(action.associatedCompletionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredActions.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm font-bold">Nenhuma ação encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionsList;
