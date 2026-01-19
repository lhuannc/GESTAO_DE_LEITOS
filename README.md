<div align="center">

# 🏥 Gestão de Leitos

Sistema completo para gerenciamento e controle de leitos hospitalares, solicitações de serviços e fluxo de trabalho de higienização.

</div>

## 📋 Sobre o Projeto

**Gestão de Leitos** é uma aplicação web moderna desenvolvida para auxiliar hospitais e unidades de saúde no gerenciamento eficiente de leitos, desde o controle de ocupação até a gestão de ordens de serviço de higienização e manutenção.

## 🚀 Tecnologias Utilizadas

- **React 19** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool moderna e rápida
- **SQLite (sql.js)** - Banco de dados SQLite rodando no navegador
- **Tailwind CSS** - Framework CSS utilitário
- **Lucide React** - Biblioteca de ícones
- **Recharts** - Biblioteca de gráficos
- **Zxing Library** - Biblioteca para leitura de códigos QR

## 📁 Estrutura do Projeto

```
GESTAO_DE_LEITOS/
│
├── components/              # Componentes React da aplicação
│   ├── Dashboard.tsx       # Painel principal com métricas e gráficos
│   ├── Login.tsx           # Tela de autenticação
│   ├── QRCodeScanner.tsx   # Componente para leitura de QR Codes
│   ├── RegistrationManager.tsx  # Gerenciador de cadastros (Admin)
│   ├── ServiceOrdersKanban.tsx  # Board Kanban de ordens de serviço
│   └── ServiceRequestForm.tsx   # Formulário de solicitação de serviços
│
├── public/                 # Arquivos estáticos
│   ├── manifest.json       # Manifesto PWA
│   └── README_ICONS.md     # Documentação de ícones
│
├── App.tsx                 # Componente raiz da aplicação
├── backend.ts              # Camada de lógica de negócio e acesso ao banco
├── database.ts             # Operações de banco de dados SQLite
├── types.ts                # Definições de tipos TypeScript
├── constants.ts            # Constantes e dados iniciais
├── utils.ts                # Funções utilitárias
├── index.tsx               # Ponto de entrada da aplicação
├── index.html              # HTML principal
├── vite.config.ts          # Configuração do Vite
├── tsconfig.json           # Configuração do TypeScript
│
├── Dockerfile              # Imagem Docker para produção
├── Dockerfile.dev          # Imagem Docker para desenvolvimento
├── docker-compose.yml      # Orquestração de containers Docker
├── nginx.conf              # Configuração do servidor web Nginx
│
├── setup-ngrok.js          # Script de configuração do Ngrok
├── start-ngrok.js          # Script de inicialização do Ngrok
│
├── DOCKER_SETUP.md         # Documentação de setup Docker
├── HTTP_CAMERA_SETUP.md    # Guia de configuração de câmera HTTP
└── NGROK_SETUP.md          # Documentação de setup Ngrok
```

## 🏗️ Arquitetura

### Camadas da Aplicação

1. **Camada de Apresentação (Components)**
   - Componentes React reutilizáveis
   - Interface de usuário responsiva
   - Gerenciamento de estado local com React Hooks

2. **Camada de Lógica (Backend)**
   - `backend.ts`: Lógica de negócio e orquestração
   - `database.ts`: Operações de banco de dados SQLite
   - Validações e transformações de dados

3. **Camada de Dados**
   - SQLite no navegador (via sql.js)
   - Persistência no localStorage
   - Backup automático de dados

## 💾 Banco de Dados

O projeto utiliza **SQLite** rodando no navegador através da biblioteca `sql.js`. O banco de dados é inicializado automaticamente na primeira execução e os dados são salvos no `localStorage` do navegador em formato base64.

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

- ✅ Inicialização automática na primeira execução
- ✅ Migração automática de dados iniciais
- ✅ Persistência no localStorage do navegador
- ✅ Operações CRUD completas
- ✅ Backup automático a cada operação de escrita

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

3. **Execute o projeto em modo de desenvolvimento**
   ```bash
   npm run dev
   ```

4. **Acesse a aplicação**
   - Abra o navegador em `http://localhost:5173`

## 📦 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Visualiza o build de produção
- `npm run ngrok:setup` - Configura o Ngrok
- `npm run ngrok:start` - Inicia o Ngrok
- `npm run dev:ngrok` - Executa desenvolvimento com Ngrok

## 🐳 Docker

O projeto inclui configuração Docker completa para desenvolvimento e produção. Consulte o arquivo `DOCKER_SETUP.md` para instruções detalhadas.

## 📱 Progressive Web App (PWA)

A aplicação é configurada como PWA, permitindo:
- Instalação em dispositivos móveis
- Funcionamento offline (com dados em localStorage)
- Acesso à câmera para leitura de QR Codes

## 🔐 Autenticação

O sistema utiliza autenticação baseada em usuários locais. Os dados de sessão são armazenados no `localStorage` do navegador.

**Usuário padrão (para testes):**
- Login: Consultar dados iniciais em `constants.ts`

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
