# Plano de Implementação: Cadastro de Seções e Melhorias na Página de Solicitação

**📅 Data de Execução**: 2026-02-05  
**✅ Status**: EXECUTADO

## Objetivo

Implementar sistema de cadastro de Seções e melhorar significativamente a UX da página de Solicitação com:
1. Cadastro de Seções (opcional) associadas a Setores
2. Exibição hierárquica: Setor > Seção > Leito
3. Select com busca (searchable)
4. Modal de confirmação pós-solicitação
5. Melhorias de labels e nomenclaturas

---

## Parte 1: Cadastro de Seções

### Análise de Requisitos

#### Regras de Negócio
- **Seção**: Entidade opcional que subdivide um Setor
- **Hierarquia**: Empresa > Unidade > Setor > **Seção** > Leito
- **Associação Leito-Seção**: Opcional (leito pode ou não ter seção)
- **Associação Leito-Setor**: Obrigatória (mantém regra existente)

#### Casos de Uso
1. **Setor com Seções**: UTI pode ter seções "UTI Adulto", "UTI Pediátrica"
2. **Setor sem Seções**: Pronto Socorro não precisa de subdivisões
3. **Leito com Seção**: Leito 101 pertence à seção "UTI Adulto" do setor "UTI"
4. **Leito sem Seção**: Leito PS01 pertence diretamente ao setor "Pronto Socorro"

---

### Estrutura de Dados

#### Novos Tipos

```typescript
// packages/types/index.ts

export interface Section {
  id: string;
  name: string;
  sectorId: string;
  sector?: Sector;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

// Atualizar Bed
export interface Bed {
  id: string;
  name: string;
  sectorId: string;
  sector?: Sector;
  sectionId?: string; // NOVO: opcional
  section?: Section;  // NOVO: opcional
  status: BedStatus;
}
```

#### Schema Prisma

```prisma
// apps/api/prisma/schema.prisma

model Section {
  id        String   @id @default(cuid())
  name      String
  sectorId  String
  sector    Sector   @relation(fields: [sectorId], references: [id], onDelete: Cascade)
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  
  beds      Bed[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([sectorId])
  @@index([companyId])
}

// Atualizar Bed
model Bed {
  id        String    @id @default(cuid())
  name      String
  sectorId  String
  sector    Sector    @relation(fields: [sectorId], references: [id])
  sectionId String?   // NOVO: opcional
  section   Section?  @relation(fields: [sectionId], references: [id]) // NOVO
  status    String
  
  // ... resto dos campos
  
  @@index([sectorId])
  @@index([sectionId]) // NOVO
}
```

---

### API (tRPC)

#### Router: `sections`

```typescript
// apps/api/src/routers/sections.ts

export const sectionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      sectorId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.section.findMany({
        where: {
          companyId: ctx.user.companyId,
          ...(input.sectorId && { sectorId: input.sectorId }),
        },
        include: {
          sector: true,
          _count: {
            select: { beds: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.section.create({
        data: {
          name: input.name,
          sectorId: input.sectorId,
          companyId: ctx.user.companyId,
        },
        include: {
          sector: true,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(2),
      sectorId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.section.update({
        where: { id: input.id },
        data: {
          name: input.name,
          sectorId: input.sectorId,
        },
        include: {
          sector: true,
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se há leitos associados
      const beds = await ctx.prisma.bed.count({
        where: { sectionId: input.id },
      });

      if (beds > 0) {
        throw new BusinessLogicError('Não é possível excluir seção com leitos associados');
      }

      await ctx.prisma.section.delete({
        where: { id: input.id },
      });
    }),
});
```

---

### Frontend: Gerenciador de Seções

