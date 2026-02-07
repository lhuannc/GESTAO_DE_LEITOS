# FIX: Dashboard Operacional - Checklist

## Problemas
- [ ] ❌ Tempo das ações não atualiza em tempo real
- [ ] ❌ Indicador "Fora do Prazo" não funciona
- [ ] ⚠️ Histórico de rastreabilidade pode estar vazio

---

## Implementação

### Fase 1: Atualização em Tempo Real
- [ ] Adicionar estado `currentTime` no componente
- [ ] Criar `useEffect` com `setInterval` (30 segundos)
- [ ] Adicionar `currentTime` como dependência do `useMemo` de `processedOrdersData`
- [ ] Modificar `calculateTimeFromPendingToCompletion` para usar `Date.now()`
- [ ] Limpar intervalo no cleanup do `useEffect`

### Fase 2: Correção de SLA
- [ ] Atualizar lógica `foraDoPrazo` para excluir status CONCLUIDO
- [ ] Adicionar `animate-pulse` para ações fora do prazo
- [ ] Verificar cálculo correto de SLA vs tempo decorrido

### Fase 3: Histórico de Rastreabilidade
- [ ] Investigar backend: campo `history` vs `orderHistory`
- [ ] Adicionar fallback para ambos os nomes de campo
- [ ] Adicionar suporte para `timestamp` vs `createdAt`
- [ ] Adicionar mensagem quando histórico está vazio
- [ ] Verificar se backend está criando histórico nas transições

### Fase 4: Melhorias Adicionais (Opcional)
- [ ] Adicionar contador de ações fora do prazo no header
- [ ] Adicionar tooltip com informações de SLA
- [ ] Melhorar feedback visual para urgência

---

## Testes

### Teste 1: Tempo Real
- [ ] Abrir dashboard e observar tempo de ação EM_ANDAMENTO
- [ ] Aguardar 30 segundos
- [ ] Verificar atualização automática do tempo

### Teste 2: SLA
- [ ] Criar ação com SLA de 5 minutos
- [ ] Aguardar ultrapassar SLA
- [ ] Verificar marcação "FORA DO PRAZO"
- [ ] Verificar animação visual
- [ ] Concluir ação e verificar remoção da marcação

### Teste 3: Histórico
- [ ] Abrir modal de ação individual
- [ ] Verificar seção "Rastreabilidade de Execução"
- [ ] Confirmar exibição de timestamps
- [ ] Testar com ação sem histórico

---

## Arquivos Afetados
- `apps/web/src/components/DashboardOperacional.tsx`
- Possível: Backend (verificar criação de histórico)

---

## Estimativa
- Fase 1: 1-2 horas
- Fase 2: 30 minutos
- Fase 3: 1-2 horas
- Fase 4: 1 hora
- Testes: 1 hora
- **Total**: 4-6 horas
