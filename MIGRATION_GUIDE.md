# 🔄 Guia de Migração para SQLite com Backend

Este guia explica como migrar da versão anterior (sql.js no navegador) para a nova arquitetura com SQLite local e backend Node.js.

## 📋 Pré-requisitos

- Node.js instalado
- Dados existentes no localStorage (se aplicável)

## 🚀 Passos da Migração

### 1. Instalar Dependências

```bash
npm install
```

Isso instalará as novas dependências:
- `better-sqlite3` - SQLite nativo
- `express` - Servidor HTTP
- `cors` - Middleware CORS
- `concurrently` - Executar frontend e backend simultaneamente

### 2. Migrar Dados Existentes (Opcional)

Se você já possui dados salvos no localStorage:

#### Opção A: Usando o Script HTML (Recomendado)

1. Abra o arquivo `export-localstorage-data.html` no navegador onde você usa a aplicação
2. Clique no botão "Exportar Dados"
3. O arquivo `data-export.json` será baixado automaticamente
4. Salve o arquivo na raiz do projeto (mesmo diretório do `package.json`)
5. Execute:

```bash
npm run migrate
```

#### Opção B: Script Manual no Console do Navegador

1. Abra a aplicação no navegador
2. Abra o Console (F12)
3. Execute o código fornecido no `migrate-data.js`
4. Salve o JSON exportado como `data-export.json` na raiz do projeto
5. Execute:

```bash
npm run migrate
```

### 3. Iniciar a Aplicação

```bash
npm run dev
```

Isso iniciará:
- **Backend** na porta 3001 (SQLite + Express)
- **Frontend** na porta 3000 (Vite)

O Vite está configurado para fazer proxy das chamadas `/api` para o backend.

## 📁 Estrutura do Banco de Dados

O banco SQLite é criado automaticamente em:
```
data/gestao_leitos.db
```

### Tabelas Criadas

1. **companies** - Empresas
2. **units** - Unidades
3. **sectors** - Setores
4. **beds** - Leitos
5. **services** - Tipos de serviço
6. **actions** - Ações/Status
7. **users** - Usuários (com coluna `faceDescriptor` para biometria facial)
8. **teams** - Equipes
9. **complement_items** - Itens complementares
10. **service_orders** - Ordens de serviço
11. **service_order_history** - Histórico completo de etapas das OS

## 🔧 Alterações Técnicas

### Backend (server.js)

- Servidor Express na porta 3001
- Banco SQLite usando `better-sqlite3`
- Endpoints REST para todas as operações
- Seed automático de dados iniciais se o banco estiver vazio
- Suporte completo para `faceDescriptor` (biometria facial)

### Frontend (backend.ts)

- Agora faz chamadas HTTP ao backend ao invés de usar sql.js diretamente
- Mantém a mesma interface, então nenhum componente precisa mudar

### Database (database.ts)

- Mantido apenas para compatibilidade
- Não é mais usado pela aplicação principal

## ✅ Verificação

Após a migração, verifique:

1. ✅ O servidor backend está rodando na porta 3001
2. ✅ O frontend está rodando na porta 3000
3. ✅ Os dados foram importados corretamente
4. ✅ O login funciona
5. ✅ A gravação de `faceDescriptor` funciona
6. ✅ As ordens de serviço são criadas e atualizadas corretamente

## 🐛 Solução de Problemas

### Erro: "Cannot find module 'better-sqlite3'"

```bash
npm install better-sqlite3
```

**Windows**: Pode ser necessário instalar ferramentas de build:
```bash
npm install --global windows-build-tools
```

### Erro: "Port 3001 already in use"

Altere a porta no `server.js`:
```javascript
const PORT = process.env.PORT || 3002; // Use outra porta
```

### Dados não foram migrados

1. Verifique se o arquivo `data-export.json` está na raiz do projeto
2. Verifique se há dados no localStorage do navegador
3. Execute `npm run migrate` novamente

### Erro ao gravar faceDescriptor

Verifique:
1. O limite de tamanho do JSON no Express está configurado (50mb)
2. O campo `faceDescriptor` está sendo serializado corretamente (JSON.stringify)

## 📝 Notas Importantes

- **Backup**: Sempre faça backup dos dados antes de migrar
- **LocalStorage**: Os dados antigos no localStorage não são deletados automaticamente
- **Banco de Dados**: O arquivo `data/gestao_leitos.db` é criado automaticamente
- **Gitignore**: O diretório `data/` está no `.gitignore` para não versionar o banco

## 🔄 Reverter para Versão Anterior

Se precisar reverter temporariamente:

1. Restaure o código do `backend.ts` e `database.ts` anteriores
2. Desinstale as dependências do backend:
```bash
npm uninstall better-sqlite3 express cors concurrently
```

A aplicação voltará a usar sql.js no navegador.
