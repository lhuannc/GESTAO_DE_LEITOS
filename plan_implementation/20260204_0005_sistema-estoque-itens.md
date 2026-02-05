# Plano de Implementação: Sistema de Gerenciamento de Itens e Estoque

## Objetivo

Implementar sistema completo de gerenciamento de itens de estoque com:
1. Cadastro de itens com controle de ativação/desativação
2. Associação de itens com contratos (opcional)
3. Controle de quantidade, consumo e saldo
4. Associação de itens com insumos/extras
5. Aprovação de consumo na conclusão de ações

---

## Análise de Requisitos

### Funcionalidades Principais

#### 1. Cadastro de Itens
- **Campos do Item:**
  - Nome
  - Custo unitário
  - Contrato (opcional)
  - Quantidade atual (opcional)
  - Consumo (calculado automaticamente)
  - Saldo (calculado automaticamente: quantidade - consumo)
  - Status: Ativado/Desativado

#### 2. Regras de Ativação e Integridade de Dados
- **Item Ativado**: Pode ser associado a novos insumos
- **Item Desativado**: 
  - Não pode ser associado a **novos** insumos
  - Mantém associações históricas (ações já criadas)
  - Exibe modal de alerta ao desativar se houver insumos associados
- **Exclusão de Itens**: **PROIBIDA** - itens só podem ser desativados
- **Integridade Histórica**: Ações mantêm referência aos itens mesmo após desativação

#### 3. Associação com Insumos
- Insumos podem ter múltiplos itens associados
- Custo total do insumo = custo base + soma dos custos dos itens
- Apenas itens ativos podem ser selecionados

#### 4. Controle de Consumo
- Consumo registrado ao concluir ação
- Requer aprovação do usuário
- Atualiza automaticamente o saldo do item
- Histórico de consumo por ação

#### 5. Contratos (Opcional)
- Associar itens a contratos
- Informações: fornecedor, período de vigência
- Facilita gestão de compras

#### 6. Modal de Alerta de Desativação
- **Quando exibir**: Ao tentar desativar item que está associado a insumos
- **Conteúdo do modal**:
  - Aviso sobre impactos da desativação
  - Lista de insumos afetados
  - Sugestão para criar novo item substituto
  - Confirmação obrigatória
- **Comportamento**: 
  - Ações futuras não poderão usar o item desativado
  - Ações existentes mantêm referência histórica

#### 7. Preservação de Dados Históricos
- **Regra Fundamental**: Itens **NUNCA** podem ser excluídos, apenas desativados
- **Motivo**: Preservar integridade de dados históricos e rastreabilidade
- **Cenário de Mudança de Contrato**:
  1. Desativar item do contrato antigo
  2. Criar novo item para o novo contrato
  3. Associar novo item aos insumos
  4. Item antigo permanece vinculado às ações históricas

---

## Estrutura de Dados

### Novos Tipos

```typescript
// packages/types/index.ts

export interface Contract {
  id: string;
  name: string;
  supplier: string;
  startDate: string;
  endDate: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unitCost: number;
  contractId?: string;
  contract?: Contract;
  currentQuantity?: number;
  consumption: number; // Calculado automaticamente
  balance: number; // Calculado: currentQuantity - consumption
  isActive: boolean;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemConsumption {
  id: string;
  itemId: string;
  item?: InventoryItem;
  orderId: string;
  order?: ServiceOrder;
  quantity: number;
  approvedByUserId: string;
  approvedBy?: User;
  approvedAt: string;
  createdAt: string;
}

// Atualizar ComplementItem
export interface ComplementItem {
  id: string;
  name: string;
  unitCost: number;
  companyId: string;
  inventoryItemIds?: string[]; // NOVO: IDs dos itens de estoque
  inventoryItems?: InventoryItem[]; // NOVO: Itens populados
}
```

### Schema Prisma

