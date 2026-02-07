# Implementação: Cadastro de Seções e Melhorias na Página de Solicitação

## Checklist de Implementação

### Parte 1: Cadastro de Seções

#### Backend - Modelos e Tipos
- [ ] Criar interface `Section`
  - [ ] id, name, sectorId, companyId, createdAt, updatedAt
- [ ] Atualizar interface `Bed` para incluir `sectionId` (opcional)
- [ ] Atualizar schema Prisma com modelo `Section`
- [ ] Criar migration do banco de dados

#### Backend - API (tRPC)
- [ ] Criar router `sections` com CRUD
  - [ ] `sections.list` - listar seções (filtro por setor)
  - [ ] `sections.create` - criar nova seção
  - [ ] `sections.update` - atualizar seção
  - [ ] `sections.delete` - deletar seção
- [ ] Atualizar router `beds`
  - [ ] Adicionar campo `sectionId` ao criar/editar

#### Frontend - Tipos
- [ ] Criar tipo `Section`
- [ ] Atualizar tipo `Bed` com `sectionId` opcional

#### Frontend - Cadastro de Seções
- [ ] Criar componente `SectionsManager`
- [ ] Formulário de cadastro
  - [ ] Nome da seção
  - [ ] Setor (dropdown)
- [ ] Listagem de seções
  - [ ] Filtro por setor
  - [ ] Exibir: nome, setor
  - [ ] Ações: Editar, Excluir
- [ ] Integrar no menu de Cadastros

#### Frontend - Cadastro de Leitos
- [ ] Atualizar formulário de leitos
  - [ ] Adicionar campo Seção (dropdown, opcional)
  - [ ] Filtrar seções pelo setor selecionado

---

### Parte 2: Melhorias na Página de Solicitação

#### Mudanças de Labels
- [ ] Mudar "Nova Solicitação de Fluxo" para "Nova Solicitação"
- [ ] Mudar "Leito" para "Origem da Solicitação"
- [ ] Mudar "Serviço / Fluxo" para "Serviço"

#### Exibição Hierárquica de Leitos
- [ ] Criar componente de select hierárquico
  - [ ] Agrupar por Setor
  - [ ] Sub-agrupar por Seção (se existir)
  - [ ] Exibir leitos
- [ ] Implementar formato: `SETOR - LEITO` (ex: 3301-PA11)
- [ ] Ordenar: Setor > Seção > Leito

#### Select com Busca
- [ ] Implementar select searchable
  - [ ] Permitir digitação para filtrar opções
  - [ ] Buscar por nome do leito, setor ou seção
- [ ] Biblioteca sugerida: `react-select` ou similar

#### Modal de Confirmação
- [ ] Criar componente `OrderConfirmationModal`
- [ ] Exibir após submit bem-sucedido
  - [ ] Número da solicitação
  - [ ] Dados da solicitação (leito, serviço)
  - [ ] Lista de ações criadas
  - [ ] Ordem de dependências
- [ ] Botão "Fechar" que mantém usuário na página

#### Comportamento Pós-Confirmação
- [ ] Manter usuário na página de solicitar
- [ ] Limpar formulário após confirmação
- [ ] Permitir nova solicitação imediatamente

---

### Testes

#### Teste 1: Cadastro de Seções
- [ ] Criar seção associada a um setor
- [ ] Editar seção
- [ ] Excluir seção
- [ ] Verificar filtro por setor

#### Teste 2: Associação Leito-Seção
- [ ] Criar leito com seção
- [ ] Criar leito sem seção
- [ ] Verificar filtro de seções por setor

#### Teste 3: Exibição Hierárquica
- [ ] Verificar agrupamento por setor
- [ ] Verificar sub-agrupamento por seção
- [ ] Verificar ordenação correta

#### Teste 4: Select com Busca
- [ ] Digitar nome do leito
- [ ] Digitar nome do setor
- [ ] Digitar nome da seção
- [ ] Verificar filtragem

#### Teste 5: Modal de Confirmação
- [ ] Criar solicitação
- [ ] Verificar exibição do modal
- [ ] Verificar dados exibidos
- [ ] Fechar modal e verificar permanência na página

---

### Documentação
- [ ] Atualizar `agent.md` com cadastro de seções
- [ ] Documentar hierarquia Setor > Seção > Leito
- [ ] Documentar novo fluxo de solicitação
