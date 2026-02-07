# FIX: Dashboard Operacional - Atualização em Tempo Real e Histórico

## Problemas Identificados

### 1. ❌ Tempo das Ações Não Atualiza em Tempo Real
**Sintoma**: O tempo decorrido de cada ação não é atualizado automaticamente, permanecendo estático até refresh da página.

**Causa Raiz**: 
- O cálculo de duração (`calculateTimeFromPendingToCompletion`) é executado apenas uma vez no `useMemo` (linha 234-249)
- Não há intervalo (`setInterval`) para recalcular o tempo periodicamente
- O componente não força re-render para atualizar os tempos

**Impacto**:
- Impossível identificar ações fora do prazo em tempo real
- Usuários precisam recarregar a página manualmente
- Perda de visibilidade operacional crítica

---

### 2. ❌ Indicador de "Fora do Prazo" Não Funciona
**Sintoma**: Ações que ultrapassam o SLA não são marcadas visualmente como "FORA DO PRAZO".

**Causa Raiz**:
- A verificação de SLA (linha 244) depende do tempo calculado no `useMemo`
- Como o tempo não atualiza, a flag `foraDoPrazo` permanece desatualizada
- O cálculo é feito apenas no carregamento inicial

**Impacto**:
- Equipe não é alertada sobre atrasos
- Impossível priorizar ações urgentes
- Perda de controle sobre SLA

---

### 3. ⚠️ Histórico de Rastreabilidade Existe Mas Pode Estar Vazio
**Sintoma**: Modal individual da ação mostra seção "Rastreabilidade de Execução" mas pode estar vazia.

**Análise do Código**:
- A seção de histórico existe (linhas 641-680)
- Condição: `selectedAction.history && Array.isArray(selectedAction.history) && selectedAction.history.length > 0`
- **Possíveis causas**:
  - Backend não está populando `history` corretamente
  - Campo `orderHistory` vs `history` (inconsistência de nomenclatura)
  - Histórico não está sendo criado nas transições de status

**Impacto**:
- Perda de rastreabilidade
- Impossível auditar execução das ações
- Falta de transparência operacional

---

### 4. ✅ Permissões Corretas (Não é Bug)
**Observação**: O modal individual é read-only (apenas botão "Fechar" na linha 685-690), o que está **correto** conforme requisito.
- Não há opção de atribuir colaborador (correto)
- Apenas visualização de informações (correto)

---

## Plano de Correção

### FIX 1: Implementar Atualização em Tempo Real

#### Backend - Nenhuma Mudança Necessária
✅ Backend já fornece dados necessários

#### Frontend - `DashboardOperacional.tsx`

**Mudanças Necessárias**:

1. **Adicionar estado para tempo atual**
```typescript
const [currentTime, setCurrentTime] = useState(Date.now());
```

