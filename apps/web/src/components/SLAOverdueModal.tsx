import React, { useState } from 'react';
import { Clock, X, AlertTriangle } from 'lucide-react';
import { Reason } from '@gestao-leitos/types';

interface SLAOverdueModalProps {
  onConfirm: (reasonId: string, notes?: string) => Promise<void>;
  onClose: () => void;
  reasons: Reason[];
  isLoading?: boolean;
}

const SLAOverdueModal: React.FC<SLAOverdueModalProps> = ({
  onConfirm,
  onClose,
  reasons,
  isLoading = false
}) => {
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');

  // Filter only FORA_DO_PRAZO reasons
  const overdueReasons = reasons.filter(r => r.rule === 'FORA_DO_PRAZO');

  const handleSubmit = async () => {
    if (!reasonId) {
      alert('Por favor, selecione um motivo');
      return;
    }

    await onConfirm(reasonId, notes || undefined);
  };

  const isFormValid = !!reasonId;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg">
              <Clock size={24} />
            </div>
            <div>
              <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                SLA Vencido
              </h4>
              <p className="text-xs text-slate-500 font-medium">Justifique o atraso para continuar</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 font-medium">
              O prazo desta ação foi ultrapassado. É necessário informar o motivo do atraso para concluir.
            </p>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Motivo do Atraso *
            </label>
            <select
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-slate-700"
              disabled={isLoading}
              required
            >
              <option value="">Selecione um motivo</option>
              {overdueReasons.map(reason => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
            {overdueReasons.length === 0 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                Nenhum motivo de atraso cadastrado. Contate o administrador.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium text-slate-700 resize-none"
              rows={3}
              placeholder="Detalhes adicionais sobre o atraso..."
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
            disabled={isLoading}
          >
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isLoading || overdueReasons.length === 0}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isFormValid && !isLoading && overdueReasons.length > 0
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Clock size={18} />
                <span>Confirmar e Concluir</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SLAOverdueModal;
