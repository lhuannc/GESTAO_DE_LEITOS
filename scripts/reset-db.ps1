# Script para resetar o banco de dados e executar seeds novamente

Write-Host "🔄 Resetando banco de dados..." -ForegroundColor Cyan
Write-Host ""

$confirmation = Read-Host "⚠️  ATENÇÃO: Isso irá apagar TODOS os dados do banco. Confirma? (digite 'SIM' para confirmar)"

if ($confirmation -ne "SIM") {
    Write-Host "❌ Operação cancelada" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🗄️  Resetando banco de dados..." -ForegroundColor Yellow
Write-Host ""

Set-Location packages/database

# Reset do banco
npx prisma migrate reset --force

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao resetar banco de dados" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

Write-Host ""
Write-Host "✅ Banco resetado e seeds executados" -ForegroundColor Green
Set-Location ../..

Write-Host ""
Write-Host "🎉 Processo concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Credenciais de acesso:" -ForegroundColor Yellow
Write-Host "   Admin: CPF 111.111.111-11 / Senha: admin" -ForegroundColor White
Write-Host "   Operacional: CPF 222.222.222-22 / Senha: operacional" -ForegroundColor White
Write-Host ""