2. **Criar intervalo para atualizar tempo**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(Date.now());
  }, 30000); // Atualizar a cada 30 segundos

  return () => clearInterval(interval);
}, []);
```

3. **Atualizar `useMemo` para incluir `currentTime` como dependência**
```typescript
const processedOrdersData = useMemo(() => {
  const data: Record<string, { duration: number, formattedDuration: string, foraDoPrazo: boolean }> = {};

  orders.forEach(order => {
    // Usar currentTime para cálculo em tempo real
    const duration = calculateTimeFromPendingToCompletion(order);
    const formattedDuration = formatDuration(duration);
    const service = services.find(s => s.id === order.serviceTypeId);
    const subOrderConfig = service?.config?.subOrders?.find((so: any) => so.order === order.step);
    const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;
    const slaMinutes = step?.slaMinutes;
    const foraDoPrazo = !!(slaMinutes && duration > slaMinutes && order.status !== 'BLOQUEADO' && order.status !== 'CONCLUIDO');
    data[order.id] = { duration, formattedDuration, foraDoPrazo };
  });

  return data;
}, [orders, services, steps, currentTime]); // Adicionar currentTime
```

4. **Atualizar função `calculateTimeFromPendingToCompletion`**
```typescript
const calculateTimeFromPendingToCompletion = (order: ServiceOrder): number => {
  if (!order.history || !Array.isArray(order.history) || order.history.length === 0) {
    return 0;
  }

  const sortedHistory = [...order.history].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const primeiroPendente = sortedHistory.find(h => h.status === 'PENDENTE');
  if (!primeiroPendente) return 0;

  const inicioPendente = new Date(primeiroPendente.timestamp);
  
  // Usar Date.now() em vez de new Date() para tempo real
  // Se já concluído, usar finishedAt
  const fim = order.status === 'CONCLUIDO' && order.finishedAt 
    ? new Date(order.finishedAt) 
    : new Date(Date.now());

  return (fim.getTime() - inicioPendente.getTime()) / (1000 * 60);
};
```

**Arquivos Afetados**:
- `apps/web/src/components/DashboardOperacional.tsx`

---

### FIX 2: Corrigir Verificação de SLA

**Mudanças Necessárias**:

1. **Atualizar lógica de `foraDoPrazo`**
```typescript
// Linha 244 - Adicionar verificação de status CONCLUIDO
const foraDoPrazo = !!(
  slaMinutes && 
  duration > slaMinutes && 
  order.status !== 'BLOQUEADO' && 
  order.status !== 'CONCLUIDO' // Não marcar como fora do prazo se já concluído
);
```

2. **Adicionar indicador visual mais proeminente**
```typescript
// No card da ação (linha 356), adicionar animação para fora do prazo
className={`flex flex-col gap-0.5 px-2 md:px-2.5 py-1 md:py-1.5 rounded-lg border-2 transition-all relative cursor-pointer hover:scale-105 ${
  foraDoPrazo 
    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200 hover:bg-rose-100 animate-pulse' // Adicionar animate-pulse
    : order.status === 'CONCLUIDO' 
      ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
      : // ... resto
}`}
```

**Arquivos Afetados**:
- `apps/web/src/components/DashboardOperacional.tsx`

---

### FIX 3: Garantir Exibição do Histórico

**Investigação Necessária**:

1. **Verificar campo correto no backend**
   - Confirmar se é `history` ou `orderHistory`
   - Verificar se o backend está populando corretamente

2. **Adicionar fallback para nomenclatura**
```typescript
// Linha 642 - Adicionar suporte para ambos os nomes
const history = (selectedAction.orderHistory || selectedAction.history) as any[];

