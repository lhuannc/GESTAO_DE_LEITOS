# Web Module - Agent Documentation

## 📋 Responsabilidades

### Core
- Interface de usuário com **React**
- Comunicação com API via **tRPC**
- Gerenciamento de estado com **React Query**
- Autenticação e autorização no frontend
- Validação de formulários

### Funcionalidades
- **Login**: Autenticação com CPF/senha
- **Dashboard**: Visão geral e operacional
- **Solicitar**: Criar ordens de serviço
- **Ordens (Kanban)**: Gerenciar ordens em andamento
- **Pesquisa de Ações**: Histórico e busca
- **Cadastros**: Gerenciar dados do sistema (admin)

---

## 🏗️ Arquitetura

```
apps/web/
├── src/
│   ├── components/          # Componentes React
│   │   ├── Login.tsx        # Autenticação ✅
│   │   ├── Dashboard.tsx    # Dashboard geral
│   │   ├── DashboardOperacional.tsx
│   │   ├── ServiceRequestForm.tsx  # Criar ordens ✅
│   │   ├── ServiceOrdersKanban.tsx # Kanban
│   │   ├── ActionsList.tsx  # Pesquisa
│   │   └── RegistrationManager.tsx # Cadastros
│   │
│   ├── contexts/            # React Contexts
│   │   └── AuthContext.tsx  # Autenticação ✅
│   │
│   ├── lib/                 # Bibliotecas e utils
│   │   └── trpc.ts          # Cliente tRPC ✅
│   │
│   ├── App.tsx              # Componente principal ✅
│   ├── index.tsx            # Entry point ✅
│   └── index.css            # Estilos globais
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── agent.md                 # Este arquivo
```

---

## 📝 Padrões de Código

### 1. Uso do tRPC

**Queries (buscar dados)**

```typescript
import { trpc } from '../lib/trpc';

function MyComponent() {
  const { data: beds = [], isLoading } = trpc.leitos.list.useQuery(undefined, {
    enabled: !!currentUser, // Só busca se usuário logado
  });

  if (isLoading) return <div>Carregando...</div>;

  return <div>{beds.map(bed => ...)}</div>;
}
```

**Mutations (criar/atualizar/deletar)**

```typescript
const createOrderMutation = trpc.orders.create.useMutation({
  onSuccess: () => {
    // Refetch queries
    queryClient.invalidateQueries(['orders']);
    // Reset form
    setFormData({});
  },
  onError: (error) => {
    alert(`Erro: ${error.message}`);
  },
});

const handleSubmit = () => {
  createOrderMutation.mutate({
    bedId: selectedBedId,
    serviceTypeId: selectedServiceId,
  });
};
```

### 2. Autenticação

**Usar AuthContext**

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { currentUser, logout } = useAuth();

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div>
      <p>Olá, {currentUser.name}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

**Verificar permissões**

```typescript
// Admin
if (currentUser.permissions.isAdmin) {
  return <AdminPanel />;
}

// Membro de equipe
const isTeamMember = teams.some(t => t.userIds.includes(currentUser.id));
if (isTeamMember) {
  return <KanbanView />;
}
```

### 3. Formatação de Dados

**Limpar CPF antes de enviar**

```typescript
// ✅ CORRETO
const cleanCpf = cpf.replace(/\D/g, ''); // Remove pontos e traços
loginMutation.mutate({ cpf: cleanCpf, password });

// ❌ ERRADO
loginMutation.mutate({ cpf: '111.111.111-11', password }); // Vai falhar
```

**Formatar datas**

```typescript
const formattedDate = new Date(order.createdAt).toLocaleDateString('pt-BR');
```

### 4. Loading States

**Usar estados do React Query**

```typescript
const { data, isLoading, isError, error } = trpc.leitos.list.useQuery();

if (isLoading) return <Loader />;
if (isError) return <Error message={error.message} />;

return <DataDisplay data={data} />;
```

**Mutations**

```typescript
<button 
  disabled={createMutation.isPending}
  onClick={() => createMutation.mutate(data)}
>
  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
</button>
```

---

## 🔐 Regras de Autenticação

### Fluxo de Login

1. Usuário digita CPF e senha
2. Frontend limpa CPF (remove formatação)
3. Chama `trpc.auth.login.useMutation()`
4. Backend valida e retorna `{ user, token }`
5. Frontend salva `userId` no localStorage
6. Frontend salva `user` no AuthContext
7. Todas as requests incluem header `x-user-id`

