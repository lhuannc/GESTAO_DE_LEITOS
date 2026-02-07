# Correção: SLA e Histórico do Modal de Ação

## Problema Identificado

### 1. SLA mostrando "NaNs"
- **Sintoma**: Campo "SLA da Ação" exibindo "NaNs" ao invés do tempo decorrido
- **Causa Raiz**: A função `getDurations()` esperava `order.history`, mas o backend retorna `order.orderHistory`
- **Impacto**: Impossível visualizar quanto tempo a ação está em execução

### 2. Rastreabilidade de Execução vazia
- **Sintoma**: Seção "Rastreabilidade de Execução" não exibindo nenhum dado
- **Causa Raiz**: Mesma causa - mapeamento incorreto do histórico
- **Impacto**: Impossível rastrear mudanças de status e tempo entre transições

## Análise Técnica

### Estrutura de Dados Esperada vs Real

**Frontend esperava:**
```typescript
interface ServiceOrder {
  history: {
    status: OSStatus;
    userId: string;
    timestamp: string;
    note?: string;
  }[];
  requestedAt: string;
  finishedAt: string;
}
```

**Backend retorna:**
```typescript
{
  orderHistory: {
    status: OSStatus;
    createdAt: string;  // não timestamp
    note?: string;
  }[];
  createdAt: string;    // não requestedAt
  completedAt: string;  // não finishedAt
}
```

## Solução Implementada

### Arquivo Modificado
- `apps/web/src/components/ServiceOrdersKanban.tsx`

### Mudanças Realizadas

#### 1. Função `getDurations()` - Linhas 277-308

**Melhorias:**
- ✅ Suporta tanto `orderHistory` quanto `history`
- ✅ Suporta tanto `timestamp` quanto `createdAt`
- ✅ Suporta tanto `completedAt` quanto `finishedAt`
- ✅ Suporta tanto `createdAt` quanto `requestedAt`
- ✅ Fallback gracioso quando não há histórico
- ✅ Proteção contra valores nulos/undefined

#### 2. Renderização do Histórico - Linhas 512-548

**Melhorias:**
- ✅ Verifica se há histórico antes de renderizar
- ✅ Exibe mensagem amigável quando vazio
- ✅ Suporta múltiplos nomes de campos (`timestamp`/`createdAt`, `note`/`notes`)
- ✅ Fallback para texto padrão quando não há nota

## Resultado Esperado

### SLA da Ação
- ✅ Exibe tempo decorrido em formato legível (ex: "143h 56m 19s")
- ✅ Atualiza em tempo real a cada segundo
- ✅ Funciona para ordens em qualquer status

### Rastreabilidade de Execução
- ✅ Exibe timeline completa de mudanças de status
- ✅ Mostra tempo decorrido entre cada transição (+42s, +17h 21m 20s, etc.)
- ✅ Exibe horário de cada evento
- ✅ Mostra notas/observações de cada mudança
- ✅ Destaca transições muito rápidas (< 1 minuto) em vermelho

## Verificação

### Teste Manual
1. Abrir o modal de qualquer ação no Kanban
2. Verificar campo "SLA da Ação" - deve mostrar tempo formatado
3. Verificar seção "Rastreabilidade de Execução" - deve mostrar histórico
4. Aguardar 1 segundo - SLA deve atualizar automaticamente

### Casos de Teste
- ✅ Ordem recém-criada (sem histórico)
- ✅ Ordem em andamento (com histórico parcial)
- ✅ Ordem concluída (com histórico completo)
- ✅ Ordem bloqueada

## Notas Técnicas

### Compatibilidade com Dados Legados
A solução usa operador `||` para suportar múltiplos nomes de campos, garantindo compatibilidade com:
- Dados antigos que usam `requestedAt`, `finishedAt`, `history`
- Dados novos que usam `createdAt`, `completedAt`, `orderHistory`

### Performance
- Função `getDurations()` é chamada múltiplas vezes
- Considerar memoização se houver problemas de performance
- Timer atualiza a cada 1 segundo apenas quando modal está aberto

### Próximas Melhorias
- [ ] Adicionar testes unitários para `getDurations()`
- [ ] Memoizar resultado de `getDurations()` com `useMemo`
- [ ] Padronizar nomes de campos no backend (usar sempre `createdAt`, `completedAt`, `orderHistory`)