{history && Array.isArray(history) && history.length > 0 && (
  <div>
    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center space-x-2">
      <Clock size={16} className="text-sky-500" /> <span>Rastreabilidade de Execução</span>
    </h5>
    <div className="space-y-1">
      {history
        .sort((a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime())
        .map((h, i, arr) => {
          // ... resto do código
        })}
    </div>
  </div>
)}
```

3. **Adicionar mensagem quando histórico está vazio**
```typescript
{/* Se não há histórico, mostrar mensagem */}
{(!history || !Array.isArray(history) || history.length === 0) && (
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
    <p className="text-xs font-bold text-amber-800">
      ⚠️ Nenhum histórico de execução disponível
    </p>
    <p className="text-xs text-amber-600 mt-1">
      O histórico será criado quando houver transições de status.
    </p>
  </div>
)}
```

**Arquivos Afetados**:
- `apps/web/src/components/DashboardOperacional.tsx`
- Possível: Backend (se histórico não está sendo criado)

---

### FIX 4: Melhorias Adicionais (Opcional)

#### 4.1. Adicionar Contador de Ações Fora do Prazo
```typescript
const acoesFora DoPrazo = useMemo(() => {
  return Object.values(processedOrdersData).filter(d => d.foraDoPrazo).length;
}, [processedOrdersData]);

// No header (linha 292)
<div className="flex gap-2">
  <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
    Total: {todosLeitos.length} Leitos
  </span>
  {acoesForaDoPrazo > 0 && (
    <span className="text-[9px] font-black bg-rose-100 text-rose-600 px-3 py-1 rounded-full uppercase animate-pulse">
      ⚠️ {acoesForaDoPrazo} Fora do Prazo
    </span>
  )}
</div>
```

#### 4.2. Adicionar Tooltip com SLA
```typescript
// No card da ação, adicionar informação de SLA no title
title={`${order.subServiceName}: ${order.status}${foraDoPrazo ? ' - FORA DO PRAZO' : ''}
SLA: ${slaMinutes ? formatDuration(slaMinutes) : 'Não definido'}
Tempo decorrido: ${formattedDuration}`}
```

---

## Checklist de Implementação

### Fase 1: Tempo Real
- [ ] Adicionar estado `currentTime`
- [ ] Criar `useEffect` com `setInterval` (30s)
- [ ] Atualizar `processedOrdersData` com dependência `currentTime`
- [ ] Modificar `calculateTimeFromPendingToCompletion` para usar `Date.now()`
- [ ] Testar atualização automática

### Fase 2: SLA
- [ ] Atualizar lógica `foraDoPrazo` (excluir CONCLUIDO)
- [ ] Adicionar `animate-pulse` para ações fora do prazo
- [ ] Testar identificação visual

### Fase 3: Histórico
- [ ] Investigar backend: campo `history` vs `orderHistory`
- [ ] Adicionar fallback para ambos os nomes
- [ ] Adicionar suporte para `timestamp` vs `createdAt`
- [ ] Adicionar mensagem quando histórico vazio
- [ ] Testar exibição do histórico

### Fase 4: Melhorias (Opcional)
- [ ] Adicionar contador de ações fora do prazo
- [ ] Adicionar tooltip com informações de SLA
- [ ] Melhorar feedback visual

---

## Testes

### Teste 1: Atualização em Tempo Real
1. Abrir Dashboard Operacional
2. Observar tempo de uma ação EM_ANDAMENTO
3. Aguardar 30 segundos
4. Verificar se tempo foi atualizado automaticamente

### Teste 2: SLA Fora do Prazo
1. Criar ação com SLA de 5 minutos
2. Aguardar 6 minutos
3. Verificar se ação é marcada como "FORA DO PRAZO"
4. Verificar animação `pulse` no card
5. Concluir ação
6. Verificar se marcação "FORA DO PRAZO" desaparece

### Teste 3: Histórico
1. Abrir modal de ação individual
2. Verificar seção "Rastreabilidade de Execução"
3. Confirmar que histórico é exibido corretamente
4. Verificar timestamps e transições de status
5. Testar com ação sem histórico (deve mostrar mensagem)

---

## Riscos e Considerações

### Performance
- **Risco**: Atualização a cada 30s pode causar re-renders desnecessários
- **Mitigação**: Usar `useMemo` e `React.memo` para otimizar
- **Alternativa**: Aumentar intervalo para 60s se necessário

### Compatibilidade de Dados
- **Risco**: Campo `history` vs `orderHistory` pode causar inconsistência
- **Mitigação**: Suportar ambos os nomes com fallback
- **Ação**: Normalizar nomenclatura no backend futuramente

### UX
- **Risco**: Animação `pulse` constante pode ser irritante
- **Mitigação**: Usar animação sutil
- **Alternativa**: Usar apenas cor de fundo sem animação

---

## Estimativa

- **Fase 1 (Tempo Real)**: 1-2 horas
- **Fase 2 (SLA)**: 30 minutos
- **Fase 3 (Histórico)**: 1-2 horas (incluindo investigação backend)
- **Fase 4 (Melhorias)**: 1 hora
- **Testes**: 1 hora

**Total**: 4-6 horas
