
import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { Bed, ServiceOrder, User, BedStatus, OSStatus, ServiceType, BedStatusConfig } from '@gestao-leitos/types';
import { Hash, Bed as BedIcon, Settings, Layers, Clock, CheckCircle2, Circle, PlayCircle, Lock, TrendingUp, Calendar, X, Eye } from 'lucide-react';

interface DashboardProps {
  beds: Bed[];
  orders: ServiceOrder[];
  users: User[];
  services: ServiceType[];
  bedStatusConfigs?: BedStatusConfig[];
}

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

// Função auxiliar para calcular tempo entre duas datas em minutos
const calculateDuration = (start: string | undefined, end: string | undefined): number => {
  if (!start) return 0;
  const endDate = end ? new Date(end) : new Date();
  const startDate = new Date(start);
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60); // em minutos
};

const OS_COLORS = {
  BLOQUEADO: '#94a3b8',
  PENDENTE: '#fbbf24',
  EM_ANDAMENTO: '#38bdf8',
  CONCLUIDO: '#34d399',
  CANCELADO: '#f43f5e'
};

const getHexFromTailwind = (className: string) => {
  if (className.includes('emerald')) return '#10b981';
  if (className.includes('rose')) return '#f43f5e';
  if (className.includes('amber')) return '#f59e0b';
  if (className.includes('slate')) return '#64748b';
  if (className.includes('sky')) return '#0ea5e9';
  if (className.includes('blue')) return '#3b82f6';
  if (className.includes('indigo')) return '#6366f1';
  if (className.includes('violet')) return '#8b5cf6';
  if (className.includes('purple')) return '#a855f7';
  if (className.includes('fuchsia')) return '#d946ef';
  if (className.includes('pink')) return '#ec4899';
  if (className.includes('red')) return '#ef4444';
  if (className.includes('orange')) return '#f97316';
  if (className.includes('yellow')) return '#eab308';
  if (className.includes('lime')) return '#84cc16';
  if (className.includes('green')) return '#22c55e';
  if (className.includes('teal')) return '#14b8a6';
  if (className.includes('cyan')) return '#06b6d4';
  return '#64748b';
};

