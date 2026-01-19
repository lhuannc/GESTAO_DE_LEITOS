import ngrok from 'ngrok';

// Configurar authtoken
async function setupNgrok() {
  try {
    await ngrok.authtoken('2cKO3nnG8qfS1gFJmJtSQDn576y_4BkwT2sEmnWHTjt5pr3BM');
    console.log('✅ Authtoken do ngrok configurado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao configurar authtoken:', error);
  }
}

setupNgrok();
