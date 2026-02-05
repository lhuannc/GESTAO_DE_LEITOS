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
- **Orders**: Ordens de serviço, workflow, dependências/bloqueios ✅
- **Services**: Tipos de serviço (Higienização, Manutenção, etc.) ✅
- **Users**: Gerenciamento de usuários, hash de senha ✅
- **Teams**: Gerenciamento de equipes ✅
- **Companies**: Gerenciamento de empresas ✅
- **Units**: Gerenciamento de unidades ✅
- **Sectors**: Gerenciamento de setores ✅
- **Sections**: Gerenciamento de seções (subdivisões de setores) ✅
- **Steps**: Gerenciamento de etapas de serviço ✅
- **Config**: Configurações do sistema ✅
- **ComplementItems**: Itens complementares ✅
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
│   │   ├── orders.ts      # Ordens de serviço + dependências ✅
│   │   ├── services.ts    # Tipos de serviço ✅
│   │   ├── users.ts       # Usuários ✅
│   │   ├── teams.ts       # Equipes ✅
│   │   ├── companies.ts   # Empresas ✅
│   │   ├── units.ts       # Unidades ✅
│   │   ├── sectors.ts     # Setores ✅
│   │   ├── sections.ts    # Seções ✅
│   │   ├── steps.ts       # Etapas de serviço ✅
│   │   ├── config.ts      # Configurações ✅
│   │   └── complementItems.ts # Itens complementares ✅
│   │
│   ├── middleware/        # Middlewares
│   │   └── logging.ts     # Request logging ✅
│   │
│   ├── utils/             # Utilitários
│   │   ├── jwt.ts         # JWT utilities ✅
│   │   ├── logger.ts      # Logger centralizado ✅
│   │   └── errors.ts      # Error classes ✅
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

**Usar logger centralizado**

```typescript
import { logger, createLogger } from '../utils/logger';

// Info
logger.info({ userId: ctx.user.id }, 'User logged in');

// Error
logger.error({ error, bedId: input.id }, 'Failed to update bed status');

// Debug
logger.debug({ input }, 'Processing request');

// Child logger com contexto
const orderLogger = createLogger({ module: 'orders' });
orderLogger.info({ orderId: '123' }, 'Order created');
```

### 6. Error Handling com Classes Customizadas

**Usar error classes específicas do domínio**

