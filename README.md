# WhatsApp Media Organizer

Ferramenta automatizada para organizar mídias exportadas do WhatsApp em pastas, baseado nas legendas ou números de protocolo enviados com as fotos.

## Funcionalidades

- Processa arquivos ZIP exportados do WhatsApp
- Agrupa fotos do mesmo remetente em sequência
- Identifica protocolos numéricos nas legendas
- Organiza por data e legenda/protocolo
- Cria nomenclatura `data_hora` quando não há legenda

## Requisitos

- Node.js
- `adm-zip` (`npm install adm-zip`)

## Uso

1. Coloque os ZIPs exportados do WhatsApp na pasta `./to-process`
2. Execute:

```bash
node ornganizer.js
```

3. Os arquivos organizados estarão em `./organized-photos`

## Configuração

No início do arquivo `ornganizer.js`:

```js
const INPUT_FOLDER = './to-process';
const OUTPUT_FOLDER = './organized-photos';
const MAX_PHOTO_INTERVAL = 5; // minutos entre fotos do mesmo grupo
```

## Licença

MIT
