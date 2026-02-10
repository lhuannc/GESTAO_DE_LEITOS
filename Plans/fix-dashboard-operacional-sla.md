# Correção do Dashboard Operacional - Atualização em Tempo Real e SLA

## Problema Identificado

O Dashboard Operacional não está atualizando corretamente os tempos das ações em tempo real e não está sinalizando adequadamente as ações que estão fora do prazo (SLA).

### Análise do Código Atual

**Linha 258 do `DashboardOperacional.tsx`:**
```typescript
const subOrderConfig = service?.config?.subOrders?.find((so: any) => so.order === order.step);
```

**Problema:** O código está tentando encontrar a configuração da sub-ordem usando `so.order === order.step`, mas a interface `SubOrderConfig` não possui uma propriedade `order`. A propriedade correta é `stepId`.

**Interface SubOrderConfig (types/index.ts):**
```typescript
export interface SubOrderConfig {
  stepId: string; // ID da etapa cadastrada (referência)
  name?: string;
  initialStatus?: OSStatus;
  targetTeamId?: string;
  allowedItemIds?: string[];
  bedStatusConfig?: { onStart?: BedStatus; onFinish?: BedStatus; };
}
```

### Causa Raiz

1. **Busca incorreta do Step**: O código está usando `so.order` (que não existe) ao invés de buscar pela posição no array ou pelo `stepId`
2. **SLA não é encontrado**: Como a busca falha, `step` é sempre `null`, então `slaMinutes` é sempre `undefined`
3. **Sem sinalização de SLA violado**: Como `slaMinutes` é `undefined`, a condição `foraDoPrazo` nunca é verdadeira

## Mudanças Propostas

### 1. Corrigir a Lógica de Busca do Step

**Arquivo:** `apps/web/src/components/DashboardOperacional.tsx`

**Linha 258:** Corrigir a busca do `subOrderConfig` e do `step`:

```typescript
// ANTES (incorreto):
const subOrderConfig = service?.config?.subOrders?.find((so: any) => so.order === order.step);
const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;

// DEPOIS (correto):
const subOrderConfig = service?.config?.subOrders?.[order.step];
const step = subOrderConfig?.stepId ? steps.find(s => s.id === subOrderConfig.stepId) : null;
```

**Justificativa:** O `order.step` é o índice da etapa no array `subOrders`, então devemos acessar diretamente pelo índice ao invés de usar `find()` com uma propriedade inexistente.

### 2. Verificar Atualização em Tempo Real

O código já possui um intervalo de 1 segundo (linhas 115-121) que atualiza o estado `now`, e o `useMemo` na linha 251 já depende de `now`, então a atualização em tempo real **já está implementada corretamente**.

O problema é apenas que o SLA não estava sendo encontrado devido ao bug na linha 258.

## Plano de Verificação

### Testes Manuais

1. **Verificar Atualização em Tempo Real:**
   - Abrir o Dashboard Operacional no navegador
   - Criar uma ordem de serviço com múltiplas etapas
   - Observar se os tempos das ações estão sendo atualizados a cada segundo
   - ✅ **Esperado:** Os tempos devem aumentar automaticamente sem precisar recarregar a página

2. **Verificar Sinalização de SLA Violado:**
   - Criar uma etapa (Step) com SLA de 1 minuto
   - Criar um serviço que use essa etapa
   - Criar uma ordem de serviço usando esse serviço
   - Aguardar mais de 1 minuto sem concluir a ação
   - ✅ **Esperado:** A ação deve aparecer com fundo vermelho e texto "FORA DO PRAZO"

3. **Verificar Cálculo Correto do Tempo:**
   - Verificar se o tempo exibido exclui períodos em que a ordem estava BLOQUEADA
   - ✅ **Esperado:** Tempo bloqueado não deve ser contabilizado

### Comandos de Teste

```bash
# Executar o ambiente de desenvolvimento
npm run dev:all
```

Depois acessar: `http://localhost:3000` e navegar para "Dashboard Operacional"

## Arquivos Afetados

### [MODIFY] [DashboardOperacional.tsx](file:///c:/projetos/GESTAO_DE_LEITOSv2React+pg/apps/web/src/components/DashboardOperacional.tsx)

- **Linha 258:** Corrigir busca do `subOrderConfig` usando índice ao invés de `find()` com propriedade inexistente
- **Impacto:** Permite que o SLA seja corretamente encontrado e a sinalização de "FORA DO PRAZO" funcione