```typescript
// apps/web/src/components/SectionsManager.tsx

const SectionsManager: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [filterSectorId, setFilterSectorId] = useState<string>('');
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sectorId: '',
  });

  const sectionsQuery = trpc.sections.list.useQuery({ sectorId: filterSectorId || undefined });
  const sectorsQuery = trpc.sectors.list.useQuery();
  const createMutation = trpc.sections.create.useMutation();
  const updateMutation = trpc.sections.update.useMutation();
  const deleteMutation = trpc.sections.delete.useMutation();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Gerenciamento de Seções</h2>

      {/* Formulário */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-700 mb-4">
          {editingSection ? 'Editar Seção' : 'Nova Seção'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Setor *</label>
            <select
              value={formData.sectorId}
              onChange={(e) => setFormData({ ...formData, sectorId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">Selecione um setor</option>
              {sectorsQuery.data?.map(sector => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Nome da Seção *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Ex: UTI Adulto"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {editingSection && (
            <button
              onClick={() => { setEditingSection(null); setFormData({ name: '', sectorId: '' }); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => editingSection ? updateMutation.mutate({ ...formData, id: editingSection.id }) : createMutation.mutate(formData)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg font-bold"
          >
            {editingSection ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-2">Filtrar por Setor</label>
        <select
          value={filterSectorId}
          onChange={(e) => setFilterSectorId(e.target.value)}
          className="w-64 px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="">Todos os setores</option>
          {sectorsQuery.data?.map(sector => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-black text-slate-600 uppercase">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Setor</th>
              <th className="px-4 py-3 text-center">Leitos</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sectionsQuery.data?.map(section => (
              <tr key={section.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-700">{section.name}</td>
                <td className="px-4 py-3 text-slate-600">{section.sector?.name}</td>
                <td className="px-4 py-3 text-center text-slate-600">{section._count?.beds || 0}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => { setEditingSection(section); setFormData({ name: section.name, sectorId: section.sectorId }); }}
                    className="px-3 py-1 bg-sky-100 text-sky-700 rounded font-bold text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: section.id })}
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

## Parte 2: Melhorias na Página de Solicitação

### Mudanças de Labels

**Antes** → **Depois**:
- "Nova Solicitação de Fluxo" → "Nova Solicitação"
- "Leito" → "Origem da Solicitação"
- "Serviço / Fluxo" → "Serviço"

---

### Select Hierárquico com Busca

#### Estrutura de Dados

```typescript
interface BedOption {
  value: string;
  label: string;
  sectorName: string;
  sectionName?: string;
  bedName: string;
  fullDisplay: string; // "SETOR - LEITO" ou "SETOR - SEÇÃO - LEITO"
}
```

#### Processamento de Dados

```typescript
const bedOptions = useMemo(() => {
  const options: BedOption[] = [];
  
  // Agrupar leitos por setor e seção
  const grouped = beds.reduce((acc, bed) => {
    const sectorId = bed.sectorId;
    const sectionId = bed.sectionId || 'no-section';
    
    if (!acc[sectorId]) acc[sectorId] = {};
    if (!acc[sectorId][sectionId]) acc[sectorId][sectionId] = [];
    
    acc[sectorId][sectionId].push(bed);
    return acc;
  }, {} as Record<string, Record<string, Bed[]>>);

  // Criar opções hierárquicas
  Object.entries(grouped).forEach(([sectorId, sections]) => {
    const sector = sectors.find(s => s.id === sectorId);
    
    Object.entries(sections).forEach(([sectionId, sectionBeds]) => {
      const section = sectionId !== 'no-section' 
        ? sectionsData.find(s => s.id === sectionId) 
        : null;
      
      sectionBeds.forEach(bed => {
        const fullDisplay = section
          ? `${sector?.name} - ${section.name} - ${bed.name}`
          : `${sector?.name} - ${bed.name}`;
        
        options.push({
          value: bed.id,
          label: bed.name,
          sectorName: sector?.name || '',
          sectionName: section?.name,
          bedName: bed.name,
          fullDisplay,
        });
      });
    });
  });

  // Ordenar: Setor > Seção > Leito
  return options.sort((a, b) => {
    if (a.sectorName !== b.sectorName) return a.sectorName.localeCompare(b.sectorName);
    if (a.sectionName && b.sectionName && a.sectionName !== b.sectionName) {
      return a.sectionName.localeCompare(b.sectionName);
    }
    return a.bedName.localeCompare(b.bedName);
  });
}, [beds, sectors, sectionsData]);
```

#### Componente com React-Select

```typescript
import Select from 'react-select';

<div>
  <label className="block text-sm font-semibold text-slate-700 mb-2">
    Origem da Solicitação
  </label>
  <Select
    options={bedOptions}
    value={bedOptions.find(opt => opt.value === selectedBedId)}
    onChange={(option) => setSelectedBedId(option?.value || '')}
    placeholder="Pesquise ou selecione a origem..."
    isClearable
    isSearchable
    formatOptionLabel={(option) => (
      <div>
        <div className="font-bold text-slate-800">{option.fullDisplay}</div>
        <div className="text-xs text-slate-500">
          {option.sectionName 
            ? `Setor: ${option.sectorName} | Seção: ${option.sectionName}`
            : `Setor: ${option.sectorName}`
          }
        </div>
      </div>
    )}
    styles={{
      control: (base) => ({
        ...base,
        padding: '8px',
        borderRadius: '12px',
        borderColor: '#e2e8f0',
      }),
    }}
  />
