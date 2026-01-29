# 🚀 Backend Migration - Setup Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm 10+

---

## 📦 Installation

### 1. Install Dependencies

```bash
# Root
npm install

# Install API dependencies
npm install --workspace=apps/api

# Install Database dependencies  
npm install --workspace=packages/database

# Add bcrypt for password hashing
npm install bcrypt --workspace=apps/api
npm install -D @types/bcrypt --workspace=apps/api

# Add pino-pretty for logging
npm install pino-pretty --workspace=apps/api
```

### 2. Setup PostgreSQL

**Option A: Docker (Recommended)**

```bash
cd infra/docker
docker-compose up -d postgres
```

**Option B: Local Installation**

Install PostgreSQL 16 and create database:

```sql
CREATE DATABASE gestao_leitos;
```

### 3. Configure Environment

```bash
# Copy env files
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env

# Edit DATABASE_URL in both files
```

### 4. Run Migrations

```bash
# Generate Prisma Client
npm run db:generate --workspace=packages/database

# Run migrations
npm run db:migrate --workspace=packages/database

# Seed database
npm run db:seed --workspace=packages/database
```

---

## 🏃 Running

### Development

```bash
# Terminal 1: API Server
npm run dev --workspace=apps/api

# Terminal 2: Frontend (existing)
npm run dev --workspace=apps/web
```

### Production

```bash
# Build
npm run build --workspace=apps/api

# Start
npm start --workspace=apps/api
```

### Docker

```bash
cd infra/docker
docker-compose up -d
```

---

## 🧪 Testing

### Health Check

```bash
curl http://localhost:4000/health
```

### tRPC Endpoint

```bash
curl http://localhost:4000/trpc
```

### Login Test

```bash
curl -X POST http://localhost:4000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "11111111111",
    "password": "admin"
  }'
```

---

## 📝 Default Credentials

**Admin:**
- CPF: `111.111.111-11`
- Senha: `admin`

**Operacional:**
- CPF: `222.222.222-22`
- Senha: `operacional`

---

## 🔧 Useful Commands

```bash
# Prisma Studio (Database GUI)
npm run db:studio --workspace=packages/database

# Reset Database
npm run db:reset --workspace=packages/database

# View Logs
docker-compose logs -f api
```

---

## 📊 Database Schema

View the complete schema in:
`packages/database/prisma/schema.prisma`

---

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Setup PostgreSQL
3. ✅ Run migrations
4. ✅ Seed database
5. ✅ Start API server
6. 🔄 Integrate frontend with tRPC
7. 🔄 Test all endpoints
8. 🔄 Deploy to production
