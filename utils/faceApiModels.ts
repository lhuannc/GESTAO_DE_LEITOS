let faceapi: any = null;
let modelsLoaded = false;
let modelsLoading = false;

/**
 * Carrega o face-api.js dinamicamente
 */
async function loadFaceApi(): Promise<any> {
  if (faceapi) {
    return faceapi;
  }

  try {
    // Tenta importar via npm (se instalado)
    try {
      const faceApiModule = await import('face-api.js');
      faceapi = faceApiModule;
      return faceapi;
    } catch (npmError) {
      // Se falhar, tenta via importmap (CDN) usando eval dinâmico
      // @ts-ignore - Import dinâmico de URL não é tipado pelo TypeScript
      const faceApiModule = await import('https://esm.sh/face-api.js@0.22.2');
      faceapi = faceApiModule;
      return faceapi;
    }
  } catch (error) {
    console.error('Erro ao carregar face-api.js:', error);
    throw new Error('Não foi possível carregar a biblioteca face-api.js. Verifique sua conexão ou instale via npm: npm install face-api.js');
  }
}

/**
 * Carrega os modelos do face-api.js a partir de uma CDN
 * @returns Promise que resolve quando os modelos estão carregados
 */
export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) {
    return Promise.resolve();
  }

  if (modelsLoading) {
    // Se já está carregando, aguarda o carregamento atual
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (modelsLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  modelsLoading = true;

  try {
    // Carrega a biblioteca primeiro
    const faceApiLib = await loadFaceApi();
    
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

    console.log('Carregando modelos do face-api.js...');

    await Promise.all([
      faceApiLib.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceApiLib.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceApiLib.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);

    modelsLoaded = true;
    modelsLoading = false;
    console.log('Modelos do face-api.js carregados com sucesso!');
  } catch (error) {
    modelsLoading = false;
    console.error('Erro ao carregar modelos do face-api.js:', error);
    throw new Error('Falha ao carregar modelos de reconhecimento facial. Verifique sua conexão com a internet.');
  }
}

/**
 * Obtém a instância do face-api.js
 */
export async function getFaceApi(): Promise<any> {
  if (!faceapi) {
    await loadFaceApi();
  }
  return faceapi;
}

/**
 * Verifica se os modelos já foram carregados
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}
