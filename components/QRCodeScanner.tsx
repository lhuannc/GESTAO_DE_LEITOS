import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  onError?: (error: string) => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [showHttpInstructions, setShowHttpInstructions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let codeReader: any = null;
    let isInitializing = false;

    const startCamera = async () => {
      // Evitar múltiplas inicializações simultâneas
      if (isInitializing) return;
      isInitializing = true;

      try {
        // Verificar se o componente ainda está montado
        if (!isMounted || !videoRef.current) {
          isInitializing = false;
          return;
        }

        // Se já existe um stream ativo, não reiniciar
        if (streamRef.current && streamRef.current.active) {
          isInitializing = false;
          return;
        }

        // Verificar se navigator existe
        if (typeof navigator === 'undefined') {
          throw new Error('Navegador não suportado. Por favor, use um navegador moderno.');
        }

        // Verificar se a API de mídia está disponível
        if (!navigator.mediaDevices) {
          // Tentar fallback para navegadores antigos (webkit, moz, ms)
          const legacyGetUserMedia = 
            (navigator as any).webkitGetUserMedia ||
            (navigator as any).mozGetUserMedia ||
            (navigator as any).msGetUserMedia;

          if (legacyGetUserMedia) {
            // Criar wrapper para API legada
            (navigator as any).mediaDevices = {
              getUserMedia: function(constraints: any) {
                return new Promise((resolve, reject) => {
                  legacyGetUserMedia.call(navigator, constraints, resolve, reject);
                });
              }
            };
          } else {
            // Tentar criar mediaDevices mesmo em HTTP (pode funcionar com flags do navegador)
            if (!(navigator as any).mediaDevices) {
              (navigator as any).mediaDevices = {};
            }
            
            // Tentar usar getUserMedia diretamente do navigator
            const directGetUserMedia = (navigator as any).getUserMedia ||
              (navigator as any).webkitGetUserMedia ||
              (navigator as any).mozGetUserMedia ||
              (navigator as any).msGetUserMedia;

            if (directGetUserMedia) {
              navigator.mediaDevices.getUserMedia = function(constraints: any) {
                return new Promise((resolve, reject) => {
                  directGetUserMedia.call(navigator, constraints, resolve, reject);
                });
              };
            } else {
              throw new Error('API de mídia não disponível. Verifique as configurações do navegador.');
            }
          }
        }

        // Verificar se getUserMedia está disponível
        if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
          // Última tentativa: criar função getUserMedia usando API legada
          const legacyGetUserMedia = 
            (navigator as any).webkitGetUserMedia ||
            (navigator as any).mozGetUserMedia ||
            (navigator as any).msGetUserMedia ||
            (navigator as any).getUserMedia;

          if (legacyGetUserMedia) {
            navigator.mediaDevices.getUserMedia = function(constraints: any) {
              return new Promise((resolve, reject) => {
                legacyGetUserMedia.call(navigator, constraints, resolve, reject);
              });
            };
          } else {
            throw new Error('getUserMedia não está disponível. Verifique as permissões e configurações do navegador.');
          }
        }

        // Importar dinamicamente o @zxing/library
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        
        // Verificar novamente após import
        if (!isMounted || !videoRef.current) return;
        
        // Criar leitor de QR code
        codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        // Tentar acessar a câmera frontal primeiro, depois qualquer câmera disponível
        const constraints = {
          video: {
            facingMode: { ideal: 'user' }, // Câmera frontal (preferência)
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (frontError) {
          // Se falhar com câmera frontal, tentar qualquer câmera disponível
          console.log('Tentando câmera alternativa...');
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
          } catch (altError: any) {
            // Se ainda falhar, tentar sem restrições
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          isInitializing = false;
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        
        // Limpar srcObject anterior se existir
        if (video.srcObject) {
          const oldStream = video.srcObject as MediaStream;
          oldStream.getTracks().forEach(track => track.stop());
        }
        
        // Aguardar o vídeo estar pronto antes de tentar play
        video.srcObject = stream;
        
        // Aguardar o evento loadedmetadata antes de tentar play
        await new Promise<void>((resolve, reject) => {
          if (!video || !isMounted) {
            reject(new Error('Elemento de vídeo não encontrado'));
            return;
          }

          const onLoadedMetadata = () => {
            if (!isMounted) return;
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('loadeddata', onLoadedData);
            resolve();
          };

          const onLoadedData = () => {
            if (!isMounted) return;
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('loadeddata', onLoadedData);
            resolve();
          };

          const onError = () => {
            if (!isMounted) return;
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            video.removeEventListener('loadeddata', onLoadedData);
            reject(new Error('Erro ao carregar vídeo'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
          video.addEventListener('loadeddata', onLoadedData, { once: true });
          video.addEventListener('error', onError, { once: true });

          // Timeout de segurança
          const timeout = setTimeout(() => {
            if (video.readyState >= 2 && isMounted) {
              video.removeEventListener('loadedmetadata', onLoadedMetadata);
              video.removeEventListener('error', onError);
              video.removeEventListener('loadeddata', onLoadedData);
              resolve();
            }
          }, 3000);
          
          // Limpar timeout se resolver antes
          video.addEventListener('loadedmetadata', () => clearTimeout(timeout), { once: true });
        });

        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          isInitializing = false;
          return;
        }

        // Tentar play com tratamento de erro
        try {
          // Forçar play no mobile
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (playError: any) {
          // Ignorar erros de play interrompido (comum em React StrictMode)
          if (playError.name !== 'AbortError' && playError.name !== 'NotAllowedError') {
            console.warn('Erro ao iniciar vídeo:', playError);
          }
        }

        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Iniciar leitura de QR code apenas se ainda estiver montado
        if (codeReader && videoRef.current && isMounted) {
          codeReader.decodeFromVideoDevice(null, videoRef.current, (result: any, err: any) => {
            if (!isMounted) return;
            
            if (result) {
              const text = result.getText();
              onScan(text);
              setScanning(false);
            }
            if (err && err.name !== 'NotFoundException') {
              // Erro não crítico (apenas não encontrou QR code ainda)
              // Não logar para evitar spam no console
            }
          });
        }
        
        isInitializing = false;
      } catch (err: any) {
        isInitializing = false;
        if (!isMounted) return;
        
        const errorMsg = err.message || 'Erro ao acessar a câmera';
        
        // Verificar se é erro relacionado a contexto não seguro (HTTP)
        const isHttpError = errorMsg.includes('secure') || 
                           errorMsg.includes('HTTPS') ||
                           errorMsg.includes('permission') ||
                           errorMsg.includes('NotAllowedError') ||
                           errorMsg.includes('NotReadableError') ||
                           (!window.isSecureContext && location.protocol === 'http:') ||
                           (location.protocol === 'http:' && !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1'));
        
        if (isHttpError && location.protocol === 'http:') {
          setShowHttpInstructions(true);
        }
        
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    };

    // Pequeno delay para garantir que o DOM está pronto
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        startCamera();
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      
      if (codeReaderRef.current) {
        try {
          codeReaderRef.current.reset();
        } catch (e) {
          // Ignorar erros ao resetar
        }
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [onScan, onError]);

  const handleManualInput = () => {
    const data = prompt('Digite o código do QR code ou ID do usuário:');
    if (data) {
      onScan(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Camera size={20} className="text-sky-500" />
            Escanear QR Code
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error ? (
            <div className="text-center space-y-4">
              <AlertCircle className="mx-auto text-rose-500" size={48} />
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">{error}</p>
                {showHttpInstructions && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-3">
                    <p className="text-xs font-black text-amber-800 uppercase">Como habilitar câmera em HTTP (Desenvolvimento):</p>
                    <div className="space-y-2 text-xs text-amber-700">
                      <div>
                        <strong>Chrome/Edge:</strong>
                        <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                          <li>Acesse: <code className="bg-amber-100 px-1 rounded text-[10px]">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code></li>
                          <li>Adicione: <code className="bg-amber-100 px-1 rounded text-[10px]">{location.origin}</code></li>
                          <li>Marque como <strong>Enabled</strong> e reinicie</li>
                        </ol>
                      </div>
                      <div>
                        <strong>Firefox:</strong>
                        <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                          <li>Acesse: <code className="bg-amber-100 px-1 rounded text-[10px]">about:config</code></li>
                          <li>Procure: <code className="bg-amber-100 px-1 rounded text-[10px]">media.getusermedia.insecure.enabled</code></li>
                          <li>Defina como <strong>true</strong> e reinicie</li>
                        </ol>
                      </div>
                      <div className="pt-2 border-t border-amber-200">
                        <strong>Mobile:</strong> Use o IP local (ex: <code className="bg-amber-100 px-1 rounded text-[10px]">http://192.168.1.100:3000</code>) ou configure as flags acima
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleManualInput}
                  className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm transition-colors"
                >
                  Inserir Código Manualmente
                </button>
                {showHttpInstructions && (
                  <button
                    onClick={() => {
                      setError(null);
                      setShowHttpInstructions(false);
                      setScanning(true);
                      // Tentar novamente após um pequeno delay
                      setTimeout(() => {
                        const startCamera = async () => {
                          try {
                            if (!videoRef.current) return;
                            const { BrowserMultiFormatReader } = await import('@zxing/library');
                            const codeReader = new BrowserMultiFormatReader();
                            codeReaderRef.current = codeReader;
                            
                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                            if (videoRef.current) {
                              videoRef.current.srcObject = stream;
                              streamRef.current = stream;
                              await videoRef.current.play();
                              codeReader.decodeFromVideoDevice(null, videoRef.current, (result: any) => {
                                if (result) {
                                  onScan(result.getText());
                                }
                              });
                            }
                          } catch (e: any) {
                            setError(e.message);
                          }
                        };
                        startCamera();
                      }, 500);
                    }}
                    className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    Tentar Novamente
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-square">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }} // Espelhar para parecer mais natural
                />
                <div className="absolute inset-0 border-4 border-sky-500 rounded-xl pointer-events-none">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-sky-500"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-sky-500"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-sky-500"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-sky-500"></div>
                </div>
              </div>
              <p className="text-xs text-center text-slate-500 font-bold">
                Posicione o QR code dentro da área destacada
              </p>
              <button
                onClick={handleManualInput}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
              >
                Inserir Código Manualmente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
