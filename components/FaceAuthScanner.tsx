import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { loadFaceApiModels, getFaceApi } from '../utils/faceApiModels';
import { User as UserType } from '../types';

interface FaceAuthScannerProps {
  users: UserType[];
  onMatch: (userId: string) => void;
  onClose: () => void;
  onError?: (error: string) => void;
}

const FaceAuthScanner: React.FC<FaceAuthScannerProps> = ({ users, onMatch, onClose, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Carrega os modelos do face-api.js
        await loadFaceApiModels();

        // Filtra usuários que possuem faceDescriptor
        const usersWithFace = users.filter(u => u.faceDescriptor && u.faceDescriptor.length > 0);

        if (usersWithFace.length === 0) {
          const errorMsg = 'Nenhum usuário com biometria cadastrada encontrado.';
          setError(errorMsg);
          if (onError) onError(errorMsg);
          setIsLoading(false);
          return;
        }

        // Obtém a instância do face-api.js
        const faceapi = await getFaceApi();
        
        // Converte os descritores salvos (Array) de volta para Float32Array
        const labeledFaceDescriptors = usersWithFace.map(user => {
          const descriptor = new Float32Array(user.faceDescriptor!);
          return new faceapi.LabeledFaceDescriptors(user.id, [descriptor]);
        });

        // Cria FaceMatcher com tolerância de 0.6
        faceMatcherRef.current = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

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
        }

        setIsLoading(false);
        startDetection();
      } catch (err: any) {
        console.error('Erro ao inicializar scanner facial:', err);
        const errorMsg = err.message || 'Não foi possível inicializar o scanner facial.';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      stopCamera();
    };
  }, [users, onError]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startDetection = async () => {
    if (!videoRef.current || !canvasRef.current || !faceMatcherRef.current) return;

    const faceapi = await getFaceApi();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };

    faceapi.matchDimensions(canvas, displaySize);

    const detectAndMatch = async () => {
      if (!video || video.readyState !== 4 || isMatching) return;

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

        if (resizedDetections.length > 0 && faceMatcherRef.current) {
          const detection = resizedDetections[0];
          
          // Faz o match
          const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);
          
          // Desenha o box no rosto detectado
          const box = detection.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, {
            label: bestMatch.label !== 'unknown' 
              ? `${bestMatch.label} (${(1 - bestMatch.distance).toFixed(2)})`
              : 'Desconhecido',
            boxColor: bestMatch.label !== 'unknown' ? 'green' : 'red'
          });
          drawBox.draw(canvas);

          // Desenha landmarks
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

          if (bestMatch.label !== 'unknown') {
            const matchedUser = users.find(u => u.id === bestMatch.label);
            const confidence = 1 - bestMatch.distance;
            
            setDetectedName(matchedUser?.name || bestMatch.label);
            setDetectionConfidence(confidence);

            // Se confiança for alta o suficiente (> 0.7), considera match válido
            if (confidence > 0.7 && !isMatching) {
              setIsMatching(true);
              setTimeout(() => {
                onMatch(bestMatch.label);
                stopCamera();
              }, 500);
            }
          } else {
            setDetectedName(null);
            setDetectionConfidence(0);
          }
        } else {
          setDetectedName(null);
          setDetectionConfidence(0);
        }
      } catch (err) {
        console.error('Erro na detecção:', err);
      }

      requestAnimationFrame(detectAndMatch);
    };

    detectAndMatch();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Camera size={20} className="text-blue-600"/>
            Autenticação Facial
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
                Isso pode levar alguns segundos
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6 bg-slate-50">
              <AlertCircle size={48} className="text-rose-500" />
              <p className="text-sm text-slate-600 font-medium text-center">
                {error}
              </p>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fechar
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
                  style={{ transform: 'scaleX(-1)', objectFit: 'contain' }}
                />
              </div>
              
              {/* Máscara escura nas bordas (sem cobrir a área central) */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0" style={{
                  background: `radial-gradient(ellipse at center, transparent 0%, transparent 45%, rgba(0,0,0,0.7) 100%)`
                }}></div>
              </div>
              
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none">
                {/* Moldura de posicionamento - apenas bordas, totalmente transparente no centro */}
                <div className="w-[280px] h-[350px] md:w-64 md:h-80 relative">
                  {/* Cantos da moldura */}
                  <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg ${detectedName ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg ${detectedName ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg ${detectedName ? 'border-green-500' : 'border-white/80'}`}></div>
                  <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg ${detectedName ? 'border-green-500' : 'border-white/80'}`}></div>
                  
                  {/* Linhas das bordas */}
                  <div className={`absolute inset-0 border-2 rounded-lg ${detectedName ? 'border-green-500/30' : 'border-white/30'}`} style={{ pointerEvents: 'none' }}></div>
                </div>
                
                {detectedName ? (
                  <div className="mt-8 px-4 py-3 rounded-full backdrop-blur-md bg-green-500/80 text-white flex items-center gap-2">
                    <CheckCircle size={18} />
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold">{detectedName}</span>
                      <span className="text-xs opacity-90">
                        Confiança: {(detectionConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 px-4 py-2 rounded-full backdrop-blur-md bg-black/50 text-white/90">
                    <span className="text-sm font-medium">Posicione seu rosto na área marcada</span>
                  </div>
                )}

                {isMatching && (
                  <div className="mt-4 px-4 py-2 rounded-full backdrop-blur-md bg-blue-500/80 text-white flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Autenticando...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        {!isLoading && !error && (
          <div className="p-4 bg-white border-t border-slate-100">
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="w-full py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceAuthScanner;
