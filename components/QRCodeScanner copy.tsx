import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, User, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface QRCodeScannerProps {
  onScan: (data: string) => void; // No caso do Login, retornará o usuário ou token
  onClose: () => void;
  onError?: (error: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose, onError }) => {
  // Estados para controle da Câmera
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  // Estados da UI
  const [showLogin, setShowLogin] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Estados do Formulário de Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Atualiza refs
  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onScan, onError]);

  // Efeito da Câmera (só roda se NÃO estiver mostrando o login)
  useEffect(() => {
    if (showLogin) return; // Não inicia câmera se estiver no login

    let selectedDeviceId: string | null = null;
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    const startDecoding = async () => {
      try {
        setCameraError(null);
        
        // Configuração para Câmera FRONTAL
        const constraints = {
          video: {
            facingMode: 'user', 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        if (!videoRef.current) return;

        console.log("Iniciando câmera frontal...");

        await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, err) => {
            if (result) {
              console.log("QR Code lido:", result.getText());
              if (onScanRef.current) {
                onScanRef.current(result.getText());
              }
            }
            if (err && !(err instanceof NotFoundException)) {
              console.warn("Erro de leitura:", err);
            }
          }
        );

      } catch (err: any) {
        console.error("Erro fatal na câmera:", err);
        const errorMsg = "Não foi possível acessar a câmera.";
        setCameraError(errorMsg);
        
        // FALLBACK AUTOMÁTICO:
        // Se der erro crítico na câmera, joga o usuário para o login
        setShowLogin(true);
        
        if (onErrorRef.current) onErrorRef.current(errorMsg);
      }
    };

    // Pequeno delay para inicializar
    const timer = setTimeout(() => {
        startDecoding();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (codeReaderRef.current) {
        codeReaderRef.current.reset(); // Para a câmera
      }
    };
  }, [showLogin]); // Reinicia se sair do modo login e voltar para câmera

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      // Aqui você implementaria a lógica real de autenticação
      // Por enquanto, enviamos o usuário como se fosse o dado do scan
      // Ou você pode concatenar: onScan(JSON.stringify({ user: username, pass: password }));
      console.log("Login manual:", username);
      onScan(username); 
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            {showLogin ? <User size={20} className="text-blue-600"/> : <Camera size={20} className="text-blue-600"/>}
            {showLogin ? 'Acesso Manual' : 'Escanear (Frontal)'}
          </h4>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 bg-slate-50 relative flex flex-col overflow-hidden min-h-[300px]">
          
          {showLogin ? (
            // --- TELA DE LOGIN (FALLBACK) ---
            <div className="p-6 flex flex-col justify-center h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
              {cameraError && (
                 <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-xs">
                    <AlertCircle size={16} />
                    <span>{cameraError}. Use o login abaixo.</span>
                 </div>
              )}
              
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Usuário / ID</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      placeholder="Digite seu usuário"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!username || !password}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all mt-4"
                >
                  Entrar
                </button>
              </form>

              <button 
                onClick={() => setShowLogin(false)}
                className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft size={16} />
                Tentar Câmera novamente
              </button>
            </div>
          ) : (
            // --- TELA DA CÂMERA ---
            <>
              <div className="absolute inset-0 bg-black">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }} 
                    muted 
                    playsInline
                />
              </div>
              
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-white/50 rounded-lg relative overflow-hidden shadow-[0_0_0_100vmax_rgba(0,0,0,0.6)]">
                    <div className="absolute inset-0 animate-pulse bg-white/10"></div>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
                </div>
                <p className="mt-8 text-white/90 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                   Posicione o rosto ou código
                </p>
              </div>
            </>
          )}
        </div>

        {/* Rodapé (Só aparece se estiver na Câmera) */}
        {!showLogin && (
            <div className="p-4 bg-white border-t border-slate-100">
            <button 
                onClick={() => setShowLogin(true)}
                className="w-full py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 flex items-center justify-center gap-2"
            >
                <User size={18} />
                Entrar com Login e Senha
            </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeScanner;