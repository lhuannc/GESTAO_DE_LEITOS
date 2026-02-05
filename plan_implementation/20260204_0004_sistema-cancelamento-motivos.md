# Plano de ImplementaÃ§Ã£o: Sistema de Cancelamento e Motivos

## Objetivo

Implementar sistema completo de cancelamento de aÃ§Ãµes com:
1. Nova coluna CANCELADO no Kanban
2. AutenticaÃ§Ã£o para cancelamento
3. Sistema de motivos com regras (CANCELAMENTO e FORA_DO_PRAZO)
4. LiberaÃ§Ã£o automÃ¡tica de dependÃªncias ao cancelar
5. ValidaÃ§Ã£o de SLA ao concluir

---

## AnÃ¡lise de Requisitos

### Funcionalidades Principais

#### 1. Status CANCELADO
- Nova coluna no Kanban apÃ³s CONCLUIDO
- AÃ§Ãµes canceladas liberam dependÃªncias (similar a CONCLUIDO)
- Registro de quem cancelou, quando e por quÃª

#### 2. AutenticaÃ§Ã£o para Cancelamento
- Requer login e senha do usuÃ¡rio
- Similar ao fluxo de atribuiÃ§Ã£o de aÃ§Ã£o
- ValidaÃ§Ã£o via backend

#### 3. Sistema de Motivos
- Cadastro de motivos com regras associadas
- **Regra CANCELAMENTO**: Motivos para cancelar aÃ§Ã£o
- **Regra FORA_DO_PRAZO**: Motivos para justificar atraso
- Indicadores visuais das regras

#### 4. Fluxo de Cancelamento
1. UsuÃ¡rio clica "Cancelar AÃ§Ã£o" no modal
2. Sistema solicita login/senha
3. Sistema exibe motivos de CANCELAMENTO
4. UsuÃ¡rio seleciona motivo e adiciona observaÃ§Ã£o
5. Sistema valida e cancela aÃ§Ã£o
6. DependÃªncias sÃ£o liberadas

#### 5. Fluxo de ConclusÃ£o com SLA Vencido
1. UsuÃ¡rio clica "Finalizar AÃ§Ã£o"
2. Sistema verifica SLA
3. Se vencido, solicita motivo de FORA_DO_PRAZO
4. UsuÃ¡rio seleciona motivo e adiciona observaÃ§Ã£o
5. Sistema registra e conclui aÃ§Ã£o

---

## Estrutura de Dados

### Novos Tipos

```typescript
// packages/types/index.ts

export type OSStatus = 'BLOQUEADO' | 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

export type ReasonRule = 'CANCELAMENTO' | 'FORA_DO_PRAZO';

export interface Reason {
  id: string;
  name: string;
  rule: ReasonRule;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationRecord {
  id: string;
  orderId: string;
  userId: string;
  reasonId: string;
  notes?: string;
  createdAt: string;
}

export interface SLAOverdueRecord {
  id: string;
  orderId: string;
  userId: string;
  reasonId: string;
  notes?: string;
  createdAt: string;
}
```

### Schema Prisma

```prisma
// apps/api/prisma/schema.prisma

enum ReasonRule {
  CANCELAMENTO
  FORA_DO_PRAZO
}

model Reason {
  id        String     @id @default(cuid())
  name      String
  rule      ReasonRule
  companyId String
  company   Company    @relation(fields: [companyId], references: [id])
  
  cancellations CancellationRecord[]
  slaOverdues   SLAOverdueRecord[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([companyId])
  @@index([rule])
}

model CancellationRecord {
  id       String @id @default(cuid())
  orderId  String
  userId   String
  reasonId String
  notes    String?
  
  order  ServiceOrder @relation(fields: [orderId], references: [id])
  user   User         @relation(fields: [userId], references: [id])
  reason Reason       @relation(fields: [reasonId], references: [id])
  
  createdAt DateTime @default(now())
  
  @@index([orderId])
  @@index([userId])
}

model SLAOverdueRecord {
  id       String @id @default(cuid())
  orderId  String
  userId   String
  reasonId String
  notes    String?
  
  order  ServiceOrder @relation(fields: [orderId], references: [id])
  user   User         @relation(fields: [userId], references: [id])
  reason Reason       @relation(fields: [reasonId], references: [id])
  
  createdAt DateTime @default(now())
  
  @@index([orderId])
  @@index([userId])
}

// Adicionar ao ServiceOrder
model ServiceOrder {
  // ... campos existentes
  
  cancelledAt       DateTime?
  cancelledByUserId String?
  cancelledBy       User?                @relation("CancelledBy", fields: [cancelledByUserId], references: [id])
  
  cancellationRecords CancellationRecord[]
  slaOverdueRecords   SLAOverdueRecord[]
}
```