### Persistência

```typescript
// Salvar no login
localStorage.setItem('userId', user.id);
localStorage.setItem('gestao_leitos_session', JSON.stringify(user));

// Carregar ao iniciar app
const savedUser = localStorage.getItem('gestao_leitos_session');
if (savedUser) {
  setCurrentUser(JSON.parse(savedUser));
}

// Limpar no logout
localStorage.removeItem('userId');
localStorage.removeItem('gestao_leitos_session');
```

---

## 📊 Estrutura de Dados

### User (Frontend)

```typescript
interface User {
  id: string;
  name: string;
  cpf: string;
  companyId: string;
  permissions: {
    isAdmin: boolean;
    pages: string[];
    modules: string[];
  };
}
```

> **Nota:** Backend retorna `role` (ADMIN/OPERACIONAL/VISUALIZADOR), mas transforma em `permissions.isAdmin` para o frontend.

### Bed

```typescript
interface Bed {
  id: string;
  name: string;
  sectorId: string;
  status: BedStatus; // Dinâmico, definido em BedStatusConfig
}
```

### ServiceOrder

```typescript
interface ServiceOrder {
  id: string;
  bedId: string;
  serviceTypeId: string;
  requestedById: string;
  assignedToId?: string;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
  priority: number;
  notes?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

---

## 🎨 Padrões de UI

### Tailwind CSS

**Usar classes utilitárias**

```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
  <h2 className="text-xl font-bold text-slate-800 mb-4">Título</h2>
  <p className="text-sm text-slate-600">Descrição</p>
</div>
```

### Ícones (Lucide React)

```tsx
import { ClipboardCheck, ArrowRight, Loader2 } from 'lucide-react';

<ClipboardCheck size={24} className="text-sky-600" />
```

### Botões

```tsx
// Primary
<button className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl">
  Confirmar
</button>

// Disabled
<button 
  disabled={isLoading}
  className="disabled:bg-slate-300 disabled:text-slate-500"
>
  {isLoading ? 'Carregando...' : 'Salvar'}
</button>
```

---

## 🧪 Testing (Futuro)

```typescript
import { render, screen } from '@testing-library/react';
import { Login } from './Login';

test('should render login form', () => {
  render(<Login onLoginSuccess={jest.fn()} />);
  expect(screen.getByText('Login')).toBeInTheDocument();
});
```

---

## 📦 Dependências

### Core
- `react` - UI library
- `@trpc/client` - tRPC client
- `@trpc/react-query` - React Query integration
- `@tanstack/react-query` - Data fetching/caching
- `@gestao-leitos/types` - Tipos compartilhados

### UI
- `lucide-react` - Ícones
- `tailwindcss` - Estilos

### Dev
- `vite` - Build tool
- `typescript` - Type checking
- `@vitejs/plugin-react` - React plugin

---

## 🔧 Configuração

### Environment Variables

```env
# API URL
VITE_API_URL=http://localhost:4000
```

### tRPC Client

```typescript
// lib/trpc.ts
export const trpc = createTRPCReact<AppRouter>();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:4000/trpc',
      headers() {
        const userId = localStorage.getItem('userId');
        return userId ? { 'x-user-id': userId } : {};
      },
    }),
  ],
});
```

---

## ✅ Checklist de Review

Antes de fazer PR, verificar:

- [ ] Todos os dados vêm de queries tRPC (não SQLite)
- [ ] Mutations invalidam queries após sucesso
- [ ] Loading states implementados
- [ ] Error handling apropriado
- [ ] Formatação de dados (CPF, datas, etc.)
- [ ] Permissões verificadas
- [ ] Sem console.logs
- [ ] Type-safety verificado

---

## 🎯 Status Atual

### ✅ Implementado
- Cliente tRPC configurado
- AuthContext para autenticação
- Login com validação de CPF
- Dashboard com dados do PostgreSQL
- Criação de ordens (com steps, itens e dependências)
- Queries para: leitos, orders, services, users, teams

### 🔄 Em Progresso
- Kanban drag & drop (mutation existe, falta integrar)
- RegistrationManager CRUD (routers existem, falta integrar)

### 📋 Pendente
- Queries para: companies, units, sectors, actions, complementItems
- Testes automatizados
- Error boundaries

---

## 🚀 Próximos Passos

1. Implementar Kanban drag & drop
2. Implementar RegistrationManager CRUD
3. Completar ServiceRequestForm
4. Adicionar error boundaries
5. Implementar testes
