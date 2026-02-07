# Diretrizes da Pasta Plans

Esta pasta serve como o diário de engenharia e registro de decisões técnicas do projeto. Aqui são armazenados todos os planos de implementação e checklists de execução.

## Regras de Registro

1. **Nomenclatura de Arquivos**:
   - Use o formato: `YYYYMMDD_HHMM_breve-descricao.md`
   - Exemplo: `20260130_0001_implementacao-fluxo-servico.md`

2. **Conteúdo Obrigatório**:
   Todo arquivo de plano deve conter:
   - **Objetivo**: Breve descrição do que está sendo resolvido.
   - **Mudanças Propostas**: Detalhamento técnico do que será alterado (Backend, Frontend, Banco de Dados).
   - **Checklist de Tarefas**: Uma lista de itens a serem executados, utilizando a sintaxe de markdown `[ ]`, `[/]` e `[x]`.

3. **Manutenção**:
   - Ao iniciar uma nova tarefa complexa, crie um novo arquivo nesta pasta.
   - Atualize o status das tarefas no arquivo conforme o progresso.

## Objetivo
Centralizar o conhecimento e o histórico de mudanças, facilitando a continuidade do trabalho por diferentes agentes ou em diferentes sessões.

---

## Funcionalidades Implementadas

### Sistema de Cancelamento e Motivos (2026-02-05)

#### Visão Geral
Sistema completo para cancelamento de ações com autenticação, rastreamento de motivos e liberação automática de dependências. Inclui também validação de SLA ao concluir ações.

#### Database Schema

**Novos Enums:**
- `ReasonRule`: CANCELAMENTO, FORA_DO_PRAZO

**Novos Models:**
- `Reason`: Cadastro de motivos com regras associadas
  - Campos: id, name, rule, companyId, createdAt, updatedAt
  - Relações: cancellationRecords, slaOverdueRecords

- `CancellationRecord`: Registro de cancelamentos
  - Campos: id, orderId, userId, reasonId, notes, createdAt
  - Relações: order, user, reason

- `SLAOverdueRecord`: Registro de justificativas de atraso
  - Campos: id, orderId, userId, reasonId, notes, createdAt
  - Relações: order, user, reason

**Atualizações em ServiceOrder:**
- `cancelledAt`: DateTime? - Data/hora do cancelamento
- `cancelledByUserId`: String? - ID do usuário que cancelou
- Relações: cancelledBy, cancellationRecords, slaOverdueRecords

**Atualizações em User:**
- Relações: cancelledOrders, cancellationRecords, slaOverdueRecords

#### API Endpoints (tRPC)

**reasons Router:**
- `reasons.list`: Lista motivos com filtro opcional por regra
- `reasons.create`: Cria novo motivo (admin only)
- `reasons.update`: Atualiza motivo existente (admin only)
- `reasons.delete`: Remove motivo (admin only, valida uso)

**orders Router - Novas Funcionalidades:**
- `orders.cancel`: Cancela ordem com autenticação
  - Valida credenciais do usuário (login/senha)
  - Verifica se ordem pode ser cancelada
  - Cria registro de cancelamento
  - Libera dependências automaticamente
  - Cria audit log

- `orders.updateStatus`: Atualizado com validação de SLA
  - Verifica SLA ao concluir (status CONCLUIDO)
  - Exige motivo se SLA vencido
  - Cria registro de SLA overdue quando aplicável

**Helper Functions:**
- `checkDependencies`: Verifica se dependências estão satisfeitas (CONCLUIDO ou CANCELADO)
- `releaseDependencies`: Libera ordens dependentes quando bloqueador é concluído/cancelado
- `checkSLAViolation`: Verifica se SLA da etapa foi violado

#### Regras de Negócio

1. **Cancelamento de Ações:**
   - Requer autenticação com login e senha
   - Não pode cancelar ações já CONCLUIDAS ou CANCELADAS
   - Motivo de cancelamento é obrigatório
   - Motivo deve ter regra CANCELAMENTO
   - Libera automaticamente ações dependentes

2. **Liberação de Dependências:**
   - Ações CANCELADAS liberam dependências (igual a CONCLUIDAS)
   - Dependentes são marcados como PENDENTE quando liberados
   - Verifica todas as dependências antes de liberar

3. **Validação de SLA:**
   - Ao concluir ação, verifica se SLA foi respeitado
   - Se SLA vencido, exige motivo com regra FORA_DO_PRAZO
   - Cria registro de SLA overdue para auditoria

4. **Status de Ordem:**
   - BLOQUEADO: Aguardando dependências
   - PENDENTE: Pronta para execução
   - EM_ANDAMENTO: Em execução
   - CONCLUIDO: Finalizada com sucesso
   - CANCELADO: Cancelada (libera dependências)

#### Fluxos Principais

**Fluxo de Cancelamento:**
1. Usuário clica "Cancelar Ação"
2. Sistema solicita login/senha
3. Sistema exibe motivos de CANCELAMENTO
4. Usuário seleciona motivo e adiciona observação
5. Sistema valida credenciais
6. Sistema cancela ação e registra motivo
7. Sistema libera dependências automaticamente

**Fluxo de Conclusão com SLA Vencido:**
1. Usuário clica "Finalizar Ação"
2. Sistema verifica SLA
3. Se vencido, solicita motivo de FORA_DO_PRAZO
4. Usuário seleciona motivo e adiciona observação
5. Sistema registra motivo e conclui ação

#### Segurança

- Autenticação via bcrypt para validação de senha
- Validação de empresa (companyId) em todas as operações
- Motivos vinculados à empresa do usuário
- Audit logs para todas as operações críticas
- Validação de permissões (admin para CRUD de motivos)