---

## API (tRPC)

### Router: `reasons`

```typescript
// apps/api/src/routers/reasons.ts

export const reasonsRouter = router({
  list: protectedProcedure
    .input(z.object({
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.reason.findMany({
        where: {
          companyId: ctx.user.companyId,
          ...(input.rule && { rule: input.rule }),
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(3),
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.reason.create({
        data: {
          name: input.name,
          rule: input.rule,
          companyId: ctx.user.companyId,
        },
      });
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3),
      rule: z.enum(['CANCELAMENTO', 'FORA_DO_PRAZO']),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.reason.update({
        where: { id: input.id },
        data: {
          name: input.name,
          rule: input.rule,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.reason.delete({
        where: { id: input.id },
      });
    }),
});
```

### Atualizar `orders` Router

```typescript
// apps/api/src/routers/orders.ts

export const ordersRouter = router({
  // ... rotas existentes

  cancel: protectedProcedure
    .input(z.object({
      id: z.string(),
      reasonId: z.string(),
      notes: z.string().optional(),
      userLogin: z.string(),
      userPassword: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Validar usuÃ¡rio
      const user = await ctx.prisma.user.findFirst({
        where: {
          login: input.userLogin,
          companyId: ctx.user.companyId,
        },
      });
      
      if (!user || user.password !== hashPassword(input.userPassword)) {
        throw new UnauthorizedError('Credenciais invÃ¡lidas');
      }

      // 2. Buscar ordem
      const order = await ctx.prisma.serviceOrder.findUnique({
        where: { id: input.id },
      });
      
      if (!order) {
        throw new OrderNotFoundError(input.id);
      }

      if (order.status === 'CANCELADO' || order.status === 'CONCLUIDO') {
        throw new BusinessLogicError('AÃ§Ã£o jÃ¡ finalizada ou cancelada');
      }

      // 3. Cancelar ordem
      const updatedOrder = await ctx.prisma.serviceOrder.update({
        where: { id: input.id },
        data: {
          status: 'CANCELADO',
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
        },
      });

      // 4. Registrar cancelamento
      await ctx.prisma.cancellationRecord.create({
        data: {
          orderId: input.id,
          userId: user.id,
          reasonId: input.reasonId,
          notes: input.notes,
        },
      });

      // 5. Liberar dependÃªncias
      await releaseDependencies(ctx.prisma, input.id);

      // 6. Audit log
      await createAuditLog(ctx.prisma, {
        action: 'ORDER_CANCELLED',
        userId: user.id,
        orderId: input.id,
        details: { reasonId: input.reasonId, notes: input.notes },
      });

      return updatedOrder;
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO']),
      slaOverdueReasonId: z.string().optional(),
      slaOverdueNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ... validaÃ§Ãµes existentes

      // Se CONCLUIDO, verificar SLA
      if (input.status === 'CONCLUIDO') {
        const slaViolation = await checkSLAViolation(order);
        
        if (slaViolation && !input.slaOverdueReasonId) {
          throw new BusinessLogicError('SLA vencido - motivo obrigatÃ³rio');
        }

        if (input.slaOverdueReasonId) {
          await ctx.prisma.sLAOverdueRecord.create({
            data: {
              orderId: input.id,
              userId: ctx.user.id,
              reasonId: input.slaOverdueReasonId,
              notes: input.slaOverdueNotes,
            },
          });
        }
      }

      // ... resto da lÃ³gica existente
    }),
});
```

---

## Frontend

### 1. Componente: Kanban (atualizar)

```typescript
// apps/web/src/components/ServiceOrdersKanban.tsx

const COLUMNS = [
  { id: 'BLOQUEADO', label: 'Bloqueado', color: 'bg-slate-200 text-slate-600', icon: <Lock size={14} /> },
  { id: 'PENDENTE', label: 'Pendente', color: 'bg-amber-100 text-amber-600', icon: <AlertCircle size={14} /> },
  { id: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'bg-sky-100 text-sky-600', icon: <Play size={14} /> },
  { id: 'CONCLUIDO', label: 'ConcluÃ­do', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle size={14} /> },
  { id: 'CANCELADO', label: 'Cancelado', color: 'bg-rose-100 text-rose-600', icon: <XCircle size={14} /> }, // NOVO
];
```

