# Plano de Implementação: Infraestrutura Faltante da API

## Objetivo

Implementar a infraestrutura faltante no módulo API conforme documentado no `agent.md`, incluindo middlewares, utilitários, procedures e melhorias na organização do código.

## Análise dos Itens Pendentes

### 1. **Diretório `procedures/`** - ❌ NÃO EXISTE

**Motivo da Criação:**
- **Separação de Responsabilidades**: Os routers atualmente contêm toda a lógica de negócio inline. Procedures permitem extrair essa lógica para funções reutilizáveis e testáveis.
- **Reutilização de Código**: Lógica complexa pode ser compartilhada entre múltiplos routers.
- **Testabilidade**: Procedures isoladas são mais fáceis de testar unitariamente.
- **Manutenibilidade**: Routers ficam mais limpos, focando apenas em validação de input e orquestração.

**Status**: OPCIONAL (Nice-to-have) - O código atual funciona bem com lógica nos routers.

### 2. **Middleware `auth.ts`** - ❌ NÃO EXISTE

**Motivo da Criação:**
- **Centralização da Autenticação**: Atualmente a autenticação está no `trpc.ts` via `protectedProcedure`. Um middleware Fastify poderia adicionar camadas extras de segurança.
- **Rate Limiting por Usuário**: Middleware pode implementar rate limiting baseado em userId.
- **Logging de Autenticação**: Registrar tentativas de acesso não autorizado.

**Status**: OPCIONAL - A autenticação atual via tRPC middleware (`protectedProcedure`) é suficiente.

### 3. **Middleware `logging.ts`** - ❌ NÃO EXISTE

**Motivo da Criação:**
- **Logging Estruturado de Requests**: Registrar todas as requisições HTTP com timing, status, user-agent.
- **Correlação de Logs**: Adicionar request-id para rastrear requisições através do sistema.
- **Métricas**: Coletar métricas de performance (latência, throughput).

**Status**: RECOMENDADO - Melhoraria observabilidade do sistema.

### 4. **Utilitário `logger.ts`** - ❌ NÃO EXISTE

**Motivo da Criação:**
- **Logger Centralizado**: Atualmente usa `server.log` do Fastify. Um logger centralizado permitiria:
  - Uso consistente em toda a aplicação (routers, procedures, etc.)
  - Configuração de níveis de log por módulo
  - Integração com serviços externos (Datadog, Sentry)
  - Formatação estruturada (JSON) para parsing

**Status**: RECOMENDADO - O `server.log` do Fastify já existe mas não é acessível fora do contexto do servidor.

### 5. **Utilitário `errors.ts`** - ❌ NÃO EXISTE

**Motivo da Criação:**
- **Error Classes Customizadas**: Criar hierarquia de erros específicos do domínio:
  - `BedNotFoundError`, `OrderNotFoundError`, etc.
  - Facilita tratamento de erros específicos
  - Melhora mensagens de erro para o usuário
- **Error Mapping**: Converter erros do Prisma em erros mais amigáveis
- **Error Codes**: Códigos de erro padronizados para o frontend

**Status**: RECOMENDADO - Melhoraria experiência do desenvolvedor e do usuário.

## Mudanças Propostas

### 1. Logger Centralizado (`utils/logger.ts`)

#### Implementação
Criar logger baseado em Pino (já usado pelo Fastify) que pode ser importado em qualquer parte da aplicação.

**Benefícios:**
- Logs estruturados e consistentes
- Configurável por ambiente
- Suporte a child loggers para contextos específicos

---

### 2. Error Classes (`utils/errors.ts`)

#### Implementação
Criar classes de erro customizadas que estendem `TRPCError` com mensagens e códigos padronizados.

**Benefícios:**
- Mensagens de erro consistentes
- Facilita debugging
- Melhor experiência para o frontend

---

### 3. Logging Middleware (`middleware/logging.ts`)

#### Implementação
Middleware Fastify para logging de requisições HTTP.

**Benefícios:**
- Rastreamento de todas as requisições
- Métricas de performance
- Correlação de logs via request-id

---

### 4. Procedures (OPCIONAL)

#### Implementação
Extrair lógica complexa dos routers para procedures reutilizáveis.

**Exemplo:**
- `procedures/leitos/updateStatus.ts` - Lógica de atualização de status
- `procedures/orders/releaseBlocked.ts` - Lógica de liberação de ordens bloqueadas

**Benefícios:**
- Código mais testável
- Reutilização de lógica
- Routers mais limpos

**Desvantagem:**
- Adiciona camada extra de abstração
- Pode ser over-engineering para o tamanho atual do projeto

---

## Checklist de Implementação