```prisma
// apps/api/prisma/schema.prisma

model Contract {
  id        String   @id @default(cuid())
  name      String
  supplier  String
  startDate DateTime
  endDate   DateTime
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  
  items InventoryItem[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([companyId])
}

model InventoryItem {
  id              String   @id @default(cuid())
  name            String
  unitCost        Float
  contractId      String?
  contract        Contract? @relation(fields: [contractId], references: [id])
  currentQuantity Float?
  consumption     Float     @default(0) // Soma de todos os consumos
  balance         Float     @default(0) // currentQuantity - consumption
  isActive        Boolean   @default(true)
  companyId       String
  company         Company   @relation(fields: [companyId], references: [id])
  
  consumptions    ItemConsumption[]
  complementItems ComplementItem[]  @relation("InventoryItemToComplementItem")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([companyId])
  @@index([isActive])
  @@index([contractId])
}

model ItemConsumption {
  id              String   @id @default(cuid())
  itemId          String
  item            InventoryItem @relation(fields: [itemId], references: [id])
  orderId         String
  order           ServiceOrder  @relation(fields: [orderId], references: [id])
  quantity        Float
  approvedByUserId String
  approvedBy      User      @relation(fields: [approvedByUserId], references: [id])
  approvedAt      DateTime
  
  createdAt DateTime @default(now())
  
  @@index([itemId])
  @@index([orderId])
  @@index([approvedByUserId])
}

// Atualizar ComplementItem
model ComplementItem {
  id              String   @id @default(cuid())
  name            String
  unitCost        Float
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  
  inventoryItems  InventoryItem[] @relation("InventoryItemToComplementItem")
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([companyId])
}
```

---

## API (tRPC)

### Router: `inventoryItems`

```typescript
// apps/api/src/routers/inventoryItems.ts

export const inventoryItemsRouter = router({
  list: protectedProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.inventoryItem.findMany({
        where: {
          companyId: ctx.user.companyId,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        include: {
          contract: true,
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3),
      unitCost: z.number().min(0),
      contractId: z.string().optional(),
      currentQuantity: z.number().min(0).optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const balance = input.currentQuantity || 0;
      
      return await ctx.prisma.inventoryItem.create({
        data: {
          name: input.name,
          unitCost: input.unitCost,
          contractId: input.contractId,
          currentQuantity: input.currentQuantity,
          consumption: 0,
          balance,
          isActive: input.isActive,
          companyId: ctx.user.companyId,
        },
        include: {
          contract: true,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3),
      unitCost: z.number().min(0),
      contractId: z.string().optional(),
      currentQuantity: z.number().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inventoryItem.findUnique({
        where: { id: input.id },
      });
      
      if (!item) {
        throw new NotFoundError('Item', input.id);
      }

      const balance = (input.currentQuantity || 0) - item.consumption;

      return await ctx.prisma.inventoryItem.update({
        where: { id: input.id },
        data: {
          name: input.name,
          unitCost: input.unitCost,
          contractId: input.contractId,
          currentQuantity: input.currentQuantity,
          balance,
        },
        include: {
          contract: true,
        },
      });
    }),

  toggleActive: protectedProcedure
    .input(z.object({
      id: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Se está desativando, verificar impactos
      if (!input.isActive) {
        const item = await ctx.prisma.inventoryItem.findUnique({
          where: { id: input.id },
          include: {
            complementItems: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!item) {
          throw new NotFoundError('Item', input.id);
        }

        // Se há insumos associados, retornar informação de impacto
        if (item.complementItems.length > 0) {
          return {
            success: false,
            requiresConfirmation: true,
            affectedSupplies: item.complementItems,
            message: 'Este item está associado a insumos. Desativá-lo impedirá seu uso em novas ações.',
          };
        }
      }

      // Desativar item
      const updated = await ctx.prisma.inventoryItem.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });

      return {
        success: true,
        requiresConfirmation: false,
        item: updated,
      };
    }),

  // REMOVER mutation delete - itens não podem ser excluídos
  // delete: adminProcedure... (REMOVIDO)

  getConsumptionHistory: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.itemConsumption.findMany({
        where: { itemId: input.itemId },
        include: {
          order: true,
          approvedBy: true,
        },
        orderBy: { approvedAt: 'desc' },
      });
    }),
});
```

### Router: `contracts`

```typescript
// apps/api/src/routers/contracts.ts

export const contractsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.prisma.contract.findMany({
        where: { companyId: ctx.user.companyId },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3),
      supplier: z.string().min(3),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.contract.create({
        data: {
          name: input.name,
          supplier: input.supplier,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          companyId: ctx.user.companyId,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3),
      supplier: z.string().min(3),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.contract.update({
        where: { id: input.id },
        data: {
          name: input.name,
          supplier: input.supplier,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se há itens associados
      const items = await ctx.prisma.inventoryItem.count({
        where: { contractId: input.id },
      });

      if (items > 0) {
        throw new BusinessLogicError('Não é possível excluir contrato com itens associados');
      }

      await ctx.prisma.contract.delete({
        where: { id: input.id },
      });
    }),
});
```

### Atualizar Router: `complementItems`

```typescript
// apps/api/src/routers/complementItems.ts

export const complementItemsRouter = router({
  // ... rotas existentes

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3),
      unitCost: z.number().min(0),
      inventoryItemIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validar que itens estão ativos
      if (input.inventoryItemIds && input.inventoryItemIds.length > 0) {
        const items = await ctx.prisma.inventoryItem.findMany({
          where: {
            id: { in: input.inventoryItemIds },
            isActive: true,
          },
        });

        if (items.length !== input.inventoryItemIds.length) {
          throw new BusinessLogicError('Alguns itens selecionados estão inativos');
        }
      }

      return await ctx.prisma.complementItem.create({
        data: {
          name: input.name,
          unitCost: input.unitCost,
          companyId: ctx.user.companyId,
          inventoryItems: input.inventoryItemIds
            ? { connect: input.inventoryItemIds.map(id => ({ id })) }
            : undefined,
        },
        include: {
          inventoryItems: true,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3),
      unitCost: z.number().min(0),
      inventoryItemIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validar que itens estão ativos
      if (input.inventoryItemIds && input.inventoryItemIds.length > 0) {
        const items = await ctx.prisma.inventoryItem.findMany({
          where: {
            id: { in: input.inventoryItemIds },
            isActive: true,
          },
        });

        if (items.length !== input.inventoryItemIds.length) {
          throw new BusinessLogicError('Alguns itens selecionados estão inativos');
        }
      }

      return await ctx.prisma.complementItem.update({
        where: { id: input.id },
        data: {
          name: input.name,
          unitCost: input.unitCost,
          inventoryItems: {
            set: [], // Desconectar todos
            connect: input.inventoryItemIds?.map(id => ({ id })) || [],
          },
        },
        include: {
          inventoryItems: true,
        },
      });
    }),
});
```

### Atualizar Router: `orders`

```typescript
// apps/api/src/routers/orders.ts

export const ordersRouter = router({
  // ... rotas existentes

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO']),
      itemConsumptions: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().min(0),
      })).optional(),
      // ... outros campos
    }))
    .mutation(async ({ ctx, input }) => {
      // ... validações existentes

      // Se CONCLUIDO e há consumo de itens
      if (input.status === 'CONCLUIDO' && input.itemConsumptions) {
        // Registrar consumos
        for (const consumption of input.itemConsumptions) {
          await ctx.prisma.itemConsumption.create({
            data: {
              itemId: consumption.itemId,
              orderId: input.id,
              quantity: consumption.quantity,
              approvedByUserId: ctx.user.id,
              approvedAt: new Date(),
            },
          });

          // Atualizar consumo e saldo do item
          const item = await ctx.prisma.inventoryItem.findUnique({
            where: { id: consumption.itemId },
          });

          if (item) {
            const newConsumption = item.consumption + consumption.quantity;
            const newBalance = (item.currentQuantity || 0) - newConsumption;

            await ctx.prisma.inventoryItem.update({
              where: { id: consumption.itemId },
              data: {
                consumption: newConsumption,
                balance: newBalance,
              },
            });
          }
        }
      }

      // ... resto da lógica existente
    }),
});
```

---

## Frontend

### 1. Gerenciador de Itens

