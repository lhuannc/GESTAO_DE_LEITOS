# 🚀 Setup do Projeto - Gestão de Leitos

Este guia explica como configurar e executar o projeto completo.

## 📋 Pré-requisitos

- **Node.js** 18+ e **npm**
- **PostgreSQL** (ou Docker para executar PostgreSQL em container)
- **Git**

### Opcional
- **Docker** e **Docker Compose** (recomendado para facilitar o setup do banco de dados)

## 🛠️ Instalação Rápida

### Windows

**Método Recomendado (Batch Script):**
```cmd
npm run setup:cmd
```

**Método Alternativo (PowerShell):**
```powershell
npm run setup
```
> Nota: O método PowerShell pode requerer configuração da política de execução

### Linux/macOS

```bash
# Dar permissão de execução ao script
chmod +x scripts/setup.sh

# Executar o script de setup completo
npm run setup:unix
```

## 📝 O que o script de setup faz?

1. ✅ Verifica dependências (Node.js, npm, Docker)
2. 📦 Instala todas as dependências do projeto
3. 🐳 Opcionalmente inicia PostgreSQL via Docker
4. 🔧 Cria arquivo `.env` com configurações
5. 🗄️ Executa migrations do Prisma
6. 🌱 Popula o banco com dados iniciais (seeds)

## 🎯 Comandos Disponíveis

### Setup Inicial

```bash
# Windows
npm run setup

# Linux/macOS
npm run setup:unix
```

### Desenvolvimento

```bash
# Iniciar API e Frontend simultaneamente
npm run dev:all

# Iniciar apenas a API
npm run dev:api

# Iniciar apenas o Frontend
npm run dev:web
```

### Banco de Dados

```bash
# Resetar banco de dados (apaga todos os dados e re-executa seeds)
# Windows
npm run db:reset

# Linux/macOS
npm run db:reset:unix

# Abrir Prisma Studio (interface visual do banco)
npm run db:studio

# Executar migrations
npm run db:migrate

# Executar apenas seeds
npm run db:seed
```

### Build e Limpeza

```bash
# Build de produção
npm run build

# Limpar node_modules
npm run clean
```

## 🔑 Credenciais Padrão

Após executar o setup, você pode fazer login com:

### Administrador
- **CPF:** `111.111.111-11`
- **Senha:** `admin`

### Operacional
- **CPF:** `222.222.222-22`
- **Senha:** `operacional`

## 🌐 URLs do Projeto

Após iniciar o projeto com `npm run dev:all`:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000
- **PostgreSQL:** localhost:5432 (se usando Docker)
- **Prisma Studio:** http://localhost:5555 (ao executar `npm run db:studio`)

## 🐳 Usando Docker

### Iniciar apenas o PostgreSQL

```bash
cd infra/docker
docker-compose up -d postgres
```

### Iniciar todo o stack (PostgreSQL + API)

```bash
cd infra/docker
docker-compose up -d
```

### Parar containers

```bash
cd infra/docker
docker-compose down
```

### Ver logs

```bash
cd infra/docker
docker-compose logs -f
```

## 🔧 Configuração Manual

Se preferir não usar o script de setup, siga estes passos:

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gestao_leitos
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_PORT=4000
```

### 3. Configurar banco de dados

```bash
cd packages/database

# Gerar Prisma Client
npx prisma generate

# Executar migrations
npx prisma migrate deploy

# Executar seeds
npx tsx src/seed.ts

cd ../..
```

### 4. Iniciar o projeto

```bash
npm run dev:all
```

## 🗂️ Estrutura do Projeto

```
gestao-leitos-monorepo/
├── apps/
│   ├── api/          # Backend (Fastify + tRPC)
│   └── web/          # Frontend (Next.js)
├── packages/
│   ├── database/     # Prisma + Seeds
│   ├── types/        # TypeScript types compartilhados
│   └── utils/        # Utilitários compartilhados
├── infra/
│   └── docker/       # Docker Compose e Dockerfiles
├── scripts/          # Scripts de setup e automação
│   ├── setup.ps1     # Setup para Windows
│   ├── setup.sh      # Setup para Linux/macOS
│   ├── reset-db.ps1  # Reset DB para Windows
│   └── reset-db.sh   # Reset DB para Linux/macOS
└── docs/             # Documentação
```

## 🐛 Troubleshooting

### Erro de conexão com PostgreSQL

1. Verifique se o PostgreSQL está rodando:
   ```bash
   # Com Docker
   docker ps | grep gestao-leitos-db
   
   # Sem Docker (Windows)
   Get-Service postgresql*
   ```

2. Verifique a `DATABASE_URL` no arquivo `.env`

### Erro ao executar migrations

```bash
# Force reset do banco
cd packages/database
npx prisma migrate reset --force
cd ../..
```

### Porta já em uso

Se as portas 3000 ou 4000 já estiverem em uso, você pode alterá-las:

- **API:** Edite `API_PORT` no `.env`
- **Web:** Edite `package.json` em `apps/web` e altere o script `dev`

### Limpar tudo e recomeçar

```bash
# Limpar node_modules
npm run clean

# Reinstalar
npm install

# Executar setup novamente
npm run setup  # ou npm run setup:unix
```

## 📚 Próximos Passos

Após o setup bem-sucedido:

1. 🎨 Explore o frontend em http://localhost:3000
2. 🔍 Visualize o banco de dados com `npm run db:studio`
3. 📖 Leia a documentação em `docs/`
4. 🧪 Execute os testes (quando disponíveis)

## 💡 Dicas

- Use `npm run dev:all` para desenvolvimento full-stack
- Use `npm run db:studio` para visualizar e editar dados
- Use `npm run db:reset` quando precisar resetar os dados de teste
- Mantenha o Docker rodando para facilitar o desenvolvimento

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs do terminal
2. Consulte a documentação em `docs/`
3. Verifique os logs do Docker: `docker-compose logs`
4. Abra uma issue no repositório

---

**Desenvolvido com ❤️ para gestão eficiente de leitos hospitalares**
