import React from 'react';
import { CheckCircle2, X, Layers, MapPin, Package } from 'lucide-react';

interface OrderConfirmationModalProps {
  orderData: {
    groupId: string;
    bedName: string;
    sectorName?: string;
    sectionName?: string;
    serviceName: string;
    actions: {
      id: string;
      name: string;
      step: number;
      dependencies?: string[];
    }[];
  };
  onClose: () => void;
}

const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  orderData,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mb-2">
            ✅ Solicitação Criada com Sucesso!
          </h3>
          <p className="text-sm text-slate-600">
            Número da Solicitação: <span className="font-black text-slate-800">#{orderData.groupId.slice(-8).toUpperCase()}</span>
          </p>
        </div>

        {/* Dados da Solicitação */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MapPin size={14} /> Dados da Solicitação
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Origem</p>
              <p className="font-bold text-slate-800">
                {orderData.sectionName 
                  ? `${orderData.sectorName} - ${orderData.sectionName} - ${orderData.bedName}`
                  : `${orderData.sectorName} - ${orderData.bedName}`
                }
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Serviço</p>
              <p className="font-bold text-slate-800">{orderData.serviceName}</p>
            </div>
          </div>
        </div>

        {/* Ações Criadas */}
        <div className="mb-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Layers size={14} /> Ações Criadas ({orderData.actions?.length || 0})
          </h4>
          <div className="space-y-2">
            {(orderData.actions || []).map((action, idx) => (
              <div key={action.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{action.name}</p>
                  {action.dependencies && action.dependencies.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Package size={12} />
                      Bloqueada por {action.dependencies.length} ação(ões)
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono">#{action.id.slice(-6)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ordem de Dependências */}
        {orderData.actions?.some(a => a.dependencies && a.dependencies.length > 0) && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">
              ⚠️ Ordem de Execução
            </h4>
            <p className="text-xs text-amber-600">
              Algumas ações possuem dependências e serão executadas apenas após a conclusão das ações bloqueadoras.
            </p>
          </div>
        )}

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
        >
          Fechar e Criar Nova Solicitação
        </button>
      </div>
    </div>
  );
};

export default OrderConfirmationModal;