```typescript
import { BedNotFoundError, OrderBlockedError, handlePrismaError } from '../utils/errors';

// Throw specific errors
const bed = await ctx.prisma.bed.findUnique({ where: { id } });
if (!bed) {
  throw new BedNotFoundError(id);
}

// Handle Prisma errors
try {
  await ctx.prisma.user.create({ data: { cpf: '123' } });
} catch (error) {
  throw handlePrismaError(error);
}

// Business logic errors
if (order.status === 'BLOQUEADO') {
  throw new OrderBlockedError(order.id, order.dependsOnOrderIds);
}
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

O sistema suporta dependências entre ordens de serviço para encadear fluxos de trabalho complexos. **Implementado em 2026-01-30** ✅

1.  **Tipos de Dependência**:
    *   **BLOQUEADA**: A nova ordem nasce com status `BLOQUEADO` e aguarda a conclusão da ordem alvo.
    *   **BLOQUEADOR**: A nova ordem bloqueia uma ordem existente (que muda para `BLOQUEADO`) e deve ser concluída antes dela.
    *   **SEQUENCIAL**: Dependência automática entre etapas do mesmo fluxo (step N depende de step N-1).

2.  **Modelo de Dados**:
    *   Tabela `OrderDependency` relaciona ordens bloqueadas com ordens bloqueadoras.
    *   Campo `dependsOnOrderIds` no `ServiceOrder` (array de IDs).
    *   Campo `type` na dependência: `BLOQUEIO`, `SEQUENCIAL`.

3.  **Liberação Automática**:
    *   Quando uma ordem é concluída (`updateStatus` -> `CONCLUIDO`), o sistema:
        - Verifica ordens que dependem dela via `OrderDependency`.
        - Valida se TODAS as dependências estão concluídas usando `checkDependencies()`.
        - Libera automaticamente ordens bloqueadas para `PENDENTE`.
        - Cria histórico de liberação automática.

4.  **Implementação**:
    *   `orders.create`: Processa campo `dependency` em cada step.
    *   `orders.updateStatus`: Libera dependentes ao concluir.
    *   Helper `checkDependencies()`: Valida se todas as dependências estão concluídas.

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

## 📊 Status Atual (Atualizado em 2026-02-04)

### ✅ Implementado
- 13 routers tRPC completos (auth, leitos, orders, services, users, teams, companies, units, sectors, steps, config, complementItems)
- Sistema completo de dependências/bloqueios entre ordens
- Liberação automática de ordens bloqueadas
- Auditoria completa de todas as mutations
- Validação com Zod em todos os inputs
- Autenticação e autorização
- Histórico de ordens e leitos
- Integração completa com PostgreSQL via Prisma
- **Logger centralizado** (Pino) ✅ NOVO
- **Error classes customizadas** com mensagens em português ✅ NOVO
- **Logging middleware** com request-id e métricas ✅ NOVO

### 🔄 Em Progresso
- Testes de integração do fluxo de dependências
- Documentação de APIs

### 📋 Pendente
- WebSockets para real-time updates
- Rate limiting
- Caching com Redis
- Métricas e observabilidade
- OpenTelemetry tracing

---

## 📦 Seções (Sections)

### Visão Geral
**Data de Implementação**: 2026-02-05

Seções são subdivisões opcionais de Setores, permitindo melhor organização hierárquica:
- **Hierarquia**: Empresa > Unidade > Setor > **Seção** > Leito
- **Opcional**: Leitos podem ou não ter seção associada
- **Obrigatório**: Leitos sempre devem ter setor

### Casos de Uso
1. **Setor com Seções**: UTI pode ter "UTI Adulto", "UTI Pediátrica"
2. **Setor sem Seções**: Pronto Socorro não precisa de subdivisões
3. **Leito com Seção**: Leito 101 → Seção "UTI Adulto" → Setor "UTI"
4. **Leito sem Seção**: Leito PS01 → Setor "Pronto Socorro"

### Schema Prisma
```prisma
model Section {
  id        String   @id @default(cuid())
  name      String
  sectorId  String
  companyId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sector Sector @relation(fields: [sectorId], references: [id], onDelete: Cascade)
  beds   Bed[]

  @@index([sectorId])
  @@index([companyId])
  @@map("sections")
}

model Bed {
  // ... campos existentes
  sectionId String?
  section   Section? @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  
  @@index([sectionId])
}
```

### API Router
```typescript
// routers/sections.ts
export const sectionsRouter = router({
  list: protectedProcedure
    .input(z.object({ sectorId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return await prisma.section.findMany({
        where: {
          companyId: ctx.user.companyId,
          ...(input?.sectorId && { sectorId: input.sectorId }),
        },
        include: {
          sector: true,
          _count: { select: { beds: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(2),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verifica se há leitos associados antes de excluir
      const bedsCount = await prisma.bed.count({
        where: { sectionId: input.id },
      });
      if (bedsCount > 0) {
        throw new Error('Não é possível excluir seção com leitos associados');
      }
      // ...
    }),
});
```

### Regras de Negócio
1. **Criação**: Seção deve estar associada a um setor válido
2. **Exclusão**: Não pode excluir seção com leitos associados
3. **Leitos**: Podem ter `sectionId` null (sem seção)
4. **Cascade**: Excluir setor exclui suas seções
5. **SetNull**: Excluir seção define `sectionId` dos leitos como null

---

## 🎯 Próximos Passos

1. Executar migration do banco de dados para adicionar tabela `sections`
2. Testar fluxo completo de dependências (OS A bloqueia OS B → Concluir OS A → OS B liberada)
3. Implementar WebSockets para real-time
3. Adicionar rate limiting
4. Implementar caching com Redis
5. Adicionar métricas e dashboards
6. Implementar tracing com OpenTelemetry
