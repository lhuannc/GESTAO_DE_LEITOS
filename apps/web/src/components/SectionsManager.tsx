import React, { useState } from 'react';
import { Section, Sector } from '@gestao-leitos/types';
import { Building2, Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { trpc } from '../lib/trpc';

const SectionsManager: React.FC = () => {
  const [filterSectorId, setFilterSectorId] = useState<string>('');
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sectorId: '',
  });

  const utils = trpc.useContext();
  const sectionsQuery = trpc.sections.list.useQuery({ sectorId: filterSectorId || undefined });
  const sectorsQuery = trpc.sectors.list.useQuery();
  
  const createMutation = trpc.sections.create.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate();
      setFormData({ name: '', sectorId: '' });
      alert('Seção criada com sucesso!');
    },
    onError: (error) => {
      alert(`Erro ao criar seção: ${error.message}`);
    },
  });

  const updateMutation = trpc.sections.update.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate();
      setEditingSection(null);
      setFormData({ name: '', sectorId: '' });
      alert('Seção atualizada com sucesso!');
    },
    onError: (error) => {
      alert(`Erro ao atualizar seção: ${error.message}`);
    },
  });

  const deleteMutation = trpc.sections.delete.useMutation({
    onSuccess: () => {
      utils.sections.list.invalidate();
      alert('Seção excluída com sucesso!');
    },
    onError: (error) => {
      alert(`Erro ao excluir seção: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sectorId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (editingSection) {
      updateMutation.mutate({ ...formData, id: editingSection.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (section: any) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      sectorId: section.sectorId,
    });
  };

  const handleCancel = () => {
    setEditingSection(null);
    setFormData({ name: '', sectorId: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta seção?')) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <Layers size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Gerenciamento de Seções</h2>
            <p className="text-slate-500 text-sm">Organize setores em seções (opcional)</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          {editingSection ? <Pencil size={18} /> : <Plus size={18} />}
          {editingSection ? 'Editar Seção' : 'Nova Seção'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Setor *</label>
              <select
                required
                value={formData.sectorId}
                onChange={(e) => setFormData({ ...formData, sectorId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">Selecione um setor</option>
                {sectorsQuery.data?.map(sector => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Nome da Seção *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Ex: UTI Adulto, Enfermaria A"
              />
            </div>
          </div>

          <div className="flex gap-3">
            {editingSection && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {editingSection ? 'Atualizar' : 'Criar'} Seção
            </button>
          </div>
        </form>
      </div>

      {/* Filtro */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="block text-xs font-bold text-slate-600 mb-2">Filtrar por Setor</label>
        <select
          value={filterSectorId}
          onChange={(e) => setFilterSectorId(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border border-slate-300 rounded-lg bg-white"
        >
          <option value="">Todos os setores</option>
          {sectorsQuery.data?.map(sector => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-black text-slate-600 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Setor</th>
              <th className="px-4 py-3 text-center">Leitos</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sectionsQuery.data?.map((section: any) => (
              <tr key={section.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-bold text-slate-700">{section.name}</td>
                <td className="px-4 py-3 text-slate-600">{section.sector?.name || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                    {section._count?.beds || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(section)}
                    className="px-3 py-1 bg-sky-100 text-sky-700 rounded font-bold text-xs hover:bg-sky-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(section.id)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-xs hover:bg-rose-200 transition-colors disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {sectionsQuery.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-30">
                    <Layers size={48} />
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                      Nenhuma seção cadastrada
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SectionsManager;
