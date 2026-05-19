# WhatsApp Media Organizer

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black) ![Licença](https://img.shields.io/badge/licença-MIT-green)

Ferramenta automatizada para organizar mídias exportadas do WhatsApp em pastas, com base nas legendas ou números de protocolo enviados com as fotos.

## Funcionalidades

- Processa arquivos ZIP exportados do WhatsApp
- Agrupa fotos do mesmo remetente em sequência
- Identifica protocolos numéricos nas legendas
- Organiza por data e legenda/protocolo
- Cria nomenclatura `data_hora` quando não há legenda

## Requisitos

- Node.js 18+
- `adm-zip` (instalado via `npm install`)

## Instalação

```bash
git clone https://github.com/ooshimakenji/WhatsApp-Media-Organizer.git
cd WhatsApp-Media-Organizer
npm install
```

## Uso

1. Coloque os ZIPs exportados do WhatsApp na pasta `./to-process`
2. Execute:

```bash
node organizer.js
```

3. Os arquivos organizados estarão em `./organized-photos`

## Configuração

No início do arquivo `organizer.js`:

```js
const INPUT_FOLDER = './to-process';
const OUTPUT_FOLDER = './organized-photos';
const MAX_PHOTO_INTERVAL = 5; // minutos entre fotos do mesmo grupo
```

## Licença

MIT
