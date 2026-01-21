# Configuração de Reconhecimento Facial

Este documento descreve a implementação completa de reconhecimento facial usando `face-api.js` no sistema de Gestão de Leitos.

## 📋 Requisitos

### Instalação via NPM (Recomendado)

Para desenvolvimento local, instale a biblioteca:

```bash
npm install face-api.js
```

### Ou via CDN/ESM

O sistema está configurado para usar a biblioteca via ESM do esm.sh no `index.html`:

```html
"face-api.js": "https://esm.sh/face-api.js@0.22.2"
```

## 🏗️ Arquitetura

### 1. **Tipos (types.ts)**
- Interface `User` atualizada com campo opcional `faceDescriptor?: number[]`
- O descritor facial é armazenado como array de números (JSON serializable)

### 2. **Utilitário de Modelos (utils/faceApiModels.ts)**
- Função `loadFaceApiModels()` carrega os modelos necessários:
  - SSD MobileNet V1 (detecção de faces)
  - FaceLandmark68Net (landmarks faciais)
  - FaceRecognitionNet (reconhecimento)
- Modelos carregados de CDN: `https://justadudewhohacks.github.io/face-api.js/models`

### 3. **Componente de Cadastro (components/FaceRegistration.tsx)**
- Permite ao usuário cadastrar sua biometria facial
- Abre câmera frontal
- Detecta rosto em tempo real
- Extrai descritor facial (Float32Array)
- Converte para Array padrão para salvar no banco
- Callback `onSave(descriptor: number[])`

### 4. **Componente de Autenticação (components/FaceAuthScanner.tsx)**
- Recebe lista de usuários com biometria cadastrada
- Converte descritores salvos de volta para Float32Array
- Cria FaceMatcher com tolerância 0.6
- Detecta e compara rostos em tempo real
- Feedback visual com box desenhado no rosto
- Callback `onMatch(userId: string)` quando match encontrado

### 5. **Integração (components/ServiceOrdersKanban.tsx)**
- Substitui/complementa o QRCodeScanner
- Prioriza reconhecimento facial se usuário tiver biometria cadastrada
- Fallback automático para QR code em caso de erro ou ausência de biometria
- Mantém compatibilidade com sistema existente

### 6. **Interface de Cadastro (components/RegistrationManager.tsx)**
- Botão para cadastrar biometria no modal de edição de usuário
- Mostra status da biometria (cadastrada/não cadastrada)
- Permite re-cadastrar biometria

## 🔧 Funcionalidades

### Cadastro de Biometria
1. Usuário abre modal de edição
2. Clica em "Cadastrar Biometria"
3. Câmera frontal abre
4. Sistema detecta rosto em tempo real
5. Usuário clica em "Salvar Biometria"
6. Descritor é salvo no banco de dados

### Autenticação Facial
1. Usuário tenta atribuir tarefa
2. Sistema verifica se tem biometria cadastrada
3. Se sim, abre scanner facial
4. Detecta rosto e compara com descritores salvos
5. Se match encontrado (confiança > 70%), autentica
6. Se falhar, fallback para QR code

## ⚙️ Configurações

### Tolerância de Match
- Configurada em `FaceAuthScanner.tsx`: `new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)`
- Valor padrão: 0.6 (maior = mais tolerante)
- Recomendado: 0.5 - 0.7

### Confiança Mínima
- Configurada em `FaceAuthScanner.tsx`: `confidence > 0.7`
- Valor padrão: 70%
- Ajustável conforme necessidade de segurança

### Modelos de IA
- SSD MobileNet V1: Rápido e eficiente para detecção
- FaceLandmark68Net: Precisão em landmarks
- FaceRecognitionNet: Reconhecimento facial

## 🚨 Tratamento de Erros

- **Modelos não carregados**: Exibe loading e erro amigável
- **Câmera indisponível**: Mostra mensagem de erro
- **Nenhuma biometria cadastrada**: Fallback para QR code
- **Match não encontrado**: Permite tentar novamente ou usar QR code

## 📱 Compatibilidade

- **Navegadores**: Chrome, Firefox, Safari, Edge (modernos)
- **Dispositivos**: Desktop e Mobile
- **HTTPS**: Necessário para acesso à câmera em produção

## 🔒 Segurança

- Descritores faciais são armazenados localmente (IndexedDB)
- Nenhum dado biométrico é enviado para servidores externos
- Comparação realizada localmente no navegador
- Compatível com LGPD/GDPR

## 📝 Notas

- O carregamento dos modelos pode levar alguns segundos na primeira vez
- Modelos são baixados de CDN pública
- Para produção, considere hospedar modelos localmente
- Recomenda-se usar HTTPS para segurança adicional
