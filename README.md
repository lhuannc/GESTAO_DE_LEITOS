<div align="center">

# 🏥 Gestão de Leitos

Sistema completo para gerenciamento e controle de leitos hospitalares, solicitações de serviços e fluxo de trabalho de higienização.

</div>

## 📋 Sobre o Projeto

**Gestão de Leitos** é uma aplicação web moderna desenvolvida para auxiliar hospitais e unidades de saúde no gerenciamento eficiente de leitos, desde o controle de ocupação até a gestão de ordens de serviço de higienização e manutenção.

## 🚀 Tecnologias Utilizadas

### Frontend
- **React 19** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool moderna e rápida
- **Tailwind CSS** - Framework CSS utilitário
- **Lucide React** - Biblioteca de ícones
- **Recharts** - Biblioteca de gráficos
- **Zxing Library** - Biblioteca para leitura de códigos QR

### Backend
- **Node.js** - Ambiente de execução JavaScript
- **Express** - Framework web para Node.js
- **Better-SQLite3** - Driver SQLite nativo e rápido
- **TypeScript** - Tipagem estática no backend
- **CORS** - Middleware para requisições cross-origin

## 📁 Estrutura do Projeto

```
GESTAO_DE_LEITOS/
│
├── server/                    # Backend Node.js
│   ├── index.ts              # API REST Express
│   ├── database.ts           # Lógica de banco de dados SQLite
│   └── tsconfig.json         # Configuração TypeScript do servidor
│
├── components/               # Componentes React da aplicação
│   ├── Dashboard.tsx        # Painel principal com métricas e gráficos
│   ├── Login.tsx            # Tela de autenticação
│   ├── QRCodeScanner.tsx    # Componente para leitura de QR Codes
│   ├── RegistrationManager.tsx  # Gerenciador de cadastros (Admin)
│   ├── ServiceOrdersKanban.tsx  # Board Kanban de ordens de serviço
│   └── ServiceRequestForm.tsx   # Formulário de solicitação de serviços
│
├── public/                  # Arquivos estáticos
│   ├── manifest.json       # Manifesto PWA
│   └── README_ICONS.md     # Documentação de ícones
│
├── data/                    # Banco de dados SQLite (gerado automaticamente)
│   └── gestao_leitos.db    # Arquivo SQLite real no disco
│
├── App.tsx                  # Componente raiz da aplicação
├── backend.ts               # Cliente HTTP para API do backend
├── types.ts                 # Definições de tipos TypeScript
├── constants.ts             # Constantes e dados iniciais
├── utils.ts                 # Funções utilitárias
├── index.tsx                # Ponto de entrada da aplicação
├── index.html               # HTML principal
├── vite.config.ts           # Configuração do Vite
├── tsconfig.json            # Configuração do TypeScript
│
├── Dockerfile               # Imagem Docker para produção
├── Dockerfile.dev           # Imagem Docker para desenvolvimento
├── docker-compose.yml       # Orquestração de containers Docker
├── nginx.conf               # Configuração do servidor web Nginx
│
├── setup-ngrok.js           # Script de configuração do Ngrok
├── start-ngrok.js           # Script de inicialização do Ngrok
│
├── DOCKER_SETUP.md          # Documentação de setup Docker
├── HTTP_CAMERA_SETUP.md     # Guia de configuração de câmera HTTP
└── NGROK_SETUP.md           # Documentação de setup Ngrok
```

## 🏗️ Arquitetura

### Camadas da Aplicação

1. **Camada de Apresentação (Frontend)**
   - Componentes React reutilizáveis
   - Interface de usuário responsiva
   - Gerenciamento de estado local com React Hooks
   - Comunicação com backend via HTTP REST

2. **Camada de API (Backend Node.js)**
   - API RESTful com Express
   - Endpoints para todas as operações CRUD
   - Autenticação de usuários
   - Gerenciamento de ordens de serviço

3. **Camada de Dados (SQLite)**
   - Banco de dados SQLite real no disco
   - Arquivo local: `data/gestao_leitos.db`
   - Persistência permanente de dados
   - Transações ACID

## 💾 Banco de Dados

O projeto utiliza **SQLite real** no disco local através do `better-sqlite3`. O banco de dados é criado automaticamente na primeira execução do backend no diretório `data/`.

### Tabelas do Banco de Dados

- **`companies`** - Cadastro de empresas
- **`units`** - Unidades de cada empresa
- **`sectors`** - Setores de cada unidade
- **`beds`** - Leitos e seus status
- **`services`** - Tipos de serviços disponíveis
- **`actions`** - Ações/Status para ordens de serviço
- **`users`** - Usuários do sistema
- **`teams`** - Equipes de trabalho
- **`complement_items`** - Itens complementares para serviços
- **`service_orders`** - Ordens de serviço

### Funcionalidades do Banco

- ✅ Banco SQLite real no disco local
- ✅ Criação automática na primeira execução
- ✅ Migração automática de dados iniciais
- ✅ Persistência permanente
- ✅ Transações ACID
- ✅ Foreign keys habilitadas
- ✅ Modo WAL para melhor performance

