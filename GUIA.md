# VINSC INVEST — CBOE Data Service
## Guia Completo de Instalação e Uso

---

## 🗂️ Estrutura do Projeto

```
vinsc-cboe/
├── .github/
│   └── workflows/
│       └── cboe-downloader.yml   ← Agendador automático (GitHub Actions)
├── src/
│   └── cboe-robot.js             ← Robô Playwright (porta a lógica da extensão)
├── netlify/
│   └── functions/
│       ├── cboe.js               ← API: /api/cboe?asset=spx
│       └── status.js             ← API: /api/status
├── public/
│   ├── index.html                ← Dashboard de status
│   └── cboe/
│       └── last_run.json         ← Log da última execução
├── NinjaTrader/
│   └── VinscCboeData.cs          ← Indicador NinjaTrader 8
├── netlify.toml                  ← Configuração Netlify
├── package.json                  ← Dependências Node.js
└── GUIA.md                       ← Este arquivo
```

---

## 🌐 Plataformas Gratuitas Utilizadas

| Plataforma | Função | Custo | Link |
|---|---|---|---|
| **GitHub** | Repositório + robô agendado | Grátis (público) | github.com |
| **GitHub Actions** | Execução automática do robô | Grátis (ilimitado repo público) | github.com/actions |
| **GitHub Pages** | Servir os CSVs como URL pública | Grátis | pages.github.com |
| **Netlify** | Dashboard + API JSON | Grátis (100GB/mês) | netlify.com |

**Custo total: R$ 0,00**

---

## 📋 PASSO A PASSO COMPLETO

### ETAPA 1 — Criar conta no GitHub
1. Acesse **github.com** e crie uma conta gratuita
2. Confirme o e-mail
3. Clique em **"New repository"**
4. Nome: `vinsc-cboe` (ou qualquer nome)
5. Marque: **Public** ← importante para Actions ser gratuito
6. Clique **"Create repository"**

---

### ETAPA 2 — Instalar Git e Node.js no seu PC

**Git:**
- Baixe em: https://git-scm.com/download/win
- Instale com as opções padrão

**Node.js:**
- Baixe em: https://nodejs.org (versão LTS)
- Instale com as opções padrão
- Verifique: abra o terminal e digite `node --version`

---

### ETAPA 3 — Subir o projeto para o GitHub

Abra o terminal (PowerShell ou CMD) na pasta do projeto:

```bash
# Entre na pasta do projeto
cd caminho/para/vinsc-cboe

# Instale as dependências
npm install

# Inicializa git
git init
git add .
git commit -m "inicial: robô CBOE Vinsc"

# Conecta ao GitHub (substitua SEU_USUARIO pelo seu usuário GitHub)
git remote add origin https://github.com/SEU_USUARIO/vinsc-cboe.git
git branch -M main
git push -u origin main
```

---

### ETAPA 4 — Ativar GitHub Pages

1. No GitHub, abra o seu repositório `vinsc-cboe`
2. Vá em **Settings** → **Pages**
3. Em "Source", selecione: **Deploy from a branch**
4. Branch: **main** | Folder: **/public**
5. Clique **Save**
6. Aguarde ~2 minutos
7. A URL dos CSVs será: `https://SEU_USUARIO.github.io/vinsc-cboe/cboe/spx_quotedata.csv`

---

### ETAPA 5 — Criar conta no Netlify e conectar ao GitHub

1. Acesse **netlify.com** e crie conta gratuita (login com GitHub)
2. Clique **"Add new site"** → **"Import an existing project"**
3. Escolha **GitHub** → autorize o Netlify
4. Selecione o repositório `vinsc-cboe`
5. Configurações de build:
   - Build command: *(deixe vazio)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions` ← Netlify detecta automaticamente pelo netlify.toml
6. Clique **"Deploy site"**
7. Aguarde o deploy (1-2 min)
8. **Anote a URL gerada**, ex: `https://amazing-name-123.netlify.app`

---

### ETAPA 6 — Testar o robô manualmente

