@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Setup do Projeto Gestao de Leitos
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    exit /b 1
)

REM Verificar npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] npm nao encontrado. Por favor, instale o npm primeiro.
    exit /b 1
)

echo [OK] Node.js e npm encontrados
echo.

REM Verificar Docker
set DOCKER_AVAILABLE=0
where docker >nul 2>nul
if not errorlevel 1 (
    docker ps >nul 2>nul
    if not errorlevel 1 (
        set DOCKER_AVAILABLE=1
        echo [OK] Docker esta rodando
    ) else (
        echo [AVISO] Docker instalado mas nao esta rodando
    )
) else (
    echo [AVISO] Docker nao encontrado
)

echo.

REM Perguntar se deseja usar Docker
set USE_DOCKER=n
if "!DOCKER_AVAILABLE!"=="1" (
    set /p USE_DOCKER="Deseja usar Docker para o PostgreSQL? (S/n): "
    if "!USE_DOCKER!"=="" set USE_DOCKER=S
)

echo.
echo [INFO] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias
    exit /b 1
)
echo [OK] Dependencias instaladas
echo.

echo [INFO] Configurando variaveis de ambiente...

set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gestao_leitos

REM Verificar se deve usar Docker
echo Verificando USE_DOCKER: !USE_DOCKER!
if /i "!USE_DOCKER!"=="S" goto USE_DOCKER_SETUP
if /i "!USE_DOCKER!"=="s" goto USE_DOCKER_SETUP
goto MANUAL_SETUP

:USE_DOCKER_SETUP
echo [INFO] Iniciando PostgreSQL com Docker...

REM Parar containers existentes
docker-compose -f infra\docker\docker-compose.yml down >nul 2>nul

REM Iniciar apenas o PostgreSQL
docker-compose -f infra\docker\docker-compose.yml up -d postgres
if errorlevel 1 (
    echo [ERRO] Falha ao iniciar PostgreSQL com Docker
    exit /b 1
)

echo [INFO] Aguardando PostgreSQL inicializar...
timeout /t 5 /nobreak >nul

REM Aguardar PostgreSQL ficar pronto
set ATTEMPT=0
:WAIT_POSTGRES
docker exec gestao-leitos-db pg_isready -U postgres >nul 2>nul
if not errorlevel 1 (
    echo [OK] PostgreSQL esta pronto!
    goto CREATE_ENV
)
set /a ATTEMPT+=1
if !ATTEMPT! GEQ 30 (
    echo [ERRO] Timeout aguardando PostgreSQL
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_POSTGRES

:MANUAL_SETUP
echo [INFO] Configure manualmente a URL do banco de dados PostgreSQL
set /p CUSTOM_URL="DATABASE_URL [!DATABASE_URL!]: "
if not "!CUSTOM_URL!"=="" set DATABASE_URL=!CUSTOM_URL!
goto CREATE_ENV

:CREATE_ENV
echo DATABASE_URL=!DATABASE_URL!> .env
echo NODE_ENV=development>> .env
echo FRONTEND_URL=http://localhost:3000>> .env
echo API_PORT=4000>> .env

echo [OK] Arquivo .env criado
echo.

REM Executar Prisma migrations
echo [INFO] Executando migrations do Prisma...
cd packages\database

REM Gerar Prisma Client
call npx prisma generate
if errorlevel 1 (
    echo [ERRO] Falha ao gerar Prisma Client
    cd ..\..
    exit /b 1
)

REM Criar schema no banco de dados
echo [INFO] Criando schema no banco de dados...
echo y| call npx prisma db push
if errorlevel 1 (
    echo [ERRO] Falha ao criar schema no banco de dados
    cd ..\..
    exit /b 1
)

echo [OK] Migrations executadas
echo.

REM Executar seeds
echo [INFO] Executando seeds...
call npx tsx src\seed.ts
if errorlevel 1 (
    echo [ERRO] Falha ao executar seeds
    cd ..\..
    exit /b 1
)

echo [OK] Seeds executados
cd ..\..
echo.

REM Resumo final
echo ========================================
echo   Setup concluido com sucesso!
echo ========================================
echo.
echo Credenciais de acesso:
echo   Admin: CPF 111.111.111-11 / Senha: admin
echo   Operacional: CPF 222.222.222-22 / Senha: operacional
echo.
echo Para iniciar o projeto, execute:
echo   npm run dev:all
echo.
echo Ou inicie separadamente:
echo   - API: npm run dev:api
echo   - Web: npm run dev:web
echo.
echo URLs:
echo   - Frontend: http://localhost:3000
echo   - API: http://localhost:4000
if /i "!USE_DOCKER!"=="S" echo   - PostgreSQL: localhost:5432
if /i "!USE_DOCKER!"=="s" echo   - PostgreSQL: localhost:5432
echo.
pause
