# Configuração do Ngrok para HTTPS

O ngrok permite criar um túnel HTTPS para sua aplicação local, resolvendo problemas de acesso à câmera em dispositivos móveis.

## Configuração Inicial (Uma vez)

Execute o comando para configurar o authtoken:

```bash
npm run ngrok:setup
```

Ou manualmente:

```bash
ngrok config add-authtoken 2cKO3nnG8qfS1gFJmJtSQDn576y_4BkwT2sEmnWHTjt5pr3BM
```

## Uso

### Opção 1: Iniciar Vite e Ngrok juntos (Recomendado)

```bash
npm run dev:ngrok
```

Isso iniciará o servidor Vite na porta 3000 e o ngrok automaticamente.

### Opção 2: Iniciar separadamente

**Terminal 1 - Iniciar Vite:**
```bash
npm run dev
```

**Terminal 2 - Iniciar Ngrok:**
```bash
npm run ngrok:start
```

Ou manualmente:
```bash
ngrok http 3000
```

## Acessar a Aplicação

Após iniciar o ngrok, você verá uma URL HTTPS como:
```
https://xxxx-xxxx-xxxx.ngrok-free.app
```

Use esta URL para acessar a aplicação em qualquer dispositivo (PC, mobile, tablet).

## Vantagens do HTTPS

✅ Câmera funciona sem configurações especiais do navegador
✅ Funciona em todos os dispositivos móveis
✅ Não precisa configurar flags do navegador
✅ Mais seguro para desenvolvimento

## Notas

- Mantenha o terminal do ngrok aberto enquanto usar a aplicação
- A URL do ngrok muda a cada reinicialização (na versão gratuita)
- Para URL fixa, considere upgrade do plano ngrok
