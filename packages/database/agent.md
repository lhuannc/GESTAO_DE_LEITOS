 Database Module - Agent Documentation

## 📋 Responsabilidades

- Prisma ORM para PostgreSQL
- Schema de banco de dados
- Migrações versionadas
- Seed de dados iniciais
- Export do PrismaClient singleton

---

## 🗄️ Schema Prisma - Enums

```prisma
enum BedStatus {
  DISPONIVEL OCUPADO HIGIENIZACAO MANUTENCAO BLOQUEADO
}

enum OrderStatus {
  PENDENTE EM_ANDAMENTO CONCLUIDO CANCELADO
}

enum UserRole {
  ADMIN OPERACIONAL VISUALIZADOR
}
```

---

## 🔐 Regras de Integridade

### Leitos
- Um leito só pode ter UMA ordem ativa
- Status seguem transições válidas
- Histórico é imutável (nunca deletar)

### Ordens
- Actions seguem ordem dos Steps
- Toda mutation cria AuditLog
- Não pode pular etapas

### Usuários
- CPF único
- Senha sempre hash (bcrypt/argon2)

---

## 📝 Padrões

### PrismaClient Singleton

```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
```

### Migrações

```bash
npx prisma migrate dev --name add_feature
npx prisma migrate deploy
```

### Seed (Idempotente)

```typescript
await prisma.company.upsert({
  where: { cnpj: '00.000.000/0000-00' },
  update: {},
  create: { name: 'Hospital', cnpj: '00.000.000/0000-00' },
});
```

---

## 🔍 Queries Otimizadas

```typescript
// ✅ Use select para campos específicos
const bed = await prisma.bed.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    status: true,
  },
});

// ⚠️ Include traz TUDO
```

---

## 📊 Auditoria

```typescript
await prisma.auditLog.create({
  data: {
    userId: ctx.user.id,
    action: 'UPDATE_BED_STATUS',
    entity: 'Bed',
    entityId: bed.id,
    changes: { from: 'DISPONIVEL', to: 'OCUPADO' },
  },
});
```

---

## ✅ Checklist

- [ ] Schema validado
- [ ] Índices em campos de busca
- [ ] Enums para status
- [ ] Timestamps em todas as tabelas
- [ ] Seed script atualizado
