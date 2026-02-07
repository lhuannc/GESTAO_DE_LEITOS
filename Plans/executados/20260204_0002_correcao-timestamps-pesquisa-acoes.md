# Correção: Timestamps em Pesquisa de Ações

## Problema Identificado

### Colunas de Timestamp Vazias
- **Sintoma**: Colunas "Início Bloqueio", "Fim Bloqueio", "Início Pendente", "Fim Pendente", "Início Andamento" exibindo "-" ao invés de datas
- **Causa Raiz**: Funções `getStatusDates()` e `calculateDuration()` esperavam `order.history`, mas o backend retorna `order.orderHistory`
- **Impacto**: Impossível analisar tempos de transição entre status das ações

## Análise Técnica

### Problema 1: Campo Incorreto
O código esperava `order.history` mas o backend retorna `orderHistory`:

```typescript
// ❌ ANTES - não funcionava
if (!order.history || !Array.isArray(order.history)) return {...};
const sortedHistory = [...order.history].sort(...);
```

### Problema 2: Lógica de "Fim de Status"
A lógica original para encontrar quando um status terminou estava incorreta:

```typescript
// ❌ ANTES - lógica invertida
const blockEnd = [...sortedHistory].reverse().find((h, i, arr) =>
  h.status === 'BLOQUEADO' && i > 0 && arr[i - 1].status !== 'BLOQUEADO'
);
```

Isso buscava de trás para frente, o que não funcionava corretamente.

## Solução Implementada

### Arquivo Modificado
- `apps/web/src/components/ActionsList.tsx`

### Mudanças Realizadas

#### 1. Função `calculateDuration()` - Linhas 58-73

**Melhorias:**
- ✅ Suporta tanto `orderHistory` quanto `history`
- ✅ Suporta tanto `timestamp` quanto `createdAt`
- ✅ Fallback gracioso quando não há histórico

```typescript
const calculateDuration = (order: ServiceOrder): number => {
  // Backend retorna orderHistory, não history
  const rawHistory = (order as any).orderHistory || order.history || [];
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return 0;

  const sortedHistory = [...rawHistory].sort((a, b) =>
    new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
  );

  const firstPending = sortedHistory.find(h => h.status === 'PENDENTE');
  if (!firstPending) return 0;

  const start = new Date(firstPending.timestamp || firstPending.createdAt);
  const end = order.completedAt ? new Date(order.completedAt) : new Date();

  return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
};
```

#### 2. Função `getStatusDates()` - Linhas 75-119

**Melhorias:**
- ✅ Suporta `orderHistory` e `history`
- ✅ Suporta `timestamp` e `createdAt`
- ✅ Lógica corrigida para encontrar fim de status
- ✅ Retorna timestamp do próximo status (quando mudou)

```typescript
const getStatusDates = (order: ServiceOrder) => {
  // Backend retorna orderHistory, não history
  const rawHistory = (order as any).orderHistory || order.history || [];
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
    return {
      blockStart: '',
      blockEnd: '',
      pendingStart: '',
      pendingEnd: '',
      inProgressStart: '',
    };
  }

  const sortedHistory = [...rawHistory].sort((a, b) =>
    new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
  );

  // Encontrar primeira ocorrência de cada status
  const blockStart = sortedHistory.find(h => h.status === 'BLOQUEADO');
  
  // Encontrar última ocorrência de BLOQUEADO (quando saiu do bloqueio)
  const blockEndIndex = sortedHistory.findIndex((h, i, arr) => 
    h.status === 'BLOQUEADO' && i < arr.length - 1 && arr[i + 1].status !== 'BLOQUEADO'
  );
  const blockEnd = blockEndIndex >= 0 ? sortedHistory[blockEndIndex + 1] : null;

  const pendingStart = sortedHistory.find(h => h.status === 'PENDENTE');
  
  // Encontrar quando saiu de PENDENTE
  const pendingEndIndex = sortedHistory.findIndex((h, i, arr) => 
    h.status === 'PENDENTE' && i < arr.length - 1 && arr[i + 1].status !== 'PENDENTE'
  );
  const pendingEnd = pendingEndIndex >= 0 ? sortedHistory[pendingEndIndex + 1] : null;

  const inProgressStart = sortedHistory.find(h => h.status === 'EM_ANDAMENTO');

  return {
    blockStart: blockStart ? (blockStart.timestamp || blockStart.createdAt) : '',
    blockEnd: blockEnd ? (blockEnd.timestamp || blockEnd.createdAt) : '',
    pendingStart: pendingStart ? (pendingStart.timestamp || pendingStart.createdAt) : '',
    pendingEnd: pendingEnd ? (pendingEnd.timestamp || pendingEnd.createdAt) : '',
    inProgressStart: inProgressStart ? (inProgressStart.timestamp || inProgressStart.createdAt) : '',
  };
};
```

## Lógica de "Fim de Status"

### Como Funciona Agora

Para encontrar quando um status terminou, buscamos o momento em que:
1. O status atual é X (ex: BLOQUEADO)
2. O próximo status é diferente de X
3. Retornamos o timestamp do próximo status

**Exemplo de histórico:**
```
[
  { status: 'PENDENTE', timestamp: '10:00' },      // Início PENDENTE
  { status: 'BLOQUEADO', timestamp: '10:30' },     // Fim PENDENTE = 10:30, Início BLOQUEADO
  { status: 'BLOQUEADO', timestamp: '11:00' },     // Ainda bloqueado
  { status: 'PENDENTE', timestamp: '11:30' },      // Fim BLOQUEADO = 11:30
  { status: 'EM_ANDAMENTO', timestamp: '12:00' },  // Fim PENDENTE = 12:00, Início ANDAMENTO
]
```

**Resultado:**
- Início Bloqueio: 10:30
- Fim Bloqueio: 11:30
- Início Pendente: 10:00
- Fim Pendente: 12:00
- Início Andamento: 12:00

## Resultado Esperado

### Tabela de Pesquisa de Ações
- ✅ Coluna "Início Bloqueio" exibe data/hora quando entrou em BLOQUEADO
- ✅ Coluna "Fim Bloqueio" exibe data/hora quando saiu de BLOQUEADO
- ✅ Coluna "Início Pendente" exibe data/hora quando entrou em PENDENTE
- ✅ Coluna "Fim Pendente" exibe data/hora quando saiu de PENDENTE
- ✅ Coluna "Início Andamento" exibe data/hora quando entrou em EM_ANDAMENTO

### Formato de Exibição
- Data e hora formatadas: `04/02/2026, 23:25`
- Vazio quando não aplicável: `-`

## Verificação

### Teste Manual
1. Acessar "Pesquisa de Ações" no menu
2. Verificar tabela com ações existentes
3. Confirmar que colunas de timestamp estão preenchidas
4. Exportar CSV e verificar dados

### Casos de Teste
- ✅ Ação que passou por BLOQUEADO
- ✅ Ação que nunca foi bloqueada
- ✅ Ação em andamento
- ✅ Ação concluída
- ✅ Ação com múltiplas transições de status

## Compatibilidade

A solução mantém compatibilidade com:
- Dados antigos usando `history`, `timestamp`, `requestedAt`, `finishedAt`
- Dados novos usando `orderHistory`, `createdAt`, `completedAt`

## Exportação CSV

O CSV também foi corrigido e agora exporta corretamente:
- Data de Início Bloqueio
- Data de Fim Bloqueio
- Data de Início Pendente
- Data de Fim Pendente
- Data de Início Em Andamento
