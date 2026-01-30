# API Module - Agent Documentation

## 📋 Responsabilidades

### Core
- Servidor HTTP com **Fastify**
- API layer com **tRPC**
- Autenticação e autorização
- Validação de inputs com **Zod**
- Logging estruturado
- Error handling consistente

### Domínios
- **Auth**: Login, logout, me (obter usuário atual) ✅
- **Leitos**: CRUD de leitos, atualização de status ✅
- **Orders**: Ordens de serviço, workflow, ações ✅
- **Services**: Tipos de serviço (Higienização, Manutenção, etc.) ✅
- **Users**: Gerenciamento de usuários, hash de senha ✅
- **Teams**: Gerenciamento de equipes ✅
- **Reports**: Relatórios e dashboards (futuro)

---

## 🏗️ Arquitetura

```
apps/api/
├── src/
│   ├── routers/           # tRPC routers (1 por domínio)
│   │   ├── index.ts       # App router (combina todos)
│   │   ├── auth.ts        # Autenticação ✅
│   │   ├── leitos.ts      # Leitos ✅
│   │   ├── orders.ts      # Ordens de serviço ✅
│   │   ├── services.ts    # Tipos de serviço ✅
│   │   ├── users.ts       # Usuários ✅
│   │   └── teams.ts       # Equipes ✅
│   │
│   ├── procedures/        # Business logic (opcional)
│   │   └── leitos/
│   │       ├── list.ts
│   │       └── updateStatus.ts
│   │
│   ├── middleware/        # Middlewares
│   │   ├── auth.ts        # Autenticação
│   │   └── logging.ts     # Logging
│   │
│   ├── utils/             # Utilitários
│   │   ├── logger.ts      # Logger configurado
│   │   └── errors.ts      # Error classes
│   │
│   ├── context.ts         # tRPC context
│   ├── trpc.ts            # tRPC setup
│   └── server.ts          # Fastify server
│
├── .env.example
├── package.json
├── tsconfig.json
└── agent.md               # Este arquivo
```

---

## 📝 Padrões de Código

### 1. Estrutura de Router

**Um router por domínio de negócio**

```typescript
// routers/leitos.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const leitosRouter = router({
  list: protectedProcedure
    .input(z.object({ sectorId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // Implementation
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['DISPONIVEL', 'OCUPADO', 'HIGIENIZACAO']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

### 2. Validação com Zod

**Todo input DEVE ser validado**

```typescript
// ✅ CORRETO
.input(z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  status: z.enum(['ATIVO', 'INATIVO']),
}))

// ❌ ERRADO
.input(z.any()) // Nunca usar any
```

### 3. Error Handling

**Usar TRPCError com códigos apropriados**

```typescript
import { TRPCError } from '@trpc/server';

// Not found
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Leito não encontrado',
});

// Unauthorized
throw new TRPCError({
  code: 'UNAUTHORIZED',
  message: 'Autenticação necessária',
});

// Forbidden
throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'Sem permissão',
});

// Bad request
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Dados inválidos',
  cause: validationError,
});
```

### 4. JSDoc

**Documentar todas as procedures públicas**

```typescript
/**
 * Lista todos os leitos com filtros opcionais
 * 
 * @param sectorId - ID do setor para filtrar
 * @param status - Status do leito para filtrar
 * @returns Lista de leitos com informações do setor
 * 
 * @example
 * ```typescript
 * const beds = await trpc.leitos.list.query({
 *   sectorId: 'sector_123',
 *   status: 'DISPONIVEL'
 * });
 * ```
 */
list: protectedProcedure
  .input(...)
  .query(async ({ ctx, input }) => {
    // ...
  }),
```

### 5. Logging

**Usar logger estruturado**

```typescript
import { logger } from '../utils/logger';

// Info
logger.info({ userId: ctx.user.id }, 'User logged in');

// Error
logger.error({ error, bedId: input.id }, 'Failed to update bed status');

// Debug
logger.debug({ input }, 'Processing request');
```

---

## 🔐 Regras de Autenticação

### Níveis de Acesso

1. **Public** (`publicProcedure`)
   - Login
   - Health check
   - Sem autenticação

2. **Protected** (`protectedProcedure`)
   - Requer usuário autenticado
   - Maioria das operações

3. **Admin** (`adminProcedure`)
   - Requer role ADMIN
   - Operações sensíveis (cadastros, configurações)

### Implementação

```typescript
// trpc.ts
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
  });

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({ ctx: { ...ctx, user } });
});
```

---

## 📊 Regras de Negócio

### Validação de CPF

```typescript
import { validateCPF } from '@gestao-leitos/utils';

.input(z.object({
  cpf: z.string().refine(validateCPF, {
    message: 'CPF inválido',
  }),
}))
```

### Dependência de Ordens (Bloqueios)

O sistema suporta dependências entre ordens de serviço para encadear fluxos de trabalho complexos.

1.  **Tipos de Dependência**:
    *   **BLOQUEADA**: A nova ordem nasce com status `BLOQUEADO` e aguarda a conclusão da ordem alvo.
    *   **BLOQUEADOR**: A nova ordem bloqueia uma ordem existente (que muda para `BLOQUEADO`) e deve ser concluída antes dela.

2.  **Liberação Automática**:
    *   Quando uma ordem é concluída (`updateStatus` -> `CONCLUIDO`), o sistema verifica se existem outras ordens que dependem dela (`dependsOnOrderIds`).
    *   Se TODAS as dependências de uma ordem bloqueada estiverem concluídas, ela é liberada automaticamente para `PENDENTE`.

### Auditoria

**Todas as mutations DEVEM criar audit log**

```typescript
.mutation(async ({ ctx, input }) => {
  // Perform mutation
  const result = await ctx.prisma.bed.update(...);

  // Create audit log
  await ctx.prisma.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'UPDATE_BED_STATUS',
      entity: 'Bed',
      entityId: input.id,
      changes: { status: input.status },
    },
  });

  return result;
});
```

### Rate Limiting (Futuro)

```typescript
// Implementar com @fastify/rate-limit
```

---

## 🧪 Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { appRouter } from '../src/routers';
import { createInnerTRPCContext } from '../src/context';

describe('Leitos Router', () => {
  it('should list beds', async () => {
    const ctx = createInnerTRPCContext({ userId: 'user_123' });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.leitos.list({});

    expect(result).toBeInstanceOf(Array);
  });
});
```

---

## 🚀 Performance

### Batching

tRPC automaticamente faz batching de requests.

### Caching (Futuro)

```typescript
// Implementar com Redis
```

---

## 📦 Dependências

### Core
- `@trpc/server` - tRPC server
- `fastify` - HTTP server
- `zod` - Schema validation
- `@gestao-leitos/database` - Prisma client

### Dev
- `tsx` - TypeScript execution
- `vitest` - Testing
- `typescript` - Type checking

---

## 🔧 Configuração

### Environment Variables

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Frontend
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

---

## 📈 Observabilidade

### Métricas (Futuro)
- Request count
- Response time
- Error rate

### Tracing (Futuro)
- OpenTelemetry integration

---

## ✅ Checklist de Review

Antes de fazer PR, verificar:

- [ ] Todos os inputs validados com Zod
- [ ] JSDoc em procedures públicas
- [ ] Error handling apropriado
- [ ] Audit log em mutations
- [ ] Testes unitários
- [ ] Logging estruturado
- [ ] Type-safety verificado
- [ ] Sem `any` types

---

## 🎯 Próximos Passos

1. Implementar WebSockets para real-time
2. Adicionar rate limiting
3. Implementar caching com Redis
4. Adicionar métricas
5. Implementar tracing