1. No GitHub, vá em **Actions**
2. Clique no workflow **"CBOE Data Downloader"**
3. Clique **"Run workflow"** → **"Run workflow"**
4. Aguarde ~5-10 minutos
5. Verifique se o workflow ficou verde (✅)
6. Veja os arquivos CSV em: **Code** → **public/cboe/**
7. Acesse seu dashboard: `https://SEU-SITE.netlify.app`

---

### ETAPA 7 — Configurar o NinjaTrader

1. Copie o arquivo `NinjaTrader/VinscCboeData.cs` para:
   `C:\Users\SEU_USUARIO\Documents\NinjaTrader 8\bin\Custom\Indicators\`

2. Abra o NinjaTrader → **New** → **NinjaScript Editor**

3. No editor, localize o arquivo `VinscCboeData.cs`

4. **IMPORTANTE:** Na linha 36 do arquivo, troque a URL:
   ```
   private string _apiBaseUrl = "https://SEU-SITE.netlify.app";
   ```
   Pela URL real do seu Netlify, ex:
   ```
   private string _apiBaseUrl = "https://amazing-name-123.netlify.app";
   ```

5. Clique direito no arquivo → **Compile**

6. No gráfico: **Insert** → **Indicators** → **VinscCboeData**

7. Configure:
   - **URL da API**: sua URL do Netlify
   - **Ativo**: `spx`, `spy`, `ndx`, `qqq` ou `vix`
   - **Mostrar níveis Call**: linhas verdes (calls com alto OI)
   - **Mostrar níveis Put**: linhas vermelhas (puts com alto OI)

---

## ⏰ Horários de Execução Automática

O robô executa automaticamente (dias úteis):

| Horário Brasil | Horário UTC |
|---|---|
| 10:30 | 13:30 |
| 11:30 | 14:30 |
| 12:30 | 15:30 |
| 13:30 | 16:30 |
| 14:30 | 17:30 |
| 15:30 | 18:30 |
| 16:30 | 19:30 |
| 17:30 | 20:30 |

**Nota:** GitHub Actions pode atrasar até ~15 minutos em horários de pico.

---

## 🔗 URLs do Serviço (após configurar)

```
Dashboard:               https://SEU-SITE.netlify.app
Status JSON:             https://SEU-SITE.netlify.app/api/status
API SPX (JSON):          https://SEU-SITE.netlify.app/api/cboe?asset=spx
API SPY (JSON):          https://SEU-SITE.netlify.app/api/cboe?asset=spy
API NDX (JSON):          https://SEU-SITE.netlify.app/api/cboe?asset=ndx
API QQQ (JSON):          https://SEU-SITE.netlify.app/api/cboe?asset=qqq
API VIX (JSON):          https://SEU-SITE.netlify.app/api/cboe?asset=vix

CSV SPX (direto):        https://SEU-SITE.netlify.app/cboe/spx_quotedata.csv
CSV SPY (direto):        https://SEU-SITE.netlify.app/cboe/spy_quotedata.csv
CSV NDX (direto):        https://SEU-SITE.netlify.app/cboe/ndx_quotedata.csv
CSV QQQ (direto):        https://SEU-SITE.netlify.app/cboe/qqq_quotedata.csv
CSV VIX (direto):        https://SEU-SITE.netlify.app/cboe/vix_quotedata.csv
```

---

## ❓ Problemas comuns

**O robô falhou (❌ vermelho no Actions):**
- Verifique o log clicando no workflow → "download-cboe" → "Executar robô CBOE"
- A CBOE pode ter mudado o layout → verifique os seletores no `cboe-robot.js`
- Execute manualmente para testar

**CSV não aparece no Netlify:**
- O Netlify precisa de um novo deploy depois que os CSVs foram commitados
- Vá em Netlify → seu site → **Deploys** → **Trigger deploy**
- Ou ative o "Deploy on push" nas configurações (já vem ativo por padrão)

**NinjaTrader não conecta na API:**
- Verifique se a URL no arquivo .cs está correta
- Verifique se o site Netlify está no ar acessando no navegador
- O NinjaTrader precisa de conexão com a internet ativa

**GitHub Actions parou de rodar:**
- Repositórios públicos sem atividade por 60 dias têm os crons pausados
- Para reativar: faça qualquer commit no repositório, ou
- Vá em Actions → workflow → "Enable workflow"

---

## 📊 Como seu site GEX usa os arquivos

Seu site pode ler os CSVs de duas formas:

**Forma 1 — CSV direto (mais simples):**
```javascript
const res = await fetch('https://SEU-SITE.netlify.app/cboe/spx_quotedata.csv');
const csv = await res.text();
// Parseia o CSV aqui
```

**Forma 2 — API JSON (mais fácil de usar):**
```javascript
const res = await fetch('https://SEU-SITE.netlify.app/api/cboe?asset=spx');
const data = await res.json();
// data.data.rows contém todas as linhas
// data.updated_at_br contém a hora da última atualização
```

---

*VINSC Invest — Ferramenta de uso pessoal para análise de opções*
