<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1aXTkQb_EnUXVSnxLv3NMxpxNd9k0gpBp

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Banco de Dados SQLite

O projeto agora utiliza SQLite para armazenamento de dados ao invés de localStorage. O banco de dados é inicializado automaticamente na primeira execução e os dados são salvos no localStorage do navegador em formato base64.

### Estrutura do Banco

O banco SQLite contém as seguintes tabelas:
- `companies` - Empresas
- `units` - Unidades
- `sectors` - Setores
- `beds` - Leitos
- `services` - Tipos de serviço
- `actions` - Ações/Status
- `users` - Usuários
- `teams` - Equipes
- `complement_items` - Itens complementares
- `service_orders` - Ordens de serviço

### Funcionalidades

- Inicialização automática do banco na primeira execução
- Migração automática de dados iniciais
- Persistência no localStorage do navegador
- Todas as operações CRUD funcionam com SQLite
- Backup automático a cada operação de escrita
