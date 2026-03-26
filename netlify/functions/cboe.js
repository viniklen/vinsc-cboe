/**
 * VINSC INVEST — API CBOE
 * Endpoint: /api/cboe?asset=spx
 * Lê o CSV do repositório e retorna JSON para o site e NinjaTrader
 */

const fs = require('fs');
const path = require('path');

// ── Parser CSV da CBOE ───────────────────────────────────────────
function parseCboeCsv(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { meta: {}, calls: [], puts: [] };

  // A CBOE tem uma linha de meta no topo (ex: "SPX,3900,...")
  // e depois o cabeçalho e os dados
  const metaLine = lines[0];
  const headerLine = lines.find(l => l.toLowerCase().includes('expiration') || l.toLowerCase().includes('strike'));
  const headerIdx = lines.indexOf(headerLine);

  if (!headerLine) return { meta: { raw_first_line: metaLine }, calls: [], puts: [], raw_lines: lines.length };

  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] || '';
    });
    rows.push(row);
  }

  // Separa calls e puts (CBOE: colunas separadas por strike)
  // Identifica índice do Strike
  const strikeCol = headers.find(h => h.toLowerCase() === 'strike' || h.toLowerCase() === 'strikes');

  return {
    meta: {
      first_line: metaLine,
      headers,
      total_rows: rows.length,
    },
    rows,
    strike_col: strikeCol || 'Strike',
  };
}

// ── Handler da Netlify Function ──────────────────────────────────
exports.handler = async (event) => {
  // CORS — permite acesso do NinjaTrader e de qualquer origem
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // Parâmetros
  const params = event.queryStringParameters || {};
  const asset = (params.asset || params.symbol || 'spx').toLowerCase().replace(/[^a-z]/g, '');
  const validAssets = ['spx', 'spy', 'ndx', 'qqq', 'vix'];

  if (!validAssets.includes(asset)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Ativo inválido. Use: spx, spy, ndx, qqq, vix',
        valid: validAssets,
      }),
    };
  }

  // Localiza o CSV
  // No Netlify, os arquivos do repositório ficam disponíveis no filesystem
  const csvPaths = [
    path.join(process.cwd(), 'public', 'cboe', `${asset}_quotedata.csv`),
    path.join(__dirname, '..', '..', 'public', 'cboe', `${asset}_quotedata.csv`),
  ];

  let csvText = null;
  let csvPath = null;
  for (const p of csvPaths) {
    if (fs.existsSync(p)) {
      csvText = fs.readFileSync(p, 'utf8');
      csvPath = p;
      break;
    }
  }

  if (!csvText) {
    // Lê o log para saber quando foi a última tentativa
    let lastRun = null;
    const logPaths = csvPaths.map(p => path.join(path.dirname(p), 'last_run.json'));
    for (const lp of logPaths) {
      if (fs.existsSync(lp)) {
        try { lastRun = JSON.parse(fs.readFileSync(lp, 'utf8')); } catch {}
        break;
      }
    }
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `CSV não encontrado para ${asset.toUpperCase()}. O robô ainda não executou ou houve falha.`,
        last_run: lastRun,
        asset,
      }),
    };
  }

  // Parseia e retorna
  try {
    const parsed = parseCboeCsv(csvText);

    // Lê metadados da última execução
    let lastRun = null;
    if (csvPath) {
      const logPath = path.join(path.dirname(csvPath), 'last_run.json');
      if (fs.existsSync(logPath)) {
        try { lastRun = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch {}
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300', // cache 5 min
      },
      body: JSON.stringify({
        asset: asset.toUpperCase(),
        updated_at: lastRun?.timestamp || null,
        updated_at_br: lastRun?.timestamp_br || null,
        data: parsed,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Erro ao parsear CSV: ' + err.message }),
    };
  }
};
