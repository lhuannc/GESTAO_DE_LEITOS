# Correção: Custo de Insumos em Pesquisa de Ações

## Problema Identificado

### Custo Exibindo R$ 0
- **Sintoma**: Coluna "Custo" sempre exibindo "R$ 0" independente dos insumos da ação
- **Causa Raiz**: Código tentava usar `step?.cost` que não existe no modelo `Step`
- **Impacto**: Impossível visualizar o custo real dos insumos utilizados em cada ação

## Análise Técnica

### Estrutura de Dados

**Modelo Step (não tem custo):**
```typescript
interface Step {
  id: string;
  name: string;
  companyId: string;
  targetTeamId: string;
  allowedItemIds: string[];
  slaMinutes?: number;
  // ❌ Não tem campo 'cost'
}
```

**Modelo ServiceOrder (tem itens com custo):**
```typescript
interface ServiceOrder {
  items: SelectedItem[];  // ✅ Aqui estão os custos
  // ...
}

interface SelectedItem {
  itemId: string;
  name: string;
  quantity: number;
  unitCost: number;  // ✅ Custo unitário
}
```

### Código Incorreto

```typescript
// ❌ ANTES - tentava usar campo inexistente
actionCost: step?.cost?.toString() || '0',
```

## Solução Implementada

### Arquivo Modificado
- `apps/web/src/components/ActionsList.tsx`

### Mudança Realizada - Linhas 166-195

**Antes:**
```typescript
const depOrder = depOrderId ? orders.find(o => o.id === depOrderId) : null;
const depService = depOrder ? services.find(s => s.id === depOrder.serviceTypeId) : null;

actions.push({
  // ...
  actionCost: step?.cost?.toString() || '0',  // ❌ Campo não existe
  // ...
});
```

**Depois:**
```typescript
const depOrder = depOrderId ? orders.find(o => o.id === depOrderId) : null;
const depService = depOrder ? services.find(s => s.id === depOrder.serviceTypeId) : null;

// Calcular custo total dos itens da ordem
const totalCost = (order.items || []).reduce((sum, item) => 
  sum + (item.unitCost * item.quantity), 0
);

actions.push({
  // ...
  actionCost: totalCost.toFixed(2),  // ✅ Calcula soma dos itens
  // ...
});
```

### Como Funciona

O custo é calculado somando o valor de cada item:
- **Custo do Item** = `unitCost × quantity`
- **Custo Total** = Soma de todos os itens

**Exemplo:**
```javascript
order.items = [
  { name: 'Kit Higiene', unitCost: 15.50, quantity: 2 },  // 31.00
  { name: 'Luvas', unitCost: 8.00, quantity: 5 },         // 40.00
]

totalCost = 31.00 + 40.00 = 71.00
actionCost = "71.00"  // Formatado com 2 casas decimais
```

## Resultado Esperado

### Coluna "Custo" na Tabela
- ✅ Exibe custo real calculado dos insumos
- ✅ Formato: "R$ 71.00"
- ✅ Duas casas decimais sempre
- ✅ "R$ 0.00" quando não há itens

### Exportação CSV
- ✅ CSV também exporta custo correto
- ✅ Formato numérico: "71.00"

## Verificação

### Teste Manual
1. Acessar "Pesquisa de Ações"
2. Verificar coluna "Custo"
3. Confirmar valores corretos baseados nos insumos
4. Exportar CSV e verificar valores

### Casos de Teste
- ✅ Ação com múltiplos insumos
- ✅ Ação com um insumo
- ✅ Ação sem insumos (deve mostrar R$ 0.00)
- ✅ Insumos com quantidades diferentes

## Notas Técnicas

### Precisão Decimal
- Usa `.toFixed(2)` para garantir sempre 2 casas decimais
- Evita problemas de arredondamento do JavaScript
- Formato adequado para valores monetários

### Performance
- Cálculo feito uma vez por ordem durante processamento
- Não recalcula a cada renderização
- Eficiente mesmo com muitas ordens
