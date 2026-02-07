# Implementação: Sistema de Gerenciamento de Itens e Estoque

## Checklist de Implementação

### Backend - Modelos e Tipos
- [ ] Criar interface `InventoryItem`
  - [ ] id, name, unitCost, contractId (opcional)
  - [ ] currentQuantity (opcional), consumption (auto), balance (auto)
  - [ ] isActive, companyId, createdAt, updatedAt
- [ ] Criar interface `Contract` (opcional)
  - [ ] id, name, supplier, startDate, endDate, companyId
- [ ] Criar interface `ItemConsumption`
  - [ ] id, itemId, orderId, quantity, approvedByUserId, approvedAt
- [ ] Atualizar `ComplementItem` para incluir `inventoryItemIds`
- [ ] Atualizar schema Prisma com novos modelos

### Backend - API (tRPC)
- [ ] Criar router `inventoryItems` com CRUD
  - [ ] `inventoryItems.list` - listar itens (filtro por ativo/inativo)
  - [ ] `inventoryItems.create` - criar novo item
  - [ ] `inventoryItems.update` - atualizar item
  - [ ] `inventoryItems.toggleActive` - ativar/desativar com verificação de impacto
    - [ ] Verificar insumos associados ao desativar
    - [ ] Retornar lista de insumos afetados
  - [ ] **REMOVER** `inventoryItems.delete` - itens não podem ser excluídos
- [ ] Criar router `contracts` (opcional)
  - [ ] `contracts.list` - listar contratos
  - [ ] `contracts.create` - criar contrato
  - [ ] `contracts.update` - atualizar contrato
  - [ ] `contracts.delete` - deletar contrato
- [ ] Atualizar router `complementItems`
  - [ ] Adicionar campo `inventoryItemIds` ao criar/editar
  - [ ] Calcular custo total (items + inventoryItems)
- [ ] Atualizar `orders.updateStatus` (CONCLUIDO)
  - [ ] Solicitar aprovação de consumo de itens
  - [ ] Registrar consumo aprovado
  - [ ] Atualizar saldo dos itens

### Backend - Lógica de Estoque
- [ ] Criar função `calculateItemBalance`
  - [ ] balance = currentQuantity - consumption
- [ ] Criar função `registerConsumption`
  - [ ] Registrar consumo aprovado
  - [ ] Atualizar consumption do item
  - [ ] Recalcular balance
- [ ] Criar validação de item ativo
  - [ ] Apenas itens ativos podem ser associados a **novos** insumos
  - [ ] Itens desativados mantêm associações históricas
- [ ] Implementar preservação de dados históricos
  - [ ] Garantir que ações mantêm referência aos itens mesmo após desativação
  - [ ] Impedir exclusão de itens (apenas desativação permitida)

### Frontend - Tipos
- [ ] Criar tipo `InventoryItem`
- [ ] Criar tipo `Contract`
- [ ] Criar tipo `ItemConsumption`
- [ ] Atualizar tipo `ComplementItem`

### Frontend - Cadastro de Itens
- [ ] Criar componente `InventoryItemsManager`
- [ ] Formulário de cadastro
  - [ ] Nome do item
  - [ ] Custo unitário
  - [ ] Contrato (dropdown, opcional)
  - [ ] Quantidade atual (opcional)
  - [ ] Status ativo/inativo (toggle)
- [ ] Listagem de itens
  - [ ] Filtro por status (ativo/inativo)
  - [ ] Exibir: nome, custo, contrato, quantidade, consumo, saldo
  - [ ] Badge visual para status
  - [ ] Ações: Editar, Ativar/Desativar
  - [ ] **REMOVER** botão Excluir - itens não podem ser excluídos
- [ ] Integrar no menu de Cadastros

### Frontend - Modal de Alerta de Desativação
- [ ] Criar componente `DeactivateItemWarningModal`
- [ ] Exibir ao tentar desativar item com insumos associados
- [ ] Mostrar impactos da desativação
  - [ ] Item não poderá ser usado em novos insumos
  - [ ] Ações futuras não poderão usar o item
  - [ ] Ações existentes manterão referência
- [ ] Listar insumos afetados
- [ ] Sugerir criação de item substituto
- [ ] Requerer confirmação obrigatória

### Frontend - Cadastro de Contratos (Opcional)
- [ ] Criar componente `ContractsManager`
- [ ] Formulário de cadastro
  - [ ] Nome do contrato
  - [ ] Fornecedor
  - [ ] Data início/fim
- [ ] Listagem de contratos
- [ ] Integrar no menu de Cadastros

### Frontend - Insumos/Extras
- [ ] Atualizar formulário de ComplementItem
  - [ ] Adicionar seção "Itens de Estoque"
  - [ ] Multi-select de itens (apenas ativos)
  - [ ] Exibir custo total (items + inventoryItems)
- [ ] Exibir itens associados na listagem

### Frontend - Conclusão de Ação
- [ ] Criar modal de aprovação de consumo
  - [ ] Listar todos os itens usados na ação
  - [ ] Checkbox para aprovar cada item
  - [ ] Quantidade consumida (editável)
  - [ ] Botão "Aprovar e Concluir"
- [ ] Integrar no fluxo de conclusão

### Testes
- [ ] Testar CRUD de itens
- [ ] Testar ativação/desativação
  - [ ] Testar modal de alerta ao desativar item com insumos
  - [ ] Verificar que itens desativados não aparecem em novos insumos
  - [ ] Verificar que ações históricas mantêm referência
- [ ] Testar associação com insumos
- [ ] Testar cálculo de custo total
- [ ] Testar aprovação de consumo
- [ ] Testar atualização de saldo
- [ ] Testar validação (apenas itens ativos para novos insumos)
- [ ] Testar cenário de mudança de contrato
  - [ ] Desativar item antigo
  - [ ] Criar item novo
  - [ ] Verificar integridade de dados históricos
- [ ] Verificar que exclusão de itens está bloqueada

### Documentação
- [ ] Atualizar `agent.md` com sistema de estoque
- [ ] Documentar fluxo de consumo
- [ ] Documentar cálculo de saldo
- [ ] Documentar regras de ativação
- [ ] Documentar preservação de dados históricos
- [ ] Documentar cenário de mudança de contrato
- [ ] Documentar modal de alerta de desativação
