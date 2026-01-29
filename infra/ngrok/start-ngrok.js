import ngrok from 'ngrok';

async function startNgrok() {
  try {
    // Configurar authtoken primeiro
    await ngrok.authtoken('2cKO3nnG8qfS1gFJmJtSQDn576y_4BkwT2sEmnWHTjt5pr3BM');
    
    // Iniciar túnel na porta 3000 (porta do Vite)
    const url = await ngrok.connect({
      addr: 3000,
      authtoken: '2cKO3nnG8qfS1gFJmJtSQDn576y_4BkwT2sEmnWHTjt5pr3BM'
    });
    
    console.log('\n🚀 Ngrok iniciado com sucesso!');
    console.log(`📱 Acesse sua aplicação em: ${url}`);
    console.log(`\n⚠️  Mantenha este terminal aberto enquanto usar o ngrok.`);
    console.log(`   Pressione Ctrl+C para parar o túnel.\n`);
    
    // Manter o processo rodando
    process.on('SIGINT', async () => {
      await ngrok.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar ngrok:', error.message);
    process.exit(1);
  }
}

startNgrok();
