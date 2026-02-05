# Normalização de Banco de Dados - Histórico e Dependências

**Data:** 02/02/2026
**Objetivo:** Normalizar o histórico e as dependências das Ordens de Serviço, movendo-os de campos JSON/Array para tabelas relacionais dedicadas (`OrderHistory` e `OrderDependency`).

## Plano de Implementação

### Mudanças no Schema do Banco de Dados (`packages/database/prisma/schema.prisma`)

#### [NOVO] Tabela `OrderHistory`
- Armazena eventos históricos para cada ordem de serviço.
- Campos: `id`, `orderId`, `status` (Enum), `note`, `timestamp`, `createdAt`.
- Relação: Many-to-One com `ServiceOrder`.

#### [NOVO] Tabela `OrderDependency`
- Armazena dependências entre ordens (Bloqueadora -> Bloqueada).
- Campos: `id`, `orderId` (Bloqueada/Dependente), `dependsOnId` (Bloqueadora/Principal), `type` (String/Enum), `createdAt`.
- Relações: 
  - `order` (Relação com a ordem bloqueada)
  - `dependsOn` (Relação com a ordem bloqueadora)

#### [MODIFICAR] Modelo `ServiceOrder`
- Adicionar relações para `OrderHistory` e `OrderDependency`.
- Deprecar campos `history` (Json) e `dependsOnOrderIds` (String[]).

### Backend (`apps/api`)

#### [MODIFICAR] `routers/orders.ts`
- Atualizar mutation `create` para salvar dependências na tabela `OrderDependency`.
- Atualizar mutation `updateStatus` para escrever na tabela `OrderHistory` ao invés de dar push no JSON.
- Atualizar validações de bloqueio para consultar a nova tabela.

### Frontend (`apps/web`)

#### [MODIFICAR] `ServiceRequestForm.tsx`
- Atualizar a lógica de envio de dependências se necessário.

#### [MODIFICAR] Dashboards e Listas
- `ActionsList.tsx`
- `Dashboard.tsx`
- `DashboardOperacional.tsx`
- `ServiceOrdersKanban.tsx`
- Atualizar o acesso ao histórico para usar a nova estrutura relacional (via include no tRPC ou nova query).

## Checklist de Tarefas

- [ ] Modificar Schema Prisma
    - [ ] Criar modelo `OrderHistory`
    - [ ] Criar modelo `OrderDependency`
    - [ ] Atualizar relações em `ServiceOrder`
    - [ ] Executar migration/db push
- [ ] Atualizar Lógica Backend
    - [ ] Atualizar `orders.create` para usar `OrderDependency`
    - [ ] Atualizar `orders.updateStatus` para usar `OrderHistory`
    - [ ] Atualizar `orders.assign` / `unassign` para usar `OrderHistory`
    - [ ] Atualizar `orders.list` para incluir relações necessárias
- [ ] Atualizar Frontend
    - [ ] Atualizar `ActionsList.tsx` (lógica de histórico)
    - [ ] Atualizar `Dashboard.tsx` (lógica de histórico)
    - [ ] Atualizar `DashboardOperacional.tsx` (lógica de histórico)
    - [ ] Atualizar `ServiceOrdersKanban.tsx` (lógica de histórico)
- [ ] Verificação
    - [ ] Verificar criação de ordem com dependência
    - [ ] Verificar atualização de status e gravação de histórico
