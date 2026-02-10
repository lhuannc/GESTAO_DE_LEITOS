import React, { useState } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, XCircle, Clock } from 'lucide-react';
import { Reason, ReasonRule } from '@gestao-leitos/types';
import { trpc } from '../lib/trpc';

const ReasonsManager: React.FC = () => {
  const [editingReason, setEditingReason] = useState<Reason | null>(null);
  const [filterRule, setFilterRule] = useState<ReasonRule | ''>('');
  const [formData, setFormData] = useState({
    name: '',
    rule: 'CANCELAMENTO' as ReasonRule,
  });

  // tRPC queries and mutations
  const reasonsQuery = trpc.reasons.list.useQuery(
    { rule: filterRule || undefined },
    { refetchOnWindowFocus: false }
  );

  const createMutation = trpc.reasons.create.useMutation({
    onSuccess: () => {
      reasonsQuery.refetch();
      resetForm();
    },
    onError: (error) => {
      alert(`Erro ao criar motivo: ${error.message}`);
    },
  });

  const updateMutation = trpc.reasons.update.useMutation({
    onSuccess: () => {
      reasonsQuery.refetch();
      resetForm();
    },
    onError: (error) => {
      alert(`Erro ao atualizar motivo: ${error.message}`);
    },
  });

  const deleteMutation = trpc.reasons.delete.useMutation({
    onSuccess: () => {
      reasonsQuery.refetch();
    },
    onError: (error) => {
      alert(`Erro ao excluir motivo: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', rule: 'CANCELAMENTO' });
    setEditingReason(null);
  };

  const handleEdit = (reason: Reason) => {
    setEditingReason(reason);
    setFormData({ name: reason.name, rule: reason.rule });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Nome do motivo é obrigatório');
      return;
    }

    if (formData.name.length < 3) {
      alert('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (editingReason) {
      updateMutation.mutate({
        id: editingReason.id,
        name: formData.name,
        rule: formData.rule,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        rule: formData.rule,
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o motivo "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const getRuleBadge = (rule: ReasonRule) => {
    if (rule === 'CANCELAMENTO') {
      return (
        <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5">
          <XCircle size={12} />
          Cancelamento
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5">
        <Clock size={12} />
        Fora do Prazo
      </span>
    );
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Cadastro de Motivos</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Gerencie os motivos de cancelamento e justificativas de atraso
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-black text-slate-700 mb-4 uppercase tracking-tight">
          {editingReason ? 'Editar Motivo' : 'Novo Motivo'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Nome do Motivo *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
              placeholder="Ex: Falta de insumos"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Regra Associada *
            </label>
            <select
              value={formData.rule}
              onChange={(e) => setFormData({ ...formData, rule: e.target.value as ReasonRule })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-slate-700"
              disabled={isLoading}
            >
              <option value="CANCELAMENTO">Cancelamento</option>
              <option value="FORA_DO_PRAZO">Fora do Prazo</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {editingReason && (
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.name.trim()}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              !isLoading && formData.name.trim()
                ? 'bg-sky-600 text-white hover:bg-sky-700 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Plus size={18} />
                <span>{editingReason ? 'Atualizar' : 'Criar'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilterRule('')}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            filterRule === ''
              ? 'bg-sky-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterRule('CANCELAMENTO')}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            filterRule === 'CANCELAMENTO'
              ? 'bg-rose-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Cancelamento
        </button>
        <button
          onClick={() => setFilterRule('FORA_DO_PRAZO')}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            filterRule === 'FORA_DO_PRAZO'
              ? 'bg-amber-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Fora do Prazo
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {reasonsQuery.isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500 font-medium">Carregando motivos...</p>
          </div>
        ) : reasonsQuery.data && reasonsQuery.data.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs font-black text-slate-600 uppercase tracking-widest">
                <th className="px-6 py-4 text-left">Nome</th>
                <th className="px-6 py-4 text-left">Regra</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {reasonsQuery.data.map((reason) => (
                <tr
                  key={reason.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-slate-700">{reason.name}</td>
                  <td className="px-6 py-4">{getRuleBadge(reason.rule)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(reason)}
                        className="px-4 py-2 bg-sky-100 text-sky-700 rounded-lg font-bold text-xs hover:bg-sky-200 transition-colors flex items-center gap-1.5"
                        disabled={isLoading}
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(reason.id, reason.name)}
                        className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg font-bold text-xs hover:bg-rose-200 transition-colors flex items-center gap-1.5"
                        disabled={isLoading}
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <AlertCircle size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-slate-500 font-medium">
              {filterRule
                ? `Nenhum motivo de ${filterRule === 'CANCELAMENTO' ? 'cancelamento' : 'atraso'} cadastrado`
                : 'Nenhum motivo cadastrado'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Crie um novo motivo usando o formulário acima
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReasonsManager;