</div>
```

---

### Modal de Confirmação

```typescript
// apps/web/src/components/OrderConfirmationModal.tsx

interface OrderConfirmationModalProps {
  orderData: {
    groupId: string;
    bedName: string;
    serviceName: string;
    actions: {
      id: string;
      name: string;
      step: number;
      dependencies?: string[];
    }[];
  };
  onClose: () => void;
}

const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  orderData,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mb-2">
            ✅ Solicitação Criada com Sucesso!
          </h3>
          <p className="text-sm text-slate-600">
            Número da Solicitação: <span className="font-black text-slate-800">#{orderData.groupId.slice(-8)}</span>
          </p>
        </div>

        {/* Dados da Solicitação */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            Dados da Solicitação
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Origem</p>
              <p className="font-bold text-slate-800">{orderData.bedName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Serviço</p>
              <p className="font-bold text-slate-800">{orderData.serviceName}</p>
            </div>
          </div>
        </div>

        {/* Ações Criadas */}
        <div className="mb-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            Ações Criadas ({orderData.actions.length})
          </h4>
          <div className="space-y-2">
            {orderData.actions.map((action, idx) => (
              <div key={action.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="w-8 h-8 bg-sky-500 text-white rounded-full flex items-center justify-center font-black text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{action.name}</p>
                  {action.dependencies && action.dependencies.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Bloqueada por {action.dependencies.length} ação(ões)
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400">#{action.id.slice(-6)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 transition-colors"
        >
          Fechar e Criar Nova Solicitação
        </button>
      </div>
    </div>
  );
};
```

---

### Atualização do ServiceRequestForm

```typescript
// apps/web/src/components/ServiceRequestForm.tsx

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({
  beds,
  services,
  currentUser,
  steps = [],
  onSuccess
}) => {
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<any>(null);

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      // Armazenar dados da ordem criada
      setLastCreatedOrder(data);
      
      // Exibir modal de confirmação
      setShowConfirmationModal(true);
      
      // Limpar formulário
      setSelectedBedId('');
      setSelectedServiceId('');
      setNotes('');
      setSelectedItemsPerStep({});
      
      // Chamar callback de sucesso
      onSuccess();
    },
    onError: (error) => {
      alert(`Erro ao criar solicitação: ${error.message}`);
    },
  });

  return (
    <>
      <div className="max-w-4xl mx-auto py-4 md:py-6 lg:py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-sky-100 text-sky-600 rounded-lg">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Nova Solicitação</h3>
              <p className="text-slate-500 text-sm">Escolha quais ações incluir e selecione 1 insumo por ação.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* ... resto do formulário com labels atualizados ... */}
        </form>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmationModal && lastCreatedOrder && (
        <OrderConfirmationModal
          orderData={lastCreatedOrder}
          onClose={() => setShowConfirmationModal(false)}
        />
      )}
    </>
  );
};
```

---

## Plano de Verificação

### Testes Manuais

1. **Cadastro de Seções**
   - [ ] Criar seção em setor
   - [ ] Editar seção
   - [ ] Excluir seção vazia
   - [ ] Tentar excluir seção com leitos (deve falhar)

2. **Associação Leito-Seção**
   - [ ] Criar leito com seção
   - [ ] Criar leito sem seção
   - [ ] Editar leito e adicionar seção
   - [ ] Editar leito e remover seção

3. **Exibição Hierárquica**
   - [ ] Verificar ordenação: Setor > Seção > Leito
   - [ ] Verificar formato: "SETOR - LEITO" ou "SETOR - SEÇÃO - LEITO"
   - [ ] Verificar agrupamento visual

4. **Select com Busca**
   - [ ] Digitar nome do leito
   - [ ] Digitar nome do setor
   - [ ] Digitar nome da seção
   - [ ] Verificar filtragem em tempo real

5. **Modal de Confirmação**
   - [ ] Criar solicitação simples
   - [ ] Criar solicitação com dependências
   - [ ] Verificar exibição de dados
   - [ ] Fechar modal e verificar permanência na página
   - [ ] Criar nova solicitação após confirmação

---

## Estimativa

- **Parte 1 (Seções)**: 4-6 horas
- **Parte 2 (Melhorias Solicitação)**: 6-8 horas
- **Testes**: 2 horas

**Total**: 12-16 horas