### 2. Modal de Cancelamento

```typescript
// apps/web/src/components/CancelOrderModal.tsx

interface CancelOrderModalProps {
  order: ServiceOrder;
  reasons: Reason[];
  onConfirm: (data: CancelData) => Promise<void>;
  onClose: () => void;
}

interface CancelData {
  reasonId: string;
  notes?: string;
  userLogin: string;
  userPassword: string;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  reasons,
  onConfirm,
  onClose
}) => {
  const [formData, setFormData] = useState<CancelData>({
    reasonId: '',
    notes: '',
    userLogin: '',
    userPassword: '',
  });

  // Filtrar apenas motivos de CANCELAMENTO
  const cancellationReasons = reasons.filter(r => r.rule === 'CANCELAMENTO');

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-black text-rose-600 mb-4">
          âš ï¸ Cancelar AÃ§Ã£o
        </h3>
        
        <p className="text-sm text-slate-600 mb-6">
          Esta aÃ§Ã£o nÃ£o pode ser desfeita. Informe o motivo do cancelamento.
        </p>

        {/* Motivo */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            Motivo do Cancelamento *
          </label>
          <select
            value={formData.reasonId}
            onChange={(e) => setFormData({ ...formData, reasonId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          >
            <option value="">Selecione um motivo</option>
            {cancellationReasons.map(reason => (
              <option key={reason.id} value={reason.id}>{reason.name}</option>
            ))}
          </select>
        </div>

        {/* ObservaÃ§Ãµes */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            ObservaÃ§Ãµes (opcional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            rows={3}
            placeholder="Detalhes adicionais..."
          />
        </div>

        {/* AutenticaÃ§Ã£o */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            Login *
          </label>
          <input
            type="text"
            value={formData.userLogin}
            onChange={(e) => setFormData({ ...formData, userLogin: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            Senha *
          </label>
          <input
            type="password"
            value={formData.userPassword}
            onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>

        {/* BotÃµes */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(formData)}
            disabled={!formData.reasonId || !formData.userLogin || !formData.userPassword}
            className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            Confirmar Cancelamento
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 3. Modal de Justificativa de SLA

```typescript
// apps/web/src/components/SLAOverdueModal.tsx

interface SLAOverdueModalProps {
  reasons: Reason[];
  onConfirm: (reasonId: string, notes?: string) => Promise<void>;
  onClose: () => void;
}