```typescript
// apps/web/src/components/InventoryItemsManager.tsx

const InventoryItemsManager: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unitCost: 0,
    contractId: '',
    currentQuantity: 0,
    isActive: true,
  });

  const itemsQuery = trpc.inventoryItems.list.useQuery({ isActive: filterActive });
  const contractsQuery = trpc.contracts.list.useQuery();
  const createMutation = trpc.inventoryItems.create.useMutation();
  const updateMutation = trpc.inventoryItems.update.useMutation();
  const toggleActiveMutation = trpc.inventoryItems.toggleActive.useMutation();
  const deleteMutation = trpc.inventoryItems.delete.useMutation();

  const getTotalCost = (item: InventoryItem) => {
    return item.unitCost * (item.currentQuantity || 0);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Gerenciamento de Itens</h2>

      {/* Formulário */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-700 mb-4">
          {editingItem ? 'Editar Item' : 'Novo Item'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Nome do Item *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Ex: Luvas de procedimento"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Custo Unitário *</label>
            <input
              type="number"
              step="0.01"
              value={formData.unitCost}
              onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Contrato (opcional)</label>
            <select
              value={formData.contractId}
              onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">Nenhum</option>
              {contractsQuery.data?.map(contract => (
                <option key={contract.id} value={contract.id}>
                  {contract.name} - {contract.supplier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Quantidade Atual (opcional)</label>
            <input
              type="number"
              step="0.01"
              value={formData.currentQuantity}
              onChange={(e) => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5"
            />
            <label htmlFor="isActive" className="text-sm font-bold text-slate-700">
              Item Ativo (pode ser associado a insumos)
            </label>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {editingItem && (
            <button
              onClick={() => { setEditingItem(null); setFormData({ name: '', unitCost: 0, contractId: '', currentQuantity: 0, isActive: true }); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => editingItem ? updateMutation.mutate({ ...formData, id: editingItem.id }) : createMutation.mutate(formData)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg font-bold"
          >
            {editingItem ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <button
          onClick={() => setFilterActive(undefined)}
          className={`px-4 py-2 rounded-lg font-bold ${filterActive === undefined ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilterActive(true)}
          className={`px-4 py-2 rounded-lg font-bold ${filterActive === true ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Ativos
        </button>
        <button
          onClick={() => setFilterActive(false)}
          className={`px-4 py-2 rounded-lg font-bold ${filterActive === false ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}
        >
          Inativos
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-black text-slate-600 uppercase">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-right">Custo Unit.</th>
              <th className="px-4 py-3 text-left">Contrato</th>
              <th className="px-4 py-3 text-right">Qtd. Atual</th>
              <th className="px-4 py-3 text-right">Consumo</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itemsQuery.data?.map(item => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{item.name}</td>
                <td className="px-4 py-3 text-right text-slate-600">R$ {item.unitCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-600">{item.contract?.name || '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{item.currentQuantity?.toFixed(2) || '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{item.consumption.toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-bold ${item.balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {item.balance.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.isActive ? (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">Ativo</span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">Inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => { setEditingItem(item); setFormData({ name: item.name, unitCost: item.unitCost, contractId: item.contractId || '', currentQuantity: item.currentQuantity || 0, isActive: item.isActive }); }}
                    className="px-3 py-1 bg-sky-100 text-sky-700 rounded font-bold text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`px-3 py-1 rounded font-bold text-xs ${item.isActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {item.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  {/* Botão Excluir REMOVIDO - itens não podem ser excluídos */}
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

### 2. Modal de Alerta de Desativação

```typescript
// apps/web/src/components/DeactivateItemWarningModal.tsx

interface DeactivateItemWarningModalProps {
  item: InventoryItem;
  affectedSupplies: { id: string; name: string }[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const DeactivateItemWarningModal: React.FC<DeactivateItemWarningModalProps> = ({
  item,
  affectedSupplies,
  onConfirm,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6">
        <h3 className="text-xl font-black text-amber-600 mb-4">
          ⚠️ Atenção: Desativar Item
        </h3>
        
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
          <p className="text-sm font-bold text-amber-800 mb-2">
            Impactos da Desativação
          </p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li>Este item <strong>não poderá</strong> ser associado a novos insumos</li>
            <li>Ações futuras <strong>não poderão</strong> usar este item</li>
            <li>Ações existentes <strong>manterão</strong> a referência histórica</li>
          </ul>
        </div>

        <div className="mb-6">
          <p className="text-sm font-bold text-slate-700 mb-3">
            Item a ser desativado:
          </p>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="font-bold text-slate-800">{item.name}</p>
            <p className="text-xs text-slate-500">Custo: R$ {item.unitCost.toFixed(2)}</p>
          </div>
        </div>

        {affectedSupplies.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-bold text-slate-700 mb-3">
              Insumos que usam este item ({affectedSupplies.length}):
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {affectedSupplies.map(supply => (
                <div key={supply.id} className="bg-rose-50 p-2 rounded border border-rose-200">
                  <p className="text-sm font-bold text-rose-700">{supply.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-sky-50 border-l-4 border-sky-500 p-4 mb-6">
          <p className="text-sm font-bold text-sky-800 mb-1">
            💡 Recomendação
          </p>
          <p className="text-sm text-sky-700">
            Crie um novo item para substituir este antes de desativá-lo. Isso facilita a transição para novos contratos ou fornecedores.
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold"
          >
            Confirmar Desativação
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 3. Modal de Aprovação de Consumo


```typescript
// apps/web/src/components/ApproveConsumptionModal.tsx

interface ApproveConsumptionModalProps {
  order: ServiceOrder;
  items: InventoryItem[];
  onConfirm: (consumptions: { itemId: string; quantity: number }[]) => Promise<void>;
  onClose: () => void;
}

const ApproveConsumptionModal: React.FC<ApproveConsumptionModalProps> = ({
  order,
  items,
  onConfirm,
  onClose
}) => {
  const [consumptions, setConsumptions] = useState<Record<string, number>>({});

  // Inicializar com quantidade padrão (1 para cada item)
  useEffect(() => {
    const initial: Record<string, number> = {};
    items.forEach(item => {
      initial[item.id] = 1;
    });
    setConsumptions(initial);
  }, [items]);

  const handleConfirm = () => {
    const data = Object.entries(consumptions)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    
    onConfirm(data);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
        <h3 className="text-xl font-black text-sky-600 mb-4">
          ✅ Aprovar Consumo de Itens
        </h3>
        
        <p className="text-sm text-slate-600 mb-6">
          Confirme a quantidade consumida de cada item nesta ação.
        </p>

        {/* Lista de Itens */}
        <div className="space-y-3 mb-6">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <p className="font-bold text-slate-700">{item.name}</p>
                <p className="text-xs text-slate-500">
                  Custo unitário: R$ {item.unitCost.toFixed(2)} | 
                  Saldo disponível: {item.balance.toFixed(2)}
                </p>
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold text-slate-600 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={consumptions[item.id] || 0}
                  onChange={(e) => setConsumptions({ ...consumptions, [item.id]: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="bg-sky-50 p-4 rounded-lg mb-6">
          <p className="text-sm font-bold text-sky-700">
            Total de itens: {Object.values(consumptions).filter(q => q > 0).length}
          </p>
          <p className="text-sm font-bold text-sky-700">
            Custo total: R$ {items.reduce((sum, item) => sum + (item.unitCost * (consumptions[item.id] || 0)), 0).toFixed(2)}
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold"
          >
            Aprovar e Concluir Ação
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## Plano de Verificação

### Testes Funcionais

1. **CRUD de Itens**
   - [ ] Criar item com todos os campos
   - [ ] Criar item sem contrato
   - [ ] Criar item sem quantidade
   - [ ] Editar item
   - [ ] Excluir item sem consumo
   - [ ] Tentar excluir item com consumo (deve falhar)

2. **Ativação/Desativação**
   - [ ] Desativar item
   - [ ] Verificar que item inativo não aparece em seleção de insumos
   - [ ] Ativar item novamente

3. **Associação com Insumos**
   - [ ] Criar insumo com itens associados
   - [ ] Verificar cálculo de custo total
   - [ ] Tentar associar item inativo (deve falhar)
   - [ ] Editar insumo e mudar itens

4. **Consumo e Saldo**
   - [ ] Concluir ação com consumo de itens
   - [ ] Verificar atualização de consumo
   - [ ] Verificar atualização de saldo
   - [ ] Verificar histórico de consumo

5. **Contratos**
   - [ ] Criar contrato
   - [ ] Associar item a contrato
   - [ ] Tentar excluir contrato com itens (deve falhar)
   - [ ] Editar contrato

---

## Próximos Passos

1. ✅ Criar plano de implementação
2. Solicitar aprovação do usuário
3. Implementar backend (tipos, schema, migrations)
4. Implementar API (routers)
5. Implementar frontend (componentes)
6. Testes e validação
7. Documentação
