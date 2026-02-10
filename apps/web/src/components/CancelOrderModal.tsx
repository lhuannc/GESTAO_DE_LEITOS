import React, { useState } from 'react';
import { XCircle, X, AlertTriangle } from 'lucide-react';
import { Reason } from '@gestao-leitos/types';
import { maskCPF, unmaskCPF } from '@gestao-leitos/utils';

interface CancelOrderModalProps {
  onConfirm: (data: {
    reasonId: string;
    notes?: string;
    userCpf: string;
    userPassword: string;
  }) => Promise<void>;
  onClose: () => void;
  reasons: Reason[];
  isLoading?: boolean;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  onConfirm,
  onClose,
  reasons,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    reasonId: '',
    notes: '',
    userCpf: '',
    userPassword: '',
  });

  // Filter only CANCELAMENTO reasons
  const cancellationReasons = reasons.filter(r => r.rule === 'CANCELAMENTO');

  const handleSubmit = async () => {
    if (!formData.reasonId || !formData.userCpf || !formData.userPassword) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Unmask CPF before sending
    await onConfirm({
      ...formData,
      userCpf: unmaskCPF(formData.userCpf),
    });
  };

  const isFormValid = formData.reasonId && formData.userCpf && formData.userPassword;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg">
              <XCircle size={24} />
            </div>
            <div>
              <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                Cancelar Ação
              </h4>
              <p className="text-xs text-slate-500 font-medium">Esta ação não pode ser desfeita</p>
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
              Esta ação será cancelada e as ordens dependentes serão liberadas automaticamente.
            </p>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Motivo do Cancelamento *
            </label>
            <select
              value={formData.reasonId}
              onChange={(e) => setFormData({ ...formData, reasonId: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-700"
              disabled={isLoading}
              required
            >
              <option value="">Selecione um motivo</option>
              {cancellationReasons.map(reason => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
            {cancellationReasons.length === 0 && (
              <p className="text-xs text-rose-500 mt-1 font-medium">
                Nenhum motivo de cancelamento cadastrado. Contate o administrador.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-medium text-slate-700 resize-none"
              rows={3}
              placeholder="Detalhes adicionais sobre o cancelamento..."
              disabled={isLoading}
            />
          </div>

          {/* Authentication */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3">
              Autenticação Obrigatória
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  CPF *
                </label>
                <input
                  type="text"
                  value={formData.userCpf}
                  onChange={(e) => {
                    const masked = maskCPF(e.target.value);
                    setFormData({ ...formData, userCpf: masked });
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-700"
                  placeholder="000.000.000-00"
                  disabled={isLoading}
                  maxLength={14}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={formData.userPassword}
                  onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-sm font-bold text-slate-700"
                  placeholder="Digite sua senha"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
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
            disabled={!isFormValid || isLoading || cancellationReasons.length === 0}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isFormValid && !isLoading && cancellationReasons.length > 0
                ? 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Cancelando...</span>
              </>
            ) : (
              <>
                <XCircle size={18} />
                <span>Confirmar Cancelamento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
