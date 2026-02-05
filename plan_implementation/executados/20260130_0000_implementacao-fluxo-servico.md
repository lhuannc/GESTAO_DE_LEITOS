# Plano de Implementação: Fluxo de Serviço (Workflow)

## Objetivo
Implementar a funcionalidade de Fluxo de Serviço (Fluxo) que permite configurar múltiplas etapas sequenciais para um serviço, com transições automáticas de status de leito.

## Mudanças Propostas

### Backend
- Adição do campo `config` (JSON) no model `ServiceType`.
- Atualização dos roteiros tRPC `services` e `orders`.
- Lógica de liberação automática de etapas e atualização de status de leito.

### Frontend
- Nova interface de construção de fluxo no `RegistrationManager.tsx`.
- Seleção de ações, equipes e configuração de status (Iniciar/Finalizar).

## Checklist de Tarefas

- [x] Pesquisar implementação atual <!-- id: 13 -->
    - [x] Revisar esquema Prisma para `ServiceType` e `Step` <!-- id: 14 -->
    - [x] Verificar lógica de fluxo atual em `RegistrationManager.tsx` <!-- id: 15 -->
    - [x] Revisar roteiros tRPC de `services` e `steps` <!-- id: 16 -->
- [x] Atualizações do Backend <!-- id: 17 -->
    - [x] Atualizar esquema Prisma para suportar "Status ao Iniciar/Finalizar" <!-- id: 18 -->
    - [x] Aprimorar roteiro de `services` para lidar com configuração de sub-ordens <!-- id: 19 -->
- [x] Implementação do Frontend <!-- id: 20 -->
    - [x] Implementar a interface de "Novo Fluxo" em `RegistrationManager.tsx` <!-- id: 21 -->
    - [x] Adicionar lógica para "Dependência Sequencial Automática" <!-- id: 22 -->
    - [x] Implementar seleção de etapas e configuração de status <!-- id: 23 -->
- [x] Verificação <!-- id: 24 -->
    - [x] Testar criação e edição de fluxos <!-- id: 25 -->
    - [x] Verificar persistência no banco de dados <!-- id: 26 -->
    - [x] Atualizar documentação em `agent.md` <!-- id: 27 -->
