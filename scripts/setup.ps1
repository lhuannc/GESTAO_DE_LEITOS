# Script de inicialização completa do projeto - Windows PowerShell
# Este script configura o banco de dados, executa migrations e seeds

Write-Host "🚀 Iniciando setup do projeto Gestão de Leitos..." -ForegroundColor Cyan
Write-Host ""

# Função para verificar se um comando existe
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Verificar dependências
Write-Host "📋 Verificando dependências..." -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Host "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-Host "❌ npm não encontrado. Por favor, instale o npm primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js e npm encontrados" -ForegroundColor Green

# Verificar se Docker está rodando (opcional)
$dockerRunning = $false
if (Test-Command "docker") {
    try {
        docker ps | Out-Null
        $dockerRunning = $true
        Write-Host "✅ Docker está rodando" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Docker instalado mas não está rodando" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Docker não encontrado (opcional)" -ForegroundColor Yellow
}

Write-Host ""

# Perguntar se deseja usar Docker
$useDocker = $false
if ($dockerRunning) {
    $response = Read-Host "Deseja usar Docker para o PostgreSQL? (S/n)"
    $useDocker = ($response -eq "" -or $response -eq "S" -or $response -eq "s")
}

Write-Host ""
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# Configurar variáveis de ambiente
Write-Host "🔧 Configurando variáveis de ambiente..." -ForegroundColor Yellow

$envFile = ".env"
$databaseUrl = ""

if ($useDocker) {
    Write-Host "🐳 Iniciando PostgreSQL com Docker..." -ForegroundColor Cyan
    
    # Parar containers existentes
    docker-compose -f infra/docker/docker-compose.yml down 2>$null
    
    # Iniciar apenas o PostgreSQL
    docker-compose -f infra/docker/docker-compose.yml up -d postgres
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao iniciar PostgreSQL com Docker" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "⏳ Aguardando PostgreSQL inicializar..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Aguardar até que o PostgreSQL esteja pronto
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        docker exec gestao-leitos-db pg_isready -U postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ PostgreSQL está pronto!" -ForegroundColor Green
            break
        }
        $attempt++
        Start-Sleep -Seconds 1
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "❌ Timeout aguardando PostgreSQL" -ForegroundColor Red
        exit 1
    }
    
    $databaseUrl = "postgresql://postgres:postgres@localhost:5432/gestao_leitos"
} else {
    Write-Host "📝 Configure manualmente a URL do banco de dados PostgreSQL" -ForegroundColor Yellow
    $defaultUrl = "postgresql://postgres:postgres@localhost:5432/gestao_leitos"
    $userUrl = Read-Host "DATABASE_URL [$defaultUrl]"
    if ($userUrl) {
        $databaseUrl = $userUrl
    } else {
        $databaseUrl = $defaultUrl
    }
}

# Criar arquivo .env
$envContent = "DATABASE_URL=$databaseUrl`nNODE_ENV=development`nFRONTEND_URL=http://localhost:3000`nAPI_PORT=4000"
$envContent | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "✅ Arquivo .env criado" -ForegroundColor Green
Write-Host ""

# Executar Prisma migrations
Write-Host "🗄️  Executando migrations do Prisma..." -ForegroundColor Yellow
Set-Location packages/database

# Gerar Prisma Client
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao gerar Prisma Client" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# Executar migrations
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Erro ao executar migrations. Tentando criar o banco..." -ForegroundColor Yellow
    npx prisma db push --force-reset
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao criar banco de dados" -ForegroundColor Red
        Set-Location ../..
        exit 1
    }
}

Write-Host "✅ Migrations executadas" -ForegroundColor Green
Write-Host ""

# Executar seeds
Write-Host "🌱 Executando seeds..." -ForegroundColor Yellow
npx tsx src/seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao executar seeds" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Write-Host "✅ Seeds executados" -ForegroundColor Green
Set-Location ../..
Write-Host ""

# Resumo final
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 Setup concluído com sucesso!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Credenciais de acesso:" -ForegroundColor Yellow
Write-Host "   Admin: CPF 111.111.111-11 / Senha: admin" -ForegroundColor White
Write-Host "   Operacional: CPF 222.222.222-22 / Senha: operacional" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Para iniciar o projeto, execute:" -ForegroundColor Yellow
Write-Host "   npm run dev:all" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Ou inicie separadamente:" -ForegroundColor Yellow
Write-Host "   - API: npm run dev:api" -ForegroundColor Cyan
Write-Host "   - Web: npm run dev:web" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 URLs:" -ForegroundColor Yellow
Write-Host "   - Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   - API: http://localhost:4000" -ForegroundColor Cyan
if ($useDocker) {
    Write-Host "   - PostgreSQL: localhost:5432" -ForegroundColor Cyan
}
Write-Host ""
