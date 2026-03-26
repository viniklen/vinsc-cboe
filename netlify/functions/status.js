/**
 * VINSC INVEST — API Status
 * Endpoint: /api/status
 * Retorna o status da última execução do robô
 */

const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  const logPaths = [
    path.join(process.cwd(), 'public', 'cboe', 'last_run.json'),
    path.join(__dirname, '..', '..', 'public', 'cboe', 'last_run.json'),
  ];

  let lastRun = null;
  for (const lp of logPaths) {
    if (fs.existsSync(lp)) {
      try { lastRun = JSON.parse(fs.readFileSync(lp, 'utf8')); } catch {}
      break;
    }
  }

  const assets = ['spx', 'spy', 'ndx', 'qqq', 'vix'];
  const csvStatus = {};
  for (const asset of assets) {
    const csvPaths = [
      path.join(process.cwd(), 'public', 'cboe', `${asset}_quotedata.csv`),
      path.join(__dirname, '..', '..', 'public', 'cboe', `${asset}_quotedata.csv`),
    ];
    let found = false;
    let size = 0;
    for (const p of csvPaths) {
      if (fs.existsSync(p)) {
        found = true;
        size = fs.statSync(p).size;
        break;
      }
    }
    csvStatus[asset] = { available: found, size_bytes: size };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      service: 'VINSC CBOE Data Service',
      last_run: lastRun,
      files: csvStatus,
      endpoints: {
        spx: '/api/cboe?asset=spx',
        spy: '/api/cboe?asset=spy',
        ndx: '/api/cboe?asset=ndx',
        qqq: '/api/cboe?asset=qqq',
        vix: '/api/cboe?asset=vix',
        status: '/api/status',
      },
    }),
  };
};
