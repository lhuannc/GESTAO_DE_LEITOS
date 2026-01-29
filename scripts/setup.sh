#!/bin/bash
# Script de inicialização completa do projeto - Linux/macOS
# Este script configura o banco de dados, executa migrations e seeds

set -e

echo "🚀 Iniciando setup do projeto Gestão de Leitos..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar dependências
echo -e "${YELLOW}📋 Verificando dependências...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js não encontrado. Por favor, instale o Node.js primeiro.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm não encontrado. Por favor, instale o npm primeiro.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js e npm encontrados${NC}"

# Verificar se Docker está rodando (opcional)
DOCKER_RUNNING=false
if command_exists docker; then
    if docker ps >/dev/null 2>&1; then
        DOCKER_RUNNING=true
        echo -e "${GREEN}✅ Docker está rodando${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker instalado mas não está rodando${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker não encontrado (opcional)${NC}"
fi

echo ""

# Perguntar se deseja usar Docker
USE_DOCKER=false
if [ "$DOCKER_RUNNING" = true ]; then
    read -p "Deseja usar Docker para o PostgreSQL? (S/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]] || [[ -z $REPLY ]]; then
        USE_DOCKER=true
    fi
fi

echo ""
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"
echo ""

# Configurar variáveis de ambiente
echo -e "${YELLOW}🔧 Configurando variáveis de ambiente...${NC}"

ENV_FILE=".env"
DATABASE_URL=""

if [ "$USE_DOCKER" = true ]; then
    echo -e "${CYAN}🐳 Iniciando PostgreSQL com Docker...${NC}"
    
    # Parar containers existentes
    docker-compose -f infra/docker/docker-compose.yml down 2>/dev/null || true
    
    # Iniciar apenas o PostgreSQL
    docker-compose -f infra/docker/docker-compose.yml up -d postgres
    
    echo -e "${YELLOW}⏳ Aguardando PostgreSQL inicializar...${NC}"
    sleep 5
    
    # Aguardar até que o PostgreSQL esteja pronto
    MAX_ATTEMPTS=30
    ATTEMPT=0
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if docker exec gestao-leitos-db pg_isready -U postgres >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL está pronto!${NC}"
            break
        fi
        ATTEMPT=$((ATTEMPT + 1))
        sleep 1
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Timeout aguardando PostgreSQL${NC}"
        exit 1
    fi
    
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gestao_leitos"
else
    echo -e "${YELLOW}📝 Configure manualmente a URL do banco de dados PostgreSQL${NC}"
    read -p "DATABASE_URL [postgresql://postgres:postgres@localhost:5432/gestao_leitos]: " USER_URL
    DATABASE_URL=${USER_URL:-postgresql://postgres:postgres@localhost:5432/gestao_leitos}
fi

# Criar arquivo .env
cat > $ENV_FILE << EOF
DATABASE_URL=$DATABASE_URL
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
API_PORT=4000
EOF

echo -e "${GREEN}✅ Arquivo .env criado${NC}"
echo ""

# Executar Prisma migrations
echo -e "${YELLOW}🗄️  Executando migrations do Prisma...${NC}"
cd packages/database

# Gerar Prisma Client
npx prisma generate

# Executar migrations
if ! npx prisma migrate deploy; then
    echo -e "${YELLOW}⚠️  Erro ao executar migrations. Tentando criar o banco...${NC}"
    npx prisma db push --force-reset
fi

echo -e "${GREEN}✅ Migrations executadas${NC}"
echo ""

# Executar seeds
echo -e "${YELLOW}🌱 Executando seeds...${NC}"
npx tsx src/seed.ts

echo -e "${GREEN}✅ Seeds executados${NC}"
cd ../..
echo ""

# Resumo final
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Setup concluído com sucesso!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📝 Credenciais de acesso:${NC}"
echo "   Admin: CPF 111.111.111-11 / Senha: admin"
echo "   Operacional: CPF 222.222.222-22 / Senha: operacional"
echo ""
echo -e "${YELLOW}🚀 Para iniciar o projeto, execute:${NC}"
echo -e "${CYAN}   npm run dev:all${NC}"
echo ""
echo -e "${YELLOW}   Ou inicie separadamente:${NC}"
echo -e "${CYAN}   - API: npm run dev:api${NC}"
echo -e "${CYAN}   - Web: npm run dev:web${NC}"
echo ""
echo -e "${YELLOW}🌐 URLs:${NC}"
echo -e "${CYAN}   - Frontend: http://localhost:3000${NC}"
echo -e "${CYAN}   - API: http://localhost:4000${NC}"
if [ "$USE_DOCKER" = true ]; then
    echo -e "${CYAN}   - PostgreSQL: localhost:5432${NC}"
fi
echo ""
