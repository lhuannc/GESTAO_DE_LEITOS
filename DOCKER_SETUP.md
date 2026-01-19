# Configuração Docker

Este projeto inclui configuração Docker para facilitar o desenvolvimento e deploy.

## Pré-requisitos

- Docker instalado
- Docker Compose instalado

## Uso

### Produção (Build e Servir com Nginx)

Para construir e executar a aplicação em modo de produção:

```bash
docker-compose up --build
```

A aplicação estará disponível em `http://localhost:3000`

### Desenvolvimento (Hot Reload com Vite)

Para executar em modo de desenvolvimento com hot reload:

```bash
docker-compose --profile dev up app-dev --build
```

A aplicação estará disponível em `http://localhost:3000` com hot reload ativado.

### Comandos Úteis

**Parar os containers:**
```bash
docker-compose down
```

**Parar e remover volumes:**
```bash
docker-compose down -v
```

**Ver logs:**
```bash
docker-compose logs -f
```

**Rebuild sem cache:**
```bash
docker-compose build --no-cache
```

**Executar comandos dentro do container:**
```bash
docker-compose exec app sh
```

## Estrutura

- `Dockerfile`: Build de produção multi-stage (Node.js + Nginx)
- `Dockerfile.dev`: Build de desenvolvimento com hot reload
- `docker-compose.yml`: Orquestração dos serviços
- `nginx.conf`: Configuração do Nginx para SPA
- `.dockerignore`: Arquivos excluídos do build

## Notas

- O modo de desenvolvimento monta o código como volume para hot reload
- O modo de produção otimiza a imagem usando multi-stage build
- A porta padrão é 3000, mas pode ser alterada no `docker-compose.yml`