## 👥 Sistema de Usuários e Permissões

O sistema possui três níveis de permissão:

1. **Administrador**
   - Acesso completo ao sistema
   - Gerenciamento de cadastros (empresas, unidades, setores, leitos, etc.)
   - Visualização de todas as métricas

2. **Executor (Membro de Equipe)**
   - Acesso ao Dashboard
   - Visualização e execução de ordens de serviço (Kanban)
   - Solicitação de serviços

3. **Solicitante**
   - Acesso ao Dashboard
   - Solicitação de serviços
   - Visualização de status das solicitações

## 🎯 Funcionalidades Principais

### 📊 Dashboard
- Métricas em tempo real de ocupação de leitos
- Gráficos e visualizações de dados
- Status geral do sistema

### 📝 Solicitação de Serviços
- Formulário para criar ordens de serviço
- Seleção de leitos por QR Code ou busca
- Definição de serviços e prioridades

### 📋 Kanban de Ordens
- Visualização em colunas (Bloqueado, Pendente, Em Andamento, Concluído)
- Arrastar e soltar para alterar status
- Atribuição de ordens a equipes
- Acompanhamento de progresso

### ⚙️ Gerenciamento de Cadastros (Admin)
- CRUD completo para todas as entidades
- Empresas, Unidades, Setores, Leitos
- Serviços, Ações, Usuários, Equipes
- Itens complementares

## 🔧 Instalação e Configuração

### Pré-requisitos

- Node.js (versão 18 ou superior)
- npm ou yarn

### Passos para Instalação

1. **Clone o repositório**
   ```bash
   git clone <url-do-repositório>
   cd GESTAO_DE_LEITOS
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Inicie o backend**
   ```bash
   npm run server
   ```
   O servidor backend iniciará em `http://localhost:3001` e criará o banco de dados em `data/gestao_leitos.db`.

4. **Em outro terminal, inicie o frontend**
   ```bash
   npm run dev
   ```

5. **Ou inicie ambos simultaneamente**
   ```bash
   npm run dev:all
   ```

6. **Acesse a aplicação**
   - Frontend: `http://localhost:5173` (ou porta configurada no Vite)
   - Backend API: `http://localhost:3001`

## 📦 Scripts Disponíveis

### Frontend
- `npm run dev` - Inicia o servidor de desenvolvimento do frontend
- `npm run build` - Cria build de produção
- `npm run preview` - Visualiza o build de produção

### Backend
- `npm run server` - Inicia o servidor backend Node.js
- `npm run dev:server` - Inicia o servidor em modo watch (reinicia automaticamente)

### Ambos
- `npm run dev:all` - Inicia backend e frontend simultaneamente

### Utilitários
- `npm run ngrok:setup` - Configura o Ngrok
- `npm run ngrok:start` - Inicia o Ngrok
- `npm run dev:ngrok` - Executa desenvolvimento com Ngrok

## 🔌 API REST

O backend expõe a seguinte API REST:

- `GET /api/data` - Buscar todos os dados
- `POST /api/auth` - Autenticação de usuário
- `POST /api/orders` - Criar ordens de serviço
- `POST /api/orders/:id/assign` - Atribuir ordem a usuário
- `POST /api/orders/:id/unassign` - Remover atribuição
- `PUT /api/orders/:id/status` - Atualizar status da ordem
- `POST /api/registry` - Salvar registro (CRUD)
- `DELETE /api/registry/:type/:id` - Deletar registro

## 🐳 Docker

O projeto inclui configuração Docker completa para desenvolvimento e produção. Consulte o arquivo `DOCKER_SETUP.md` para instruções detalhadas.

## 📱 Progressive Web App (PWA)

A aplicação é configurada como PWA, permitindo:
- Instalação em dispositivos móveis
- Acesso à câmera para leitura de QR Codes

## 🔐 Autenticação

O sistema utiliza autenticação baseada em usuários locais. Os dados de sessão são armazenados no `localStorage` do navegador.

**Usuário padrão (para testes):**
- Login: `ADMIN`
- Senha: `ADMIN`

## 📝 Notas Importantes

- O banco de dados SQLite é criado automaticamente na pasta `data/` na primeira execução do backend
- O arquivo `data/gestao_leitos.db` é ignorado pelo Git (não será versionado)
- Para backup, copie manualmente o arquivo `data/gestao_leitos.db`
- O backend precisa estar rodando para o frontend funcionar completamente

## 📚 Documentação Adicional

- **DOCKER_SETUP.md** - Guia completo de configuração Docker
- **HTTP_CAMERA_SETUP.md** - Configuração de acesso à câmera via HTTP
- **NGROK_SETUP.md** - Configuração do Ngrok para acesso remoto

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença

Este projeto é privado e destinado ao uso interno.

---

**Desenvolvido com ❤️ para facilitar a gestão de leitos hospitalares**
