# Implementação: Sistema de Cancelamento e Motivos

## Checklist de Implementação

### Backend - Modelos e Tipos
- [ ] Adicionar status `CANCELADO` ao tipo `OSStatus`
- [ ] Criar interface `ReasonRule` (CANCELAMENTO, FORA_DO_PRAZO)
- [ ] Criar interface `Reason` (id, name, rule, companyId)
- [ ] Criar interface `CancellationRecord` (orderId, userId, reasonId, timestamp, notes)
- [ ] Criar interface `SLAOverdueRecord` (orderId, userId, reasonId, timestamp, notes)
- [ ] Atualizar schema Prisma com novos modelos

### Backend - API (tRPC)
- [ ] Criar router `reasons` com CRUD
  - [ ] `reasons.list` - listar motivos por empresa
  - [ ] `reasons.create` - criar novo motivo
  - [ ] `reasons.update` - atualizar motivo
  - [ ] `reasons.delete` - deletar motivo
- [ ] Criar `orders.cancel` mutation
  - [ ] Validar autenticação do usuário
  - [ ] Registrar cancelamento com motivo
  - [ ] Atualizar status para CANCELADO
  - [ ] Liberar ordens dependentes
  - [ ] Criar audit log
- [ ] Atualizar `orders.updateStatus` para CONCLUIDO
  - [ ] Verificar SLA
  - [ ] Se fora do prazo, exigir motivo
  - [ ] Registrar motivo de atraso
- [ ] Criar `orders.validateUser` query para autenticação

### Backend - Lógica de Dependências
- [ ] Atualizar lógica de liberação de bloqueios
  - [ ] Ordem CANCELADA também libera dependentes
  - [ ] Marcar dependentes como PENDENTE quando bloqueador cancelado

### Frontend - Tipos
- [ ] Adicionar `CANCELADO` ao tipo `OSStatus`
- [ ] Criar tipo `ReasonRule`
- [ ] Criar tipo `Reason`
- [ ] Atualizar tipo `ServiceOrder` com campos de cancelamento

### Frontend - Kanban
- [ ] Adicionar coluna CANCELADO após CONCLUIDO
- [ ] Estilizar coluna (cor cinza/vermelho)
- [ ] Ícone apropriado (X, Ban, etc)
- [ ] Atualizar contadores

### Frontend - Modal de Ação
- [ ] Adicionar botão "Cancelar Ação"
  - [ ] Visível apenas para admin ou responsável
  - [ ] Não disponível se já CONCLUIDO ou CANCELADO
- [ ] Criar modal de confirmação de cancelamento
  - [ ] Campo de login
  - [ ] Campo de senha
  - [ ] Dropdown de motivos (filtrado por regra CANCELAMENTO)
  - [ ] Campo de observações (opcional)
- [ ] Implementar validação de usuário
- [ ] Chamar mutation `orders.cancel`

### Frontend - Conclusão com SLA
- [ ] Verificar SLA ao clicar "Finalizar Ação"
- [ ] Se fora do prazo, abrir modal de justificativa
  - [ ] Dropdown de motivos (filtrado por regra FORA_DO_PRAZO)
  - [ ] Campo de observações (opcional)
- [ ] Passar motivo para mutation `orders.updateStatus`

### Frontend - Cadastro de Motivos
- [ ] Criar componente `ReasonsManager`
- [ ] Formulário de cadastro
  - [ ] Campo: Nome do motivo
  - [ ] Campo: Regra (CANCELAMENTO, FORA_DO_PRAZO)
  - [ ] Indicador visual da regra
- [ ] Listagem de motivos
  - [ ] Filtro por regra
  - [ ] Badge visual para cada regra
  - [ ] Ações: Editar, Excluir
- [ ] Integrar no menu de Cadastros

### Testes
- [ ] Testar cancelamento de ação
- [ ] Testar liberação de dependências ao cancelar
- [ ] Testar autenticação no cancelamento
- [ ] Testar conclusão com SLA vencido
- [ ] Testar CRUD de motivos
- [ ] Testar filtros de motivos por regra

### Documentação
- [ ] Atualizar `agent.md` com novas features
- [ ] Documentar fluxo de cancelamento
- [ ] Documentar sistema de motivos
- [ ] Documentar regras e validações
