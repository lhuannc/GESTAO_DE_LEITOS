#!/bin/bash
# Script para resetar o banco de dados e executar seeds novamente

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔄 Resetando banco de dados...${NC}"
echo ""

read -p "⚠️  ATENÇÃO: Isso irá apagar TODOS os dados do banco. Confirma? (digite 'SIM' para confirmar): " CONFIRMATION

if [ "$CONFIRMATION" != "SIM" ]; then
    echo -e "${YELLOW}❌ Operação cancelada${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🗄️  Resetando banco de dados...${NC}"

cd packages/database

# Reset do banco
npx prisma migrate reset --force

echo -e "${GREEN}✅ Banco resetado e seeds executados${NC}"
cd ../..

echo ""
echo -e "${GREEN}🎉 Processo concluído!${NC}"
echo ""
echo -e "${YELLOW}📝 Credenciais de acesso:${NC}"
echo "   Admin: CPF 111.111.111-11 / Senha: admin"
echo "   Operacional: CPF 222.222.222-22 / Senha: operacional"
echo ""
