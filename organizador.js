/**
 * Organizador WhatsApp - VERSÃO FINAL (2025+ PRONTO)
 * Tudo salvo direto em ./fotos-organizadas
 * Sem subpastas de data · Protocolos futuros OK · Evita duplicatas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const readline = require('readline');

// ==================== CONFIGURAÇÃO ====================
const PASTA_ENTRADA = './para-processar';
const PASTA_SAIDA = './fotos-organizadas';
let HORAS = 24;
const MAX_INTERVALO_FOTOS = 5; // minutos
// ======================================================

// Validação inicial
if (!fs.existsSync(PASTA_ENTRADA)) {
  console.error(`Erro: Pasta "${PASTA_ENTRADA}" não encontrada!`);
  process.exit(1);
}
if (!fs.existsSync(PASTA_SAIDA)) fs.mkdirSync(PASTA_SAIDA, { recursive: true });

// Limpa nome inválido
function limparNome(t) {
  return t.replace(/[\/\\|*?"<>:]/g, '_')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 100) || 'sem-nome';
}

// Detecta protocolo (20231234567 ou 2023123456) - funciona até 2035+
function ehProtocolo(texto) {
  const num = texto.replace(/\D/g, '');
  return (num.length === 10 || num.length === 11) && /^202[3-9]\d+$/.test(num) || /^203[0-5]\d+$/.test(num) ? num : false;
}

// Evita pasta duplicada (ex: 20251234567 → 20251234567__2)
function pastaUnica(nome) {
  let novo = nome;
  let i = 1;
  while (fs.existsSync(path.join(PASTA_SAIDA, novo))) {
    novo = `${nome}__${i++}`;
  }
  return novo;
}

function processarZip(zipNome) {
  console.log(`\nProcessando: ${zipNome}`);
  const tempDir = path.join(PASTA_ENTRADA, 'temp_' + Date.now());
  let total = 0;

  try {
    new AdmZip(path.join(PASTA_ENTRADA, zipNome)).extractAllTo(tempDir, true);
  } catch (e) {
    console.error('Erro ao extrair ZIP:', e.message);
    return 0;
  }

  const txtFile = fs.readdirSync(tempDir).find(f => f.endsWith('.txt') && !f.includes('README'));
  if (!txtFile) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return 0;
  }

  const linhas = fs.readFileSync(path.join(tempDir, txtFile), 'utf8').split(/\r?\n/);
  const limite = Date.now() - HORAS * 3600000;
  const mensagens = [];

  for (const linha of linhas) {
    if (!linha.trim()) continue;

    const match = linha.match(/^(\d{2}\/\d{2}\/\d{4})[,\s]+(\d{2}:\d{2})\s*-\s*([^:]+?):\s*(.*)$/);
    if (match) {
      const [, data, hora, remetente, texto] = match;
      const [d, m, a] = data.split('/');
      const ts = new Date(`${a}-${m}-${d}T${hora}:00`).getTime();
      if (isNaN(ts) || ts < limite) continue;

      const limpo = texto.replace(/[\u200E\u200F\u202A-\u202E]/g, '');

      if (limpo.includes('arquivo anexado')) {
        const m = limpo.match(/([^\s]+\.(jpe?g|png|webp|mp4|mov))/i);
        if (m && fs.existsSync(path.join(tempDir, m[1]))) {
          mensagens.push({ tipo: 'midia', remetente, ts, arquivo: path.join(tempDir, m[1]), nome: m[1] });
        }
      } else if (limpo.trim()) {
        mensagens.push({ tipo: 'texto', remetente, ts, texto: limpo.trim() });
      }
    } else {
      const num = linha.trim();
      if (/^\d{10,11}$/.test(num) && ehProtocolo(num)) {
        mensagens.push({ tipo: 'protocolo', texto: num });
      }
    }
  }

  // Agrupar fotos sequenciais
  const grupos = [];
  let atual = null;

  for (const m of mensagens) {
    if (m.tipo === 'midia') {
      if (!atual || m.remetente !== atual.remetente || (m.ts - atual.ultimoTs) / 60000 > MAX_INTERVALO_FOTOS) {
        if (atual) grupos.push(atual);
        atual = { remetente: m.remetente, fotos: [], ultimoTs: m.ts, legenda: null };
      }
      atual.fotos.push(m);
      atual.ultimoTs = m.ts;
    } else if (atual && (m.tipo === 'texto' || m.tipo === 'protocolo')) {
      if (!atual.legenda || m.tipo === 'protocolo') atual.legenda = m.texto;
    }
  }
  if (atual) grupos.push(atual);

  // Salvar tudo direto na raiz
  grupos.forEach(g => {
    let legenda = g.legenda || '';
    if (legenda.includes('Mensagem apagada') || legenda.includes('.opus') || legenda.includes('arquivo anexado')) {
      legenda = '';
    }

    let nomePasta;
    const protocolo = ehProtocolo(legenda);
    if (protocolo) {
      nomePasta = pastaUnica(protocolo);
    } else if (legenda && legenda.length > 3 && !/^\d+$/.test(legenda.trim())) {
      nomePasta = pastaUnica(limparNome(legenda));
    } else {
      const data = new Date(g.fotos[0].ts);
      const hora = data.toTimeString().slice(0, 5).replace(':', 'h');
      const dataStr = data.toISOString().slice(0, 10); // 2025-11-28
      nomePasta = pastaUnica(`${hora}_${dataStr}`);
    }

    const destino = path.join(PASTA_SAIDA, nomePasta);
    fs.mkdirSync(destino, { recursive: true });

    g.fotos.forEach((f, i) => {
      const ext = path.extname(f.nome);
      const novo = g.fotos.length > 1 ? `${nomePasta}_${i + 1}${ext}` : `${nomePasta}${ext}`;
      fs.copyFileSync(f.arquivo, path.join(destino, novo));
      total++;
    });

    console.log(`  ${g.remetente} → ${nomePasta} (${g.fotos.length} foto${g.fotos.length > 1 ? 's' : ''})`);
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
  return total;
}

// =============== EXECUÇÃO ===============
console.log('========================================');
console.log('   ORGANIZADOR WHATSAPP - VERSÃO FINAL   ');
console.log('========================================\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(`Quantas horas atrás processar? (padrão ${HORAS}h): `, resp => {
  if (resp.trim() && !isNaN(resp)) HORAS = parseInt(resp);
  rl.close();

  const zips = fs.readdirSync(PASTA_ENTRADA).filter(f => f.toLowerCase().endsWith('.zip'));
  if (zips.length === 0) {
    console.log('Nenhum .zip encontrado em ./para-processar');
    return;
  }

  let totalGeral = 0;
  zips.forEach(z => totalGeral += processarZip(z));

  console.log('\n========================================');
  console.log(`PRONTO! ${totalGeral} arquivo(s) organizado(s)`);
  console.log(`Pasta: ${path.resolve(PASTA_SAIDA)}`);

  if (process.platform === 'win32') {
    execSync(`start "" "${path.resolve(PASTA_SAIDA)}"`);
  }
});