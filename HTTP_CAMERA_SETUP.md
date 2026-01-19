# Como Habilitar Câmera em HTTP (Ambiente de Desenvolvimento)

Para que a câmera funcione em HTTP durante o desenvolvimento, você precisa configurar o navegador para permitir acesso à câmera em origens inseguras.

## Chrome / Edge (Chromium)

1. Abra o Chrome/Edge
2. Acesse: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. Adicione o endereço HTTP do seu servidor (ex: `http://192.168.1.100:3000`)
4. Marque a opção como **Enabled**
5. Reinicie o navegador

**Alternativa via linha de comando:**
```bash
chrome.exe --unsafely-treat-insecure-origin-as-secure=http://192.168.1.100:3000 --user-data-dir="C:/temp/chrome_dev"
```

## Firefox

1. Abra o Firefox
2. Acesse: `about:config`
3. Aceite o aviso de risco
4. Procure por: `media.getusermedia.insecure.enabled`
5. Defina como **true**
6. Reinicie o navegador

**Alternativa via linha de comando:**
```bash
firefox.exe -profile "C:/temp/firefox_dev" --setpref "media.getusermedia.insecure.enabled=true"
```

## Safari (iOS/macOS)

Safari não permite câmera em HTTP por padrão. Use uma das opções:
- Acesse via HTTPS (recomendado)
- Use o IP local da máquina (pode funcionar em alguns casos)
- Use Chrome ou Firefox no dispositivo

## Mobile (Android/iOS)

### Android (Chrome)
1. Abra o Chrome
2. Acesse: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
3. Adicione o endereço HTTP
4. Reinicie o navegador

### iOS (Safari)
Safari no iOS não permite câmera em HTTP. Use:
- Chrome ou Firefox no iOS
- Ou configure HTTPS local

## Solução Alternativa: Túnel HTTPS Local

Se não conseguir habilitar HTTP, use um túnel HTTPS:

### Usando ngrok:
```bash
npm install -g ngrok
ngrok http 3000
```
Use a URL HTTPS fornecida pelo ngrok.

### Usando localtunnel:
```bash
npm install -g localtunnel
lt --port 3000
```

## Nota de Segurança

⚠️ **IMPORTANTE**: Essas configurações são apenas para desenvolvimento. Em produção, sempre use HTTPS.
