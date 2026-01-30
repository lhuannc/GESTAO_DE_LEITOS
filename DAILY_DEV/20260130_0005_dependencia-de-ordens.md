# Plano de Implementação: Dependência de Ordens (Bloqueios)

## Objetivo
Implementar a funcionalidade que permite que uma Ordem de Serviço (OS) dependa da conclusão de outra, mesmo entre leitos diferentes. Inclui uma interface para visualizar e gerenciar essas dependências (Tabela de Dependência).

## Mudanças Propostas

### 1. Backend (tRPC & Prisma)
- **Aprimoramento de Criacão**: Reativar e validar o campo `dependency` na mutation `orders.create`.
- **Lógica de Bloqueio**:
  - Se `type: 'BLOQUEADA'`, a nova OS nasce como `BLOQUEADO` e depende da `actionId` informada.
  - Se `type: 'BLOQUEADOR'`, a nova OS nasce normalmente mas bloqueia a `actionId` informada (status da OS alvo muda para `BLOQUEADO`).
- **Liberação Automática**: Na mutation `orders.updateStatus`, ao concluir uma OS, verificar se existem outras OS que dependem dela e liberá-las (`status: PENDENTE`).

### 2. Frontend (UI/UX)
- **Tabela de Dependência**: Criar um novo componente ou aba para listar todas as OS que possuem dependências ativas.
- **Formulário de Solicitação**: Adicionar campos para seleção de OS bloqueadora/bloqueada.
- **Visualização**: Ícones de cadeado e links entre OS dependentes no Kanban.

## Checklist de Tarefas

- [ ] Implementação Backend <!-- id: 40 -->
    - [ ] Validar e processar objeto `dependency` no `create` <!-- id: 41 -->
    - [ ] Implementar busca de dependentes no `updateStatus` <!-- id: 42 -->
- [ ] Implementação Frontend <!-- id: 43 -->
    - [ ] Criar Componente `OrderDependencyTable.tsx` <!-- id: 44 -->
    - [ ] Adicionar campos de dependência em `ServiceRequestForm.tsx` <!-- id: 45 -->
    - [ ] Exibir alertas de bloqueio no `ServiceOrdersKanban.tsx` <!-- id: 46 -->
- [ ] Verificação <!-- id: 47 -->
    - [ ] Testar fluxo: OS A bloqueia OS B -> Concluir OS A -> OS B liberada <!-- id: 48 -->