const SLAOverdueModal: React.FC<SLAOverdueModalProps> = ({
  reasons,
  onConfirm,
  onClose
}) => {
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');

  // Filtrar apenas motivos de FORA_DO_PRAZO
  const overdueReasons = reasons.filter(r => r.rule === 'FORA_DO_PRAZO');

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-black text-amber-600 mb-4">
          â±ï¸ SLA Vencido
        </h3>
        
        <p className="text-sm text-slate-600 mb-6">
          O prazo desta aÃ§Ã£o foi ultrapassado. Informe o motivo do atraso.
        </p>

        {/* Motivo */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            Motivo do Atraso *
          </label>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          >
            <option value="">Selecione um motivo</option>
            {overdueReasons.map(reason => (
              <option key={reason.id} value={reason.id}>{reason.name}</option>
            ))}
          </select>
        </div>

        {/* ObservaÃ§Ãµes */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-600 mb-2">
            ObservaÃ§Ãµes (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            rows={3}
            placeholder="Detalhes adicionais..."
          />
        </div>

        {/* BotÃµes */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
          >
            Voltar
          </button>
          <button
            onClick={() => onConfirm(reasonId, notes)}
            disabled={!reasonId}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"
          >
            Confirmar e Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 4. Gerenciador de Motivos

```typescript
// apps/web/src/components/ReasonsManager.tsx

const ReasonsManager: React.FC = () => {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [filterRule, setFilterRule] = useState<ReasonRule | ''>('');
  const [editingReason, setEditingReason] = useState<Reason | null>(null);
  const [formData, setFormData] = useState({ name: '', rule: 'CANCELAMENTO' as ReasonRule });

  const reasonsQuery = trpc.reasons.list.useQuery({ rule: filterRule || undefined });
  const createMutation = trpc.reasons.create.useMutation();
  const updateMutation = trpc.reasons.update.useMutation();
  const deleteMutation = trpc.reasons.delete.useMutation();

  const getRuleBadge = (rule: ReasonRule) => {
    if (rule === 'CANCELAMENTO') {
      return <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded">Cancelamento</span>;
    }
    return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">Fora do Prazo</span>;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Cadastro de Motivos</h2>

      {/* FormulÃ¡rio */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-700 mb-4">
          {editingReason ? 'Editar Motivo' : 'Novo Motivo'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Nome do Motivo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Ex: Falta de insumos"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Regra Associada</label>
            <select
              value={formData.rule}
              onChange={(e) => setFormData({ ...formData, rule: e.target.value as ReasonRule })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="CANCELAMENTO">Cancelamento</option>
              <option value="FORA_DO_PRAZO">Fora do Prazo</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {editingReason && (
            <button
              onClick={() => { setEditingReason(null); setFormData({ name: '', rule: 'CANCELAMENTO' }); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => editingReason ? updateMutation.mutate({ ...formData, id: editingReason.id }) : createMutation.mutate(formData)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg font-bold"
          >
            {editingReason ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilterRule('')}
          className={`px-4 py-2 rounded-lg font-bold ${filterRule === '' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterRule('CANCELAMENTO')}
          className={`px-4 py-2 rounded-lg font-bold ${filterRule === 'CANCELAMENTO' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Cancelamento
        </button>
        <button
          onClick={() => setFilterRule('FORA_DO_PRAZO')}
          className={`px-4 py-2 rounded-lg font-bold ${filterRule === 'FORA_DO_PRAZO' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Fora do Prazo
        </button>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-black text-slate-600 uppercase">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Regra</th>
              <th className="px-4 py-3 text-right">AÃ§Ãµes</th>
            </tr>
          </thead>
          <tbody>
            {reasonsQuery.data?.map(reason => (
              <tr key={reason.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{reason.name}</td>
                <td className="px-4 py-3">{getRuleBadge(reason.rule)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { setEditingReason(reason); setFormData({ name: reason.name, rule: reason.rule }); }}
                    className="px-3 py-1 bg-sky-100 text-sky-700 rounded font-bold text-xs mr-2"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: reason.id })}
                    className="px-3 py-1 bg-rose-100 text-rose-700 rounded font-bold text-xs"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## Plano de VerificaÃ§Ã£o

### Testes Funcionais

1. **Cancelamento de AÃ§Ã£o**
   - [ ] Cancelar aÃ§Ã£o PENDENTE
   - [ ] Cancelar aÃ§Ã£o EM_ANDAMENTO
   - [ ] Verificar que CONCLUIDO nÃ£o pode ser cancelado
   - [ ] Verificar autenticaÃ§Ã£o (login/senha incorretos devem falhar)
   - [ ] Verificar que motivo Ã© obrigatÃ³rio

2. **LiberaÃ§Ã£o de DependÃªncias**
   - [ ] Criar aÃ§Ã£o A bloqueando aÃ§Ã£o B
   - [ ] Cancelar aÃ§Ã£o A
   - [ ] Verificar que aÃ§Ã£o B foi liberada (PENDENTE)

3. **SLA Vencido**
   - [ ] Criar aÃ§Ã£o com SLA de 1 minuto
   - [ ] Aguardar vencimento
   - [ ] Tentar concluir sem motivo (deve falhar)
   - [ ] Concluir com motivo (deve funcionar)

4. **CRUD de Motivos**
   - [ ] Criar motivo de CANCELAMENTO
   - [ ] Criar motivo de FORA_DO_PRAZO
   - [ ] Editar motivo
   - [ ] Excluir motivo
   - [ ] Filtrar por regra

5. **UI/UX**
   - [ ] Coluna CANCELADO aparece no Kanban
   - [ ] BotÃ£o "Cancelar AÃ§Ã£o" visÃ­vel no modal
   - [ ] Modal de cancelamento funcional
   - [ ] Modal de SLA funcional
   - [ ] Badges de regras visÃ­veis

---

## PrÃ³ximos Passos

1. âœ… Criar plano de implementaÃ§Ã£o
2. Solicitar aprovaÃ§Ã£o do usuÃ¡rio
3. Implementar backend (tipos, schema, migrations)
4. Implementar API (routers)
5. Implementar frontend (componentes)
6. Testes e validaÃ§Ã£o
7. DocumentaÃ§Ã£o
