# 📁 Pasta LEGADO

Esta pasta contém arquivos do **sistema antigo** que usava **SQLite com sql.js (WASM)**.

## ⚠️ IMPORTANTE

**Estes arquivos NÃO estão mais em uso!**

O sistema atual utiliza:
- ✅ **PostgreSQL** com **Prisma ORM**
- ✅ **tRPC** para API type-safe
- ✅ Arquitetura moderna com monorepo

## 📂 Arquivos Legados

### `backend.ts`
- Classe `BackendDB` com métodos manuais para SQLite
- Queries SQL diretas
- Sistema de autenticação antigo
- Gerenciamento de ordens de serviço (versão antiga)

### `database.ts`
- Funções de inicialização do SQLite
- Conversores de rows para objetos TypeScript
- Gerenciamento do banco WASM

### `constants.ts`
- Dados mock e iniciais
- Usuários de teste
- Configurações iniciais do sistema antigo

## 🗑️ Por que manter?

Estes arquivos foram movidos para esta pasta ao invés de deletados para:
1. **Referência histórica** - entender como o sistema funcionava antes
2. **Migração de dados** - caso seja necessário recuperar alguma lógica específica
3. **Documentação** - exemplos de como certos recursos eram implementados

## 🚀 Sistema Atual

Para trabalhar com o banco de dados atual, use:

```typescript
import { prisma } from '@gestao-leitos/database/client';
```

Veja a documentação em `agent.md` para mais informações sobre o sistema atual.

---

**Data da migração:** Fevereiro 2026
**Motivo:** Transição de SQLite/WASM para PostgreSQL + Prisma
