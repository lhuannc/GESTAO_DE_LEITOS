# Types Module - Agent Documentation

## 📋 Responsabilidades

- **Fonte única de verdade** para tipos TypeScript
- Interfaces compartilhadas entre frontend e backend
- Enums de domínio
- Tipos derivados do Prisma

---

## 🏗️ Estrutura

```
packages/types/
├── src/
│   ├── index.ts           # Exports principais
│   ├── bed.ts             # Tipos de leitos
│   ├── order.ts           # Tipos de ordens
│   ├── user.ts            # Tipos de usuários
│   └── common.ts          # Tipos comuns
├── package.json
└── agent.md
```

---

## 📝 Regras

### 1. Nunca Duplicar Tipos

```typescript
// ✅ CORRETO: Importar do Prisma
import type { Bed, BedStatus } from '@prisma/client';

// ❌ ERRADO: Redefinir
type Bed = { id: string; name: string; }
```

### 2. Usar Zod para Runtime Validation

```typescript
import { z } from 'zod';

export const BedStatusSchema = z.enum([
  'DISPONIVEL',
  'OCUPADO',
  'HIGIENIZACAO',
]);

export type BedStatus = z.infer<typeof BedStatusSchema>;
```

### 3. Documentar Interfaces Complexas

```typescript
/**
 * Representa um leito hospitalar
 * 
 * @property id - Identificador único (CUID)
 * @property name - Nome do leito (ex: "Leito 101")
 * @property status - Status atual do leito
 */
export interface Bed {
  id: string;
  name: string;
  status: BedStatus;
}
```

### 4. Exportar Tipos do Prisma

```typescript
// index.ts
export type {
  Bed,
  Sector,
  ServiceOrder,
  User,
} from '@prisma/client';

// Tipos customizados
export * from './bed';
export * from './order';
```

---

## 🎯 Padrões

### Tipos Base vs Derivados

```typescript
// Base (do Prisma)
import type { Bed } from '@prisma/client';

// Derivado (com relações)
export type BedWithSector = Bed & {
  sector: Sector;
};

// Input (para forms)
export type BedInput = Omit<Bed, 'id' | 'createdAt' | 'updatedAt'>;
```

### Enums

```typescript
// Preferir enums do Prisma
import { BedStatus } from '@prisma/client';

// Se necessário enum custom
export enum ViewType {
  DASHBOARD = 'DASHBOARD',
  KANBAN = 'KANBAN',
  LIST = 'LIST',
}
```

---

## ✅ Checklist

- [ ] Tipos importados do Prisma quando possível
- [ ] Zod schemas para validação
- [ ] JSDoc em interfaces complexas
- [ ] Sem duplicação de tipos
- [ ] Exports organizados
