# 🏥 Sistema de Gestão de Leitos

Sistema completo para gerenciamento de leitos hospitalares com controle de higienização, manutenção e ordens de serviço.

## 🚀 Quick Start

### Windows
```cmd
npm run setup:cmd
npm run dev:all
```

> **Nota:** Se preferir usar PowerShell, execute `npm run setup` (requer PowerShell com política de execução configurada)

### Linux/macOS
```bash
npm run setup:unix
npm run dev:all
```

Acesse:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000

**Credenciais padrão:**
- Admin: CPF `111.111.111-11` / Senha `admin`
- Operacional: CPF `222.222.222-22` / Senha `operacional`

## 📚 Documentação Completa

Para instruções detalhadas de instalação, configuração e uso, consulte:

📖 **[Guia de Setup Completo](docs/SETUP.md)**

## 🛠️ Tecnologias

- **Frontend:** Next.js 15, React 19, TailwindCSS
- **Backend:** Fastify, tRPC, Prisma
- **Database:** PostgreSQL
- **Monorepo:** npm workspaces
- **DevOps:** Docker, Docker Compose

## 📁 Estrutura do Projeto

```
gestao-leitos-monorepo/
├── apps/
│   ├── api/          # Backend API (Fastify + tRPC)
│   └── web/          # Frontend (Next.js)
├── packages/
│   ├── database/     # Prisma schema, migrations e seeds
│   ├── types/        # TypeScript types compartilhados
│   └── utils/        # Utilitários compartilhados
├── infra/
│   └── docker/       # Configuração Docker
├── scripts/          # Scripts de automação
└── docs/             # Documentação
```

## 🎯 Comandos Principais

```bash
# Setup inicial
npm run setup              # Windows
npm run setup:unix         # Linux/macOS

# Desenvolvimento
npm run dev:all           # API + Frontend
npm run dev:api           # Apenas API
npm run dev:web           # Apenas Frontend

# Banco de dados
npm run db:reset          # Resetar e re-seed
npm run db:studio         # Interface visual
npm run db:migrate        # Executar migrations
npm run db:seed           # Executar seeds

# Build
npm run build             # Build de produção
```

## � Docker

```bash
# Iniciar PostgreSQL
cd infra/docker
docker-compose up -d postgres

# Iniciar stack completo
docker-compose up -d

# Parar containers
docker-compose down
```

## 🔑 Funcionalidades

- ✅ Gestão de leitos por unidade e setor
- ✅ Controle de status de leitos
- ✅ Ordens de serviço (higienização, manutenção)
- ✅ Sistema de equipes e usuários
- ✅ Workflow de aprovação de serviços
- ✅ Histórico e auditoria
- ✅ Dashboard operacional
- ✅ Autenticação e autorização

## � Licença

Proprietary - Todos os direitos reservados

## � Suporte

Consulte a [documentação completa](docs/SETUP.md) ou abra uma issue no repositório.

---

**Desenvolvido com ❤️ para gestão eficiente de leitos hospitalares**