const Dashboard: React.FC<DashboardProps> = ({ beds, orders, users, services, bedStatusConfigs = [] }) => {
  const [modalEtapasAberto, setModalEtapasAberto] = useState(false);
  const [modalFluxosAberto, setModalFluxosAberto] = useState(false);

  // Estatísticas de etapas por status com tempo médio
  const etapasPorStatus = useMemo(() => {
    const stats: Record<OSStatus, { count: number; durations: number[] }> = {
      BLOQUEADO: { count: 0, durations: [] },
      PENDENTE: { count: 0, durations: [] },
      EM_ANDAMENTO: { count: 0, durations: [] },
      CONCLUIDO: { count: 0, durations: [] },
      CANCELADO: { count: 0, durations: [] }
    };

    orders.forEach(order => {
      stats[order.status].count++;
      const duration = calculateDuration(order.createdAt, order.completedAt);
      if (duration > 0) {
        stats[order.status].durations.push(duration);
      }
    });

    return Object.entries(stats).map(([status, data]) => {
      const avgDuration = data.durations.length > 0
        ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
        : 0;
      const maxDuration = data.durations.length > 0
        ? Math.max(...data.durations)
        : 0;
      return {
        status: status as OSStatus,
        quantidade: data.count,
        tempoMedio: avgDuration,
        tempoMedioFormatado: formatDuration(avgDuration),
        tempoMaximo: maxDuration,
        tempoMaximoFormatado: formatDuration(maxDuration)
      };
    });
  }, [orders]);

  // Função auxiliar para calcular tempo em cada status baseado no histórico
  const calcularTemposPorStatus = (order: ServiceOrder) => {
    const tempos: Record<OSStatus, number[]> = {
      BLOQUEADO: [],
      PENDENTE: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
      CANCELADO: []
    };

    if (!order.history || !Array.isArray(order.history) || order.history.length === 0) return tempos;

    // Ordenar histórico por timestamp
    const sortedHistory = [...order.history].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Encontrar o primeiro momento em que entrou em PENDENTE
    const primeiroPendente = sortedHistory.find(h => h.status === 'PENDENTE');
    const inicioPendente = primeiroPendente?.timestamp || order.createdAt;

    // Calcular tempo total concluído (desde início do pendente até completedAt)
    if (order.status === 'CONCLUIDO' && order.completedAt) {
      const tempoTotal = calculateDuration(inicioPendente, order.completedAt);
      if (tempoTotal > 0) {
        tempos.CONCLUIDO.push(tempoTotal);
      }
    }

    // Calcular tempo em cada status usando o histórico
    for (let i = 0; i < sortedHistory.length - 1; i++) {
      const current = sortedHistory[i];
      const next = sortedHistory[i + 1];
      const statusDuration = calculateDuration(current.timestamp, next.timestamp);

      if (statusDuration > 0) {
        tempos[current.status].push(statusDuration);
      }
    }

    // Para o último status, calcular até agora ou até completedAt
    if (sortedHistory.length > 0) {
      const lastStatus = sortedHistory[sortedHistory.length - 1];
      const endTime = order.completedAt || new Date().toISOString();
      const lastDuration = calculateDuration(lastStatus.timestamp, endTime);

      if (lastDuration > 0 && lastDuration < 999999) { // Evitar valores absurdos
        tempos[lastStatus.status].push(lastDuration);
      }
    }

    return tempos;
  };

  // Tempo médio por etapa (subServiceName) com detalhamento por status
  const tempoMedioPorEtapa = useMemo(() => {
    const etapaMap: Record<string, {
      tempoMedioConcluido: number[];
      tempoMedioBloqueado: number[];
      tempoMedioPendente: number[];
      tempoMedioEmAndamento: number[];
    }> = {};

    orders.forEach(order => {
      const etapaName = order.subServiceName || `Etapa ${order.step}`;
      const tempos = calcularTemposPorStatus(order);

      if (!etapaMap[etapaName]) {
        etapaMap[etapaName] = {
          tempoMedioConcluido: [],
          tempoMedioBloqueado: [],
          tempoMedioPendente: [],
          tempoMedioEmAndamento: []
        };
      }

      etapaMap[etapaName].tempoMedioBloqueado.push(...tempos.BLOQUEADO);
      etapaMap[etapaName].tempoMedioPendente.push(...tempos.PENDENTE);
      etapaMap[etapaName].tempoMedioEmAndamento.push(...tempos.EM_ANDAMENTO);
      etapaMap[etapaName].tempoMedioConcluido.push(...tempos.CONCLUIDO);
    });

    return Object.entries(etapaMap)
      .map(([nome, tempos]) => {
        const calcularMedia = (arr: number[]) =>
          arr.length > 0 ? arr.reduce((sum, d) => sum + d, 0) / arr.length : 0;

        const mediaBloqueado = calcularMedia(tempos.tempoMedioBloqueado);
        const mediaPendente = calcularMedia(tempos.tempoMedioPendente);
        const mediaEmAndamento = calcularMedia(tempos.tempoMedioEmAndamento);
        const mediaConcluido = calcularMedia(tempos.tempoMedioConcluido);

        const quantidade = tempos.tempoMedioConcluido.length > 0
          ? tempos.tempoMedioConcluido.length
          : tempos.tempoMedioPendente.length + tempos.tempoMedioBloqueado.length + tempos.tempoMedioEmAndamento.length;

        return {
          nome,
          quantidade,
          tempoMedioBloqueado: mediaBloqueado,
          tempoMedioBloqueadoFormatado: formatDuration(mediaBloqueado),
          tempoMedioPendente: mediaPendente,
          tempoMedioPendenteFormatado: formatDuration(mediaPendente),
          tempoMedioEmAndamento: mediaEmAndamento,
          tempoMedioEmAndamentoFormatado: formatDuration(mediaEmAndamento),
          tempoMedioConcluido: mediaConcluido,
          tempoMedioConcluidoFormatado: formatDuration(mediaConcluido)
        };
      })
      .filter(etapa => etapa.quantidade > 0)
      .sort((a, b) => b.tempoMedioConcluido - a.tempoMedioConcluido);
  }, [orders]);

  // Lista de fluxos com tempo médio total
  const listaFluxos = useMemo(() => {
    const groups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!groups[order.groupId]) groups[order.groupId] = [];
      groups[order.groupId].push(order);
    });

    const fluxos: Array<{
      groupId: string;
      nome: string;
      tempoMedioTotal: number;
      tempoMedioTotalFormatado: string;
      quantidadeEtapas: number;
      dataInicio: string;
      dataFim: string | null;
    }> = [];

    Object.entries(groups).forEach(([groupId, group]) => {
      // Ordenar por step para obter primeira e última ordem
      const sortedGroup = [...group].sort((a, b) => a.step - b.step);
      const firstOrder = sortedGroup[0];

      // Encontrar o primeiro momento em que alguma etapa entrou em PENDENTE
      let inicioPendente = firstOrder.requestedAt;
      group.forEach(order => {
        if (order.history && Array.isArray(order.history) && order.history.length > 0) {
          const primeiroPendente = order.history
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .find(h => h.status === 'PENDENTE');
          if (primeiroPendente) {
            const pendenteTime = new Date(primeiroPendente.timestamp).getTime();
            const inicioTime = new Date(inicioPendente).getTime();
            if (pendenteTime < inicioTime) {
              inicioPendente = primeiroPendente.timestamp;
            }
          }
        }
      });

      // Encontrar a última ordem concluída
      const ultimaOrdemConcluida = sortedGroup
        .filter(o => o.status === 'CONCLUIDO' && o.completedAt)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];

      if (ultimaOrdemConcluida?.completedAt) {
        const tempoTotal = calculateDuration(inicioPendente, ultimaOrdemConcluida.completedAt);

        if (tempoTotal > 0) {
          // Obter nome do serviço
          const service = services.find(s => s.id === firstOrder.serviceTypeId);
          const bed = beds.find(b => b.id === firstOrder.bedId);
          const nomeFluxo = `${service?.name || 'Fluxo Manual'} - ${bed?.name || 'N/A'}`;

          fluxos.push({
            groupId,
            nome: nomeFluxo,
            tempoMedioTotal: tempoTotal,
            tempoMedioTotalFormatado: formatDuration(tempoTotal),
            quantidadeEtapas: group.length,
            dataInicio: inicioPendente,
            dataFim: ultimaOrdemConcluida.completedAt
          });
        }
      }
    });

    return fluxos.sort((a, b) => {
      // Ordenar por data de fim (mais recente primeiro) ou por tempo total (maior primeiro)
      if (a.dataFim && b.dataFim) {
        return new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime();
      }
      return b.tempoMedioTotal - a.tempoMedioTotal;
    });
  }, [orders, services, beds]);

  // Tempo médio geral (para exibição no resumo se necessário)
  const tempoMedioGeral = useMemo(() => {
    if (listaFluxos.length === 0) {
      return {
        tempoMedioFormatado: formatDuration(0),
        quantidadeFluxos: 0,
        quantidadeTotal: 0
      };
    }

    const tempoMedioTotal = listaFluxos.reduce((sum, f) => sum + f.tempoMedioTotal, 0) / listaFluxos.length;
    const groups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!groups[order.groupId]) groups[order.groupId] = [];
      groups[order.groupId].push(order);
    });

    return {
      tempoMedioFormatado: formatDuration(tempoMedioTotal),
      quantidadeFluxos: listaFluxos.length,
      quantidadeTotal: Object.keys(groups).length
    };
  }, [listaFluxos, orders]);

  // Gráfico de ordens por dia da semana
  const ordensPorDiaSemana = useMemo(() => {
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const dayOfWeek = date.getDay();
      counts[dayOfWeek]++;
    });

    return diasSemana.map((dia, index) => ({
      dia,
      quantidade: counts[index]
    }));
  }, [orders]);

  // Gráfico de ordens por dia do mês
  const ordensPorDiaMes = useMemo(() => {
    const counts: Record<number, number> = {};

    for (let i = 1; i <= 31; i++) {
      counts[i] = 0;
    }

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const dayOfMonth = date.getDate();
      counts[dayOfMonth]++;
    });

    return Object.entries(counts).map(([dia, quantidade]) => ({
      dia: parseInt(dia),
      quantidade
    }));
  }, [orders]);

  // Gráfico de ordens por mês do ano
  const ordensPorMes = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const counts: Record<number, number> = {};

    for (let i = 0; i < 12; i++) {
      counts[i] = 0;
    }

    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const month = date.getMonth();
      counts[month]++;
    });

    return meses.map((mes, index) => ({
      mes,
      quantidade: counts[index]
    }));
  }, [orders]);

  const bedStats = useMemo(() => {
    const counts: Record<string, number> = {};

    // Inicializar contadores com topos os status configurados ou encontrados
    bedStatusConfigs.forEach(config => {
      counts[config.id] = 0;
    });

    beds.forEach(bed => {
      if (!counts[bed.status]) counts[bed.status] = 0;
      counts[bed.status]++;
    });

    return Object.entries(counts).map(([id, value]) => {
      const config = bedStatusConfigs.find(c => c.id === id);
      return {
        name: config?.name || id,
        value,
        color: config?.color || 'bg-slate-500', // Classe Tailwind
        // Para Recharts precisamos de Hex. Vamos tentar mapear ou assumir que color pode ser Hex se configurado no futuro, mas o sistema usa classes.
        // Recharts precisa de 'fill'. Se 'color' é classe, não ajuda.
        // Solução: Mapear classes conhecidas para Hex ou usar uma prop separada.
        // Mapa rápido de cores Tailwind padrão que estamos usando
        fill: getHexFromTailwind(config?.color || 'bg-slate-500')
      };
    });
  }, [beds, bedStatusConfigs]);

  // Agrupa ordens por groupId para mostrar o progresso do fluxo
  const orderGroups = useMemo(() => {
    const groups: Record<string, ServiceOrder[]> = {};
    orders.forEach(order => {
      if (!groups[order.groupId]) groups[order.groupId] = [];
      groups[order.groupId].push(order);
    });

    return Object.values(groups)
      .map(group => group.sort((a, b) => a.step - b.step))
      .sort((a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime());
  }, [orders]);



  const getStatusIcon = (status: OSStatus) => {
    switch (status) {
      case 'CONCLUIDO': return <CheckCircle2 size={12} className="text-emerald-500" />;
      case 'EM_ANDAMENTO': return <PlayCircle size={12} className="text-sky-500 animate-pulse" />;
      case 'PENDENTE': return <Circle size={12} className="text-amber-500" />;
      case 'BLOQUEADO': return <Lock size={12} className="text-slate-300" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {/* Quadro com quantidade de etapas por status e tempo médio */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
        <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp size={14} className="text-sky-500" /> Ações por Status
        </h4>
        <div className="grid grid-cols-5 gap-3">
          {etapasPorStatus.map((stat) => (
            <div key={stat.status} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {stat.status.replace('_', ' ')}
                </p>
                <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: OS_COLORS[stat.status] }} />
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[8px] text-slate-500 font-bold uppercase">Quantidade</p>
                  <h3 className="text-2xl font-black text-slate-800">{stat.quantidade}</h3>
                </div>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div>
                    <p className="text-[8px] text-slate-500 font-bold uppercase">Tempo Médio</p>
                    <p className="text-xs font-black text-sky-600 flex items-center gap-1">
                      <Clock size={10} />
                      {stat.tempoMedioFormatado}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] text-slate-500 font-bold uppercase">Tempo Máximo</p>
                    <p className="text-xs font-black text-rose-600 flex items-center gap-1">
                      <Clock size={10} />
                      {stat.tempoMaximoFormatado}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas de tempo médio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Tempo médio por etapa */}
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock size={14} className="text-sky-500" /> Tempo Médio por Ação
            </h4>
            {tempoMedioPorEtapa.length > 5 && (
              <button
                onClick={() => setModalEtapasAberto(true)}
                className="text-[9px] font-black text-sky-600 hover:text-sky-700 uppercase tracking-wider flex items-center gap-1 px-3 py-1 rounded-md hover:bg-sky-50 transition-colors"
              >
                <Eye size={12} />
                Ver mais
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            {tempoMedioPorEtapa.length > 0 ? (
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-3 py-2 text-left">Ação</th>
                    <th className="px-3 py-2 text-center">Bloqueado</th>
                    <th className="px-3 py-2 text-center">Pendente</th>
                    <th className="px-3 py-2 text-center">Em Andamento</th>
                    <th className="px-3 py-2 text-center">Concluído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tempoMedioPorEtapa.slice(0, 5).map((etapa, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-[10px] md:text-xs font-black text-slate-800">{etapa.nome}</p>
                          <p className="text-[8px] md:text-[9px] text-slate-500">{etapa.quantidade} execuções</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-600">
                          {etapa.tempoMedioBloqueadoFormatado}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-amber-600">
                          {etapa.tempoMedioPendenteFormatado}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-sky-600">
                          {etapa.tempoMedioEmAndamentoFormatado}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[9px] md:text-[10px] font-bold text-emerald-600">
                          {etapa.tempoMedioConcluidoFormatado}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[9px] md:text-[10px] text-slate-400 text-center py-8">
                Nenhuma ação com dados ainda
              </p>
            )}
          </div>
        </div>

        {/* Tempo médio por fluxo */}
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers size={14} className="text-sky-500" /> Tempo Médio por Fluxo
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
                Média: {tempoMedioGeral.tempoMedioFormatado}
              </span>
              {listaFluxos.length > 5 && (
                <button
                  onClick={() => setModalFluxosAberto(true)}
                  className="text-[9px] font-black text-sky-600 hover:text-sky-700 uppercase tracking-wider flex items-center gap-1 px-3 py-1 rounded-md hover:bg-sky-50 transition-colors"
                >
                  <Eye size={12} />
                  Ver mais
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {listaFluxos.length > 0 ? (
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-3 py-2 text-left">Fluxo</th>
                    <th className="px-3 py-2 text-center">Tempo Médio Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listaFluxos.slice(0, 5).map((fluxo, idx) => (
                    <tr key={fluxo.groupId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-[10px] md:text-xs font-black text-slate-800">{fluxo.nome}</p>
                          <p className="text-[8px] md:text-[9px] text-slate-500">
                            {fluxo.quantidadeEtapas} ações • {new Date(fluxo.dataFim || fluxo.dataInicio).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <p className="text-[10px] md:text-sm font-black text-sky-600">
                          {fluxo.tempoMedioTotalFormatado}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[9px] md:text-[10px] text-slate-400 text-center py-8">
                Nenhum fluxo concluído ainda
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status dos Leitos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-1 bg-white p-4 md:p-6 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm flex flex-col">
          <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <BedIcon size={14} className="text-sky-500" /> Status dos Leitos
          </h4>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bedStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {bedStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="text-3xl font-black text-slate-800 block">{beds.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Leitos</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-4 md:p-6 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm">
          <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <Hash size={14} className="text-sky-500" /> Detalhes por Status
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {bedStatusConfigs.filter(cfg => bedStats.some(s => s.name === cfg.name)).map(config => {
              const stat = bedStats.find(s => s.name === config.name);
              return (
                <div key={config.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-sky-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${config.color} ring-2 ring-white shadow-sm`}></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-sky-600 transition-colors">{config.name}</span>
                  </div>
                  <span className="font-black text-lg text-slate-800">{stat?.value || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gráficos de Ordens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Ordens por Dia da Semana */}
        <div className="bg-white p-4 md:p-6 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm">
          <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <Calendar size={14} className="text-sky-500" /> Ordens por Dia da Semana
          </h4>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordensPorDiaSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="quantidade" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ordens por Dia do Mês */}
        <div className="bg-white p-4 md:p-6 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm">
          <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <Calendar size={14} className="text-sky-500" /> Ordens por Dia do Mês
          </h4>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ordensPorDiaMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="quantidade"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ fill: '#38bdf8', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ordens por Mês */}
        <div className="bg-white p-4 md:p-6 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm">
          <h4 className="text-[10px] font-black text-slate-800 mb-6 uppercase tracking-[0.2em] flex items-center gap-2">
            <Calendar size={14} className="text-sky-500" /> Ordens por Mês
          </h4>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordensPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="quantidade" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lista Detalhada */}
      <div className="grid grid-cols-1 gap-6 md:gap-8">

        {/* Lista de Ordens Detalhada Requisitada */}
        <div className="bg-white p-4 md:p-6 lg:p-8 border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 md:mb-8">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers size={14} className="text-sky-500" /> Últimas Solicitações de Fluxo
            </h4>
            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
              Total: {orderGroups.length} Processos
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 md:-mx-8">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-4 md:px-8 py-3 md:py-4"># Número</th>
                  <th className="px-4 md:px-8 py-3 md:py-4">Leito</th>
                  <th className="px-4 md:px-8 py-3 md:py-4">Serviço</th>
                  <th className="px-4 md:px-8 py-3 md:py-4">Fluxo de Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderGroups.slice(0, 10).map((group) => {
                  const firstOrder = group[0];
                  const bed = beds.find(b => b.id === firstOrder.bedId);
                  const service = services.find(s => s.id === firstOrder.serviceId);

                  return (
                    <tr key={firstOrder.groupId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <span className="bg-slate-900 text-white text-[8px] md:text-[9px] font-black px-2 py-1 rounded shadow-sm group-hover:bg-sky-600 transition-colors">
                          {firstOrder.groupId.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const config = bedStatusConfigs?.find(c => c.id === bed?.status);
                            return <div className={`w-2 h-2 rounded-full ${config?.color || 'bg-slate-400'}`} />;
                          })()}
                          <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase">{bed?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] md:text-xs font-bold text-slate-800">{service?.name || 'Fluxo Manual'}</span>
                          <span className="text-[8px] md:text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                            <Clock size={9} className="md:w-[10px] md:h-[10px]" /> {new Date(firstOrder.requestedAt).toLocaleDateString()} às {new Date(firstOrder.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex items-center gap-1 flex-wrap">
                          {group.map((order, idx) => (
                            <div key={order.id} className="flex items-center">
                              <div
                                className={`flex items-center gap-1 px-1.5 md:gap-1.5 md:px-2 py-1 rounded-md border text-[8px] md:text-[9px] font-black uppercase transition-all ${order.status === 'CONCLUIDO' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                  order.status === 'EM_ANDAMENTO' ? 'bg-sky-50 border-sky-100 text-sky-600 ring-2 ring-sky-50' :
                                    order.status === 'PENDENTE' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                      'bg-slate-50 border-slate-100 text-slate-300 opacity-60'
                                  }`}
                                title={`${order.subServiceName}: ${order.status}`}
                              >
                                {getStatusIcon(order.status)}
                                <span className="max-w-[60px] md:max-w-[80px] truncate">{order.subServiceName || `Ação ${idx + 1}`}</span>
                              </div>
                              {idx < group.length - 1 && (
                                <div className="w-2 h-0.5 bg-slate-100 mx-0.5 shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {orderGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 md:px-8 py-12 md:py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                        <Layers size={32} className="md:w-10 md:h-10" />
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Nenhuma ordem solicitada recentemente</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {orderGroups.length > 0 && (
            <div className="mt-auto pt-4 md:pt-6 border-t border-slate-50 text-center">
              <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Exibindo as {Math.min(10, orderGroups.length)} solicitações mais recentes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Etapas */}
      {modalEtapasAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-200">
              <h3 className="text-[12px] md:text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={16} className="text-sky-500" /> Tempo Médio por Ação - Todas as Ações
              </h3>
              <button
                onClick={() => setModalEtapasAberto(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 md:p-6 custom-scrollbar">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left">Ação</th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-center">Bloqueado</th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-center">Pendente</th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-center">Em Andamento</th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-center">Concluído</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tempoMedioPorEtapa.map((etapa, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <div>
                            <p className="text-[11px] md:text-sm font-black text-slate-800">{etapa.nome}</p>
                            <p className="text-[9px] md:text-[10px] text-slate-500">{etapa.quantidade} execuções</p>
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                          <p className="text-[10px] md:text-xs font-bold text-slate-600">
                            {etapa.tempoMedioBloqueadoFormatado}
                          </p>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                          <p className="text-[10px] md:text-xs font-bold text-amber-600">
                            {etapa.tempoMedioPendenteFormatado}
                          </p>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                          <p className="text-[10px] md:text-xs font-bold text-sky-600">
                            {etapa.tempoMedioEmAndamentoFormatado}
                          </p>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                          <p className="text-[10px] md:text-xs font-bold text-emerald-600">
                            {etapa.tempoMedioConcluidoFormatado}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fluxos */}
      {modalFluxosAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-200">
              <h3 className="text-[12px] md:text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers size={16} className="text-sky-500" /> Tempo Médio por Fluxo - Todos os Fluxos
              </h3>
              <button
                onClick={() => setModalFluxosAberto(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 md:p-6 custom-scrollbar">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-3 md:px-4 py-2 md:py-3 text-left">Fluxo</th>
                      <th className="px-3 md:px-4 py-2 md:py-3 text-center">Tempo Médio Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listaFluxos.map((fluxo, idx) => (
                      <tr key={fluxo.groupId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 md:px-4 py-3 md:py-4">
                          <div>
                            <p className="text-[11px] md:text-sm font-black text-slate-800">{fluxo.nome}</p>
                            <p className="text-[9px] md:text-[10px] text-slate-500">
                              {fluxo.quantidadeEtapas} ações • {new Date(fluxo.dataFim || fluxo.dataInicio).toLocaleDateString()}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                          <p className="text-[11px] md:text-sm font-black text-sky-600">
                            {fluxo.tempoMedioTotalFormatado}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BED_STATUS_COLORS: Record<BedStatus, string> = {
  DISPONIVEL: 'bg-emerald-500',
  OCUPADO: 'bg-rose-500',
  HIGIENIZACAO: 'bg-amber-500',
  MANUTENCAO: 'bg-slate-500',
  AGUARDANDO_ALTA: 'bg-sky-500'
};

export default Dashboard;