### Backend - Infraestrutura
- [x] Criar `utils/logger.ts` - Logger centralizado ✅
- [x] Criar `utils/errors.ts` - Error classes customizadas ✅
- [x] Criar `middleware/logging.ts` - Request logging middleware ✅
- [x] Atualizar `server.ts` para usar logging middleware ✅
- [x] Testar logger em diferentes níveis (info, error, debug) ✅
- [x] Testar error classes com casos de uso reais ✅

### Documentação
- [x] Atualizar `apps/api/agent.md` com nova estrutura ✅
- [x] Documentar uso do logger ✅
- [x] Documentar error classes disponíveis ✅

---

## ✅ Implementação Concluída (2026-02-04)

Todos os itens de alta prioridade foram implementados com sucesso:

### Arquivos Criados
1. **`apps/api/src/utils/logger.ts`** - Logger centralizado baseado em Pino
   - Suporte a child loggers com contexto
   - Pretty printing em desenvolvimento
   - JSON estruturado em produção

2. **`apps/api/src/utils/errors.ts`** - Hierarquia completa de error classes
   - Erros específicos do domínio (BedNotFoundError, OrderNotFoundError, etc.)
   - Erros de validação (InvalidCPFError, ValidationError)
   - Erros de lógica de negócio (OrderBlockedError, BedOccupiedError)
   - Helper para converter erros do Prisma
   - Mensagens em português

3. **`apps/api/src/middleware/logging.ts`** - Middleware de logging HTTP
   - Request ID único para correlação
   - Logging de todas as requisições
   - Métricas de duração
   - Níveis de log baseados em status code

### Arquivos Modificados
4. **`apps/api/src/server.ts`** - Integração com nova infraestrutura
   - Removido logger do Fastify
   - Adicionado logging middleware
   - Atualizado error handling para usar logger centralizado

### Benefícios Implementados
- ✅ Logs consistentes em toda a aplicação
- ✅ Rastreamento de requisições via request-id
- ✅ Mensagens de erro amigáveis em português
- ✅ Melhor observabilidade do sistema
- ✅ Facilita debugging em produção

---

## Recomendações

### Implementar Agora (Alta Prioridade)
1. ✅ **`utils/logger.ts`** - Logger centralizado
2. ✅ **`utils/errors.ts`** - Error classes customizadas
3. ✅ **`middleware/logging.ts`** - Request logging

### Implementar Depois (Média Prioridade)
4. ⏸️ **`procedures/`** - Apenas quando houver lógica complexa duplicada entre routers

### Não Implementar
5. ❌ **`middleware/auth.ts`** - A autenticação via tRPC middleware é suficiente

---

## Plano de Verificação

### Testes Automatizados
Não existem testes unitários no projeto atualmente. A verificação será manual.

### Verificação Manual

#### 1. Logger
```bash
# Iniciar servidor
npm run dev:api

# Verificar logs estruturados no console
# Deve mostrar logs formatados com níveis (info, error, debug)
```

#### 2. Error Classes
```bash
# Testar erro de "leito não encontrado"
# Via frontend ou curl:
curl -X POST http://localhost:4000/trpc/leitos.updateStatus \
  -H "Content-Type: application/json" \
  -d '{"id": "invalid-id", "status": "DISPONIVEL"}'

# Deve retornar erro formatado com mensagem amigável
```

#### 3. Logging Middleware
```bash
# Fazer qualquer requisição à API
curl http://localhost:4000/health

# Verificar no console:
# - Request ID
# - Método HTTP
# - Path
# - Status code
# - Tempo de resposta
```

---

## Estrutura Final Esperada

```
apps/api/src/
├── middleware/
│   └── logging.ts          # ✅ Request logging
├── utils/
│   ├── jwt.ts              # ✅ Já existe
│   ├── logger.ts           # ✅ Novo
│   └── errors.ts           # ✅ Novo
├── procedures/             # ⏸️ Futuro (opcional)
│   └── orders/
│       └── releaseBlocked.ts
├── routers/                # ✅ Já existe
├── context.ts              # ✅ Já existe
├── trpc.ts                 # ✅ Já existe
└── server.ts               # ✅ Já existe (atualizar para usar logging middleware)
```

---

## Notas Importantes

> [!IMPORTANT]
> A implementação de `procedures/` é **OPCIONAL** e deve ser feita apenas quando:
> - Houver lógica duplicada entre routers
> - Funções com mais de 50 linhas de código
> - Necessidade de reutilização de lógica complexa

> [!NOTE]
> O `middleware/auth.ts` **NÃO** será implementado porque:
> - A autenticação via tRPC (`protectedProcedure`) já funciona perfeitamente
> - Adicionar outro middleware de autenticação seria redundante
> - tRPC já fornece type-safety e validação integrada

> [!TIP]
> O logger centralizado permitirá:
> - Logs consistentes em toda a aplicação
> - Fácil integração com serviços de monitoramento
> - Debugging mais eficiente em produção
