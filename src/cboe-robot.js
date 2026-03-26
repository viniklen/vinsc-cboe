/**
 * VINSC INVEST — Robô CBOE
 * Playwright script que porta exatamente a lógica da extensão Chrome
 * Baixa: SPX, SPY, NDX, QQQ, VIX
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Configurações ────────────────────────────────────────────────
const ASSETS = ['spx', 'spy', 'ndx', 'qqq', 'vix'];
const CBOE_BASE = 'https://www.cboe.com/delayed_quotes/{ASSET}/quote_table';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'cboe');
const LOG_FILE = path.join(__dirname, '..', 'public', 'cboe', 'last_run.json');

// User-agents reais para parecer humano
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

// ── Helpers ──────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(ms);
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// Garante que a pasta de saída existe e limpa CSVs antigos
function prepareOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log(`Pasta criada: ${OUTPUT_DIR}`);
  }
  // Remove CSVs antigos
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.csv') && f !== 'last_run.json');
  files.forEach(f => {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
    log(`Removido arquivo antigo: ${f}`);
  });
}

// ── Automação por ativo (porta o runAutomation() da extensão) ────
async function downloadAsset(page, asset) {
  const url = CBOE_BASE.replace('{ASSET}', asset.toLowerCase());
  log(`[${asset.toUpperCase()}] Abrindo: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Aguarda React renderizar (igual ao sleep(8000) da extensão)
  log(`[${asset.toUpperCase()}] Aguardando React carregar (8s)...`);
  await sleep(8000);

  // ── 1. Options Range → All ──────────────────────────────────
  await setSelectToAll(page, asset, ['options range', 'opções disponíveis', 'opcoes disponiveis', 'disponiv'], 'Options Range');
  await randomDelay(800, 1500);

  // ── 2. Expiration → All ────────────────────────────────────
  await setSelectToAll(page, asset, ['expiration', 'validade', 'vencimento'], 'Expiration');
  await randomDelay(800, 1500);

  // ── 3. Clicar View Chain ───────────────────────────────────
  log(`[${asset.toUpperCase()}] Procurando botão View Chain...`);
  const chainBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn =
      btns.find(b => b.textContent.trim() === 'View Chain') ||
      btns.find(b => b.textContent.trim() === 'Ver cadeia') ||
      btns.find(b => b.textContent.toLowerCase().includes('view chain')) ||
      btns.find(b => b.textContent.toLowerCase().includes('ver cadeia'));
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!chainBtn) {
    throw new Error(`[${asset.toUpperCase()}] Botão View Chain não encontrado`);
  }
  log(`[${asset.toUpperCase()}] View Chain clicado. Aguardando tabela (14s)...`);
  await sleep(14000);

  // ── 4. Download CSV via interceptação de rede ──────────────
  log(`[${asset.toUpperCase()}] Procurando Download CSV...`);

  // Configura interceptação para capturar o arquivo CSV
  let csvContent = null;
  const csvFilename = `${asset.toLowerCase()}_quotedata.csv`;
  const csvPath = path.join(OUTPUT_DIR, csvFilename);

  // Intercepta qualquer resposta CSV
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('.csv') || resp.headers()['content-type']?.includes('text/csv'),
    { timeout: 30000 }
  ).catch(() => null);

  // Tenta clicar no botão Download CSV
  let dlClicked = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    dlClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a'));
      const dlBtn = all.find(el => el.textContent.trim().toLowerCase().includes('download csv'));
      const dlLink = document.querySelector('a[href*=".csv"], a[download]');
      const target = dlBtn || dlLink;
      if (target) { target.click(); return true; }
      return false;
    });
    if (dlClicked) break;
    await sleep(1000);
  }

  if (!dlClicked) {
    throw new Error(`[${asset.toUpperCase()}] Botão Download CSV não encontrado`);
  }

  log(`[${asset.toUpperCase()}] Download CSV clicado. Aguardando resposta...`);

  // Espera a resposta CSV interceptada
  const csvResponse = await responsePromise;
  if (csvResponse && csvResponse.ok()) {
    csvContent = await csvResponse.text();
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    const lines = csvContent.split('\n').length;
    log(`[${asset.toUpperCase()}] ✅ CSV salvo: ${csvFilename} (${lines} linhas)`);
    return { success: true, file: csvFilename, lines };
  }

  // Fallback: tenta ler arquivo via page.evaluate (link direto)
  const csvUrl = await page.evaluate(() => {
    const a = document.querySelector('a[href*=".csv"], a[download]');
    return a ? a.href : null;
  });

  if (csvUrl) {
    const resp = await page.request.get(csvUrl);
    if (resp.ok()) {
      csvContent = await resp.text();
      fs.writeFileSync(csvPath, csvContent, 'utf8');
      const lines = csvContent.split('\n').length;
      log(`[${asset.toUpperCase()}] ✅ CSV salvo via link direto: ${csvFilename} (${lines} linhas)`);
      return { success: true, file: csvFilename, lines };
    }
  }

  throw new Error(`[${asset.toUpperCase()}] Não foi possível capturar o CSV`);
}

// ── Abre/fecha um ReactSelect e seleciona "All" ──────────────────
async function setSelectToAll(page, asset, keywords, labelName) {
  const result = await page.evaluate(({ keywords, labelName }) => {
    function findControlByLabel(keywords) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const txt = node.textContent.trim();
        if (!txt) continue;
        if (keywords.some(k => txt.toLowerCase().includes(k.toLowerCase()))) {
          let el = node.parentElement;
          for (let depth = 0; depth < 8; depth++) {
            if (!el) break;
            const ctrl = el.querySelector('.ReactSelect__control');
            if (ctrl) return ctrl;
            el = el.parentElement;
          }
        }
      }
      return null;
    }

    const control = findControlByLabel(keywords);
    if (!control) return { found: false, msg: `Controle não achado para: ${labelName}` };

    const cur = control.querySelector('.ReactSelect__single-value');
    const curTxt = (cur ? cur.textContent.trim().toLowerCase() : '');
    if (curTxt === 'all' || curTxt === 'todos') {
      return { found: true, alreadyAll: true, msg: `"${labelName}" já está em All` };
    }

    const indicator = control.querySelector('.ReactSelect__dropdown-indicator');
    const target = indicator || control;
    ['mouseover', 'mouseenter'].forEach(e => target.dispatchEvent(new MouseEvent(e, { bubbles: true })));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, buttons: 1 }));
    target.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true, buttons: 1 }));
    target.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    return { found: true, alreadyAll: false, opened: true };
  }, { keywords, labelName });

  if (!result.found) {
    log(`[${asset.toUpperCase()}] ⚠️  ${result.msg}`);
    return;
  }
  if (result.alreadyAll) {
    log(`[${asset.toUpperCase()}] ✓ ${result.msg}`);
    return;
  }

  // Aguarda menu e clica em All/Todos
  await sleep(700);
  const clicked = await page.evaluate(({ labelName }) => {
    const menus = document.querySelectorAll('.ReactSelect__menu');
    if (!menus.length) return false;
    const menu = menus[menus.length - 1];
    const opts = Array.from(menu.querySelectorAll('.ReactSelect__option'));
    const allOpt = opts.find(o => {
      const t = o.textContent.trim().toLowerCase();
      return t === 'all' || t === 'todos';
    });
    if (!allOpt) return false;
    allOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, buttons: 1 }));
    allOpt.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true, buttons: 1 }));
    allOpt.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    return true;
  }, { labelName });

  if (clicked) {
    log(`[${asset.toUpperCase()}] ✅ "${labelName}" → All`);
  } else {
    log(`[${asset.toUpperCase()}] ⚠️  Opção "All" não encontrada para "${labelName}"`);
  }
}

// ── Runner principal ─────────────────────────────────────────────
async function run() {
  const startTime = Date.now();
  log('=== VINSC CBOE Robot iniciando ===');
  prepareOutputDir();

  const results = {};
  const ua = randomUserAgent();

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,720',
    ],
  });

  try {
    for (const asset of ASSETS) {
      const context = await browser.newContext({
        userAgent: ua,
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        // Simula comportamento humano
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });

      const page = await context.newPage();

      // Bloqueia recursos desnecessários (mais rápido e menos suspeito)
      await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}', route => route.abort());

      try {
        const result = await downloadAsset(page, asset);
        results[asset] = result;
      } catch (err) {
        log(`[${asset.toUpperCase()}] ❌ Erro: ${err.message}`);
        results[asset] = { success: false, error: err.message };
      } finally {
        await context.close();
      }

      // Delay humano entre ativos (3-8 segundos)
      if (asset !== ASSETS[ASSETS.length - 1]) {
        const delay = Math.floor(Math.random() * 5000) + 3000;
        log(`Aguardando ${(delay / 1000).toFixed(1)}s antes do próximo ativo...`);
        await sleep(delay);
      }
    }
  } finally {
    await browser.close();
  }

  // Salva log da última execução
  const summary = {
    timestamp: new Date().toISOString(),
    timestamp_br: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    duration_seconds: ((Date.now() - startTime) / 1000).toFixed(1),
    results,
    success_count: Object.values(results).filter(r => r.success).length,
    total: ASSETS.length,
  };
  fs.writeFileSync(LOG_FILE, JSON.stringify(summary, null, 2), 'utf8');

  const ok = summary.success_count;
  const total = summary.total;
  log(`=== Concluído: ${ok}/${total} ativos baixados em ${summary.duration_seconds}s ===`);

  if (ok === 0) {
    process.exit(1); // Falha total — GitHub Actions vai notificar
  }
}

run().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
