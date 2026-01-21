import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { loadFaceApiModels, getFaceApi } from '../utils/faceApiModels';

interface FaceRegistrationProps {
  onSave: (descriptor: number[]) => void;
  onClose: () => void;
  currentUserName?: string;
}

const FaceRegistration: React.FC<FaceRegistrationProps> = ({ onSave, onClose, currentUserName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentDescriptor, setCurrentDescriptor] = useState<Float32Array | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Carrega os modelos do face-api.js
        await loadFaceApiModels();

        // Inicia a câmera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          
          // Aguarda o vídeo carregar metadados antes de iniciar detecção
          videoRef.current.addEventListener('loadedmetadata', () => {
            setIsLoading(false);
            startDetection();
          }, { once: true });
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Erro ao inicializar câmera:', err);
        setError(err.message || 'Não foi possível acessar a câmera.');
        setIsLoading(false);
      }
    };

    initializeCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startDetection = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const faceapi = await getFaceApi();
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Aguarda o vídeo ter dimensões reais
    const waitForVideo = () => {
      return new Promise<void>((resolve) => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        }
      });
    };

    await waitForVideo();

    const displaySize = { 
      width: video.videoWidth, 
      height: video.videoHeight 
    };

    // Define as dimensões do canvas para corresponder ao vídeo
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;

    faceapi.matchDimensions(canvas, displaySize);

    const detectFaces = async () => {
      if (!video || video.readyState !== 4) return;

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // Limpa o canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        if (resizedDetections.length > 0) {
          // Desenha o box no rosto detectado
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

          // Pega o primeiro rosto detectado
          const detection = resizedDetections[0];
          if (detection.descriptor) {
            setFaceDetected(true);
            setCurrentDescriptor(detection.descriptor);
          }
        } else {
          setFaceDetected(false);
          setCurrentDescriptor(null);
        }
      } catch (err) {
        console.error('Erro na detecção:', err);
      }

      requestAnimationFrame(detectFaces);
    };

    detectFaces();
  };

  const handleSave = () => {
    if (!currentDescriptor) return;

    setIsProcessing(true);
    
    try {
      // Converte Float32Array para Array padrão (JSON serializable)
      const descriptorArray = Array.from(currentDescriptor);
      onSave(descriptorArray);
    } catch (err) {
      console.error('Erro ao salvar descritor:', err);
      setError('Erro ao salvar biometria. Tente novamente.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <User size={20} className="text-blue-600"/>
            Cadastrar Biometria Facial
          </h4>
          <button 
            onClick={() => { stopCamera(); onClose(); }} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 relative flex flex-col overflow-hidden min-h-[400px] bg-black">
          
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 bg-slate-50">
              <Loader2 size={48} className="text-blue-600 animate-spin" />
              <p className="text-sm text-slate-600 font-medium">
                Carregando modelos de IA...
              </p>
              <p className="text-xs text-slate-400">
                Isso pode levar alguns segundos na primeira vez
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6 bg-slate-50">
              <AlertCircle size={48} className="text-rose-500" />
              <p className="text-sm text-slate-600 font-medium text-center">
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  style={{ transform: 'scaleX(-1)' }}
                  muted
                  playsInline
                  autoPlay
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{ 
                    transform: 'scaleX(-1)',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
              
              {/* Máscara escura nas bordas (sem cobrir a área central) */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Overlay escuro nas bordas */}
                <div className="absolute inset-0" style={{
                  background: `radial-gradient(ellipse at center, transparent 0%, transparent 45%, rgba(0,0,0,0.7) 100%)`
                }}></div>
              </div>
              
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                {/* Moldura de posicionamento - apenas bordas, totalmente transparente no centro */}
                <div className="w-[280px] h-[350px] md:w-64 md:h-80 relative">
                  {/* Cantos da moldura */}
                  <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg ${faceDetected ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg ${faceDetected ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg ${faceDetected ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg ${faceDetected ? 'border-green-500' : 'border-white/80'}`}></div>
                  
                  {/* Linhas das bordas (opcionais, apenas se quiser bordas completas) */}
                  <div className={`absolute inset-0 border-2 rounded-lg ${faceDetected ? 'border-green-500/30' : 'border-white/30'}`} style={{ pointerEvents: 'none' }}></div>
                </div>
                
                <div className={`mt-8 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 ${faceDetected ? 'bg-green-500/80 text-white' : 'bg-black/50 text-white/90'}`}>
                  {faceDetected ? (
                    <>
                      <CheckCircle size={18} />
                      <span className="text-sm font-medium">Rosto detectado! Pode salvar.</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium">Posicione seu rosto na área marcada</span>
                  )}
                </div>

                {currentUserName && (
                  <p className="mt-4 text-xs text-white/70 bg-black/50 px-3 py-1 rounded-full">
                    Usuário: {currentUserName}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        {!isLoading && !error && (
          <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!faceDetected || !currentDescriptor || isProcessing}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Salvar Biometria
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;
