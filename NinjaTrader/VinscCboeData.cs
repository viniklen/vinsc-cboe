// ═══════════════════════════════════════════════════════════════════
// VINSC INVEST — Indicador NinjaTrader 8
// Consome a API CBOE e plota dados de opções no gráfico
//
// INSTALAÇÃO:
// 1. Copie este arquivo para: Documents\NinjaTrader 8\bin\Custom\Indicators\
// 2. No NinjaTrader: New > NinjaScript Editor > clique direito > Compile
// 3. Adicione ao gráfico: Insert > Indicators > VinscCboeData
// ═══════════════════════════════════════════════════════════════════

#region Using declarations
using System;
using System.Net.Http;
using System.Threading.Tasks;
using System.Collections.Generic;
using NinjaTrader.Cbi;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.DrawingTools;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    public class VinscCboeData : Indicator
    {
        // ── Parâmetros configuráveis no NinjaTrader ──────────────
        private string _apiBaseUrl = "https://SEU-SITE.netlify.app"; // ← TROQUE PELO SEU DOMÍNIO
        private string _asset = "spx";
        private bool _showGammaLevels = true;
        private bool _showDeltaLevels = true;

        // ── Estado interno ───────────────────────────────────────
        private static readonly HttpClient _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        private DateTime _lastFetch = DateTime.MinValue;
        private TimeSpan _fetchInterval = TimeSpan.FromMinutes(5);
        private bool _isFetching = false;
        private string _lastError = null;
        private string _lastUpdate = "Nunca";

        // Dados das opções
        private List<CboeOptionRow> _options = new List<CboeOptionRow>();

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "VINSC Invest — Dados de opções da CBOE em tempo real";
                Name = "VinscCboeData";
                Calculate = Calculate.OnBarClose;
                IsOverlay = true;
                DisplayInDataBox = true;
                DrawOnPricePanel = true;
                IsSuspendedWhileInactive = true;
                PaintPriceMarkers = false;

                // Propriedades configuráveis
                ApiBaseUrl = "https://SEU-SITE.netlify.app";
                Asset = "spx";
                ShowGammaLevels = true;
                ShowDeltaLevels = true;
                FetchIntervalMinutes = 5;
            }

            if (State == State.Historical)
            {
                _http.DefaultRequestHeaders.Clear();
                _http.DefaultRequestHeaders.Add("User-Agent", "NinjaTrader/VinscInvest");
            }
        }

        protected override void OnBarUpdate()
        {
            if (BarsInProgress != 0) return;

            // Verifica se é hora de buscar dados novos
            if ((DateTime.UtcNow - _lastFetch) >= _fetchInterval && !_isFetching)
            {
                FetchDataAsync();
            }

            // Desenha os níveis se houver dados
            if (_options.Count > 0)
            {
                DrawOptionLevels();
            }

            // Status no canto do gráfico
            DrawStatus();
        }

        // ── Busca dados da API ───────────────────────────────────
        private async void FetchDataAsync()
        {
            _isFetching = true;
            try
            {
                var url = $"{ApiBaseUrl.TrimEnd('/')}/api/cboe?asset={Asset.ToLower()}";
                var response = await _http.GetStringAsync(url);
                var json = JObject.Parse(response);

                _lastError = null;
                _lastUpdate = json["updated_at_br"]?.ToString() ?? DateTime.Now.ToString("dd/MM HH:mm");
                _lastFetch = DateTime.UtcNow;

                // Parseia as linhas de opções
                _options.Clear();
                var rows = json["data"]?["rows"] as JArray;
                if (rows != null)
                {
                    foreach (var row in rows)
                    {
                        var opt = new CboeOptionRow
                        {
                            Strike = ParseDouble(row["Strike"]?.ToString() ?? row["strike"]?.ToString()),
                            CallIV = ParseDouble(row["Calls IV"]?.ToString() ?? row["IV"]?.ToString()),
                            PutIV = ParseDouble(row["Puts IV"]?.ToString()),
                            CallOI = ParseInt(row["Calls OI"]?.ToString() ?? row["Open Interest"]?.ToString()),
                            PutOI = ParseInt(row["Puts OI"]?.ToString()),
                            Expiration = row["Expiration Date"]?.ToString() ?? row["Expiration"]?.ToString(),
                        };
                        if (opt.Strike > 0) _options.Add(opt);
                    }
                }

                Print($"[VinscCboe] {Asset.ToUpper()}: {_options.Count} strikes carregados às {_lastUpdate}");
            }
            catch (Exception ex)
            {
                _lastError = ex.Message.Length > 60 ? ex.Message.Substring(0, 60) + "..." : ex.Message;
                Print($"[VinscCboe] Erro ao buscar dados: {ex.Message}");
            }
            finally
            {
                _isFetching = false;
            }
        }

        // ── Desenha níveis no gráfico ────────────────────────────
        private void DrawOptionLevels()
        {
            if (!ShowGammaLevels && !ShowDeltaLevels) return;

            // Limpa linhas antigas
            RemoveDrawObjects("cboe_");

            double currentPrice = Close[0];
            double priceRange = currentPrice * 0.05; // mostra ±5% do preço atual

            foreach (var opt in _options)
            {
                if (Math.Abs(opt.Strike - currentPrice) > priceRange) continue;

                // Níveis de OI (interesse aberto) — quanto maior o OI, linha mais espessa
                if (opt.CallOI > 0 && ShowGammaLevels)
                {
                    double thickness = opt.CallOI > 10000 ? 2 : 1;
                    var opacity = (byte)Math.Min(255, 80 + (opt.CallOI / 1000));
                    Draw.HorizontalLine(this,
                        $"cboe_call_{opt.Strike}_{opt.Expiration}",
                        false,
                        opt.Strike,
                        System.Windows.Media.Color.FromArgb(opacity, 0, 200, 100),
                        DashStyleHelper.Dot,
                        (int)thickness);
                }

                if (opt.PutOI > 0 && ShowDeltaLevels)
                {
                    double thickness = opt.PutOI > 10000 ? 2 : 1;
                    var opacity = (byte)Math.Min(255, 80 + (opt.PutOI / 1000));
                    Draw.HorizontalLine(this,
                        $"cboe_put_{opt.Strike}_{opt.Expiration}",
                        false,
                        opt.Strike,
                        System.Windows.Media.Color.FromArgb(opacity, 220, 50, 50),
                        DashStyleHelper.Dot,
                        (int)thickness);
                }
            }

            // Marca o strike com maior OI (GEX wall)
            var maxCallOI = _options.Count > 0
                ? _options.OrderByDescending(o => o.CallOI).FirstOrDefault()
                : null;

            if (maxCallOI != null && maxCallOI.Strike > 0)
            {
                Draw.HorizontalLine(this, "cboe_gex_wall", false,
                    maxCallOI.Strike,
                    System.Windows.Media.Color.FromArgb(200, 0, 230, 180),
                    DashStyleHelper.Solid, 2);

                Draw.Text(this, "cboe_gex_label", false,
                    $"GEX WALL {maxCallOI.Strike:N0} | OI: {maxCallOI.CallOI:N0}",
                    0, maxCallOI.Strike + (maxCallOI.Strike * 0.001),
                    System.Windows.Media.Colors.Cyan);
            }
        }

        // ── Status no canto do gráfico ───────────────────────────
        private void DrawStatus()
        {
            var color = _lastError != null
                ? System.Windows.Media.Colors.OrangeRed
                : System.Windows.Media.Colors.LimeGreen;

            var msg = _lastError != null
                ? $"CBOE ERR: {_lastError}"
                : $"CBOE {Asset.ToUpper()} | {_options.Count} strikes | Atualizado: {_lastUpdate}";

            Draw.TextFixed(this, "cboe_status", msg,
                TextPosition.BottomRight,
                color,
                new SimpleFont("Arial", 10),
                System.Windows.Media.Colors.Transparent,
                System.Windows.Media.Colors.Transparent, 0);
        }

        // ── Helpers ──────────────────────────────────────────────
        private double ParseDouble(string s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            s = s.Replace(",", "").Replace("%", "").Trim();
            return double.TryParse(s, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }

        private int ParseInt(string s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            s = s.Replace(",", "").Trim();
            return int.TryParse(s, out var v) ? v : 0;
        }

        // ── Propriedades (aparecem no painel do NinjaTrader) ─────
        [NinjaScriptProperty]
        [Display(Name = "URL da API", Order = 1, GroupName = "Vinsc CBOE")]
        public string ApiBaseUrl
        {
            get { return _apiBaseUrl; }
            set { _apiBaseUrl = value; }
        }

        [NinjaScriptProperty]
        [Display(Name = "Ativo (spx/spy/ndx/qqq/vix)", Order = 2, GroupName = "Vinsc CBOE")]
        public string Asset
        {
            get { return _asset; }
            set { _asset = value?.ToLower() ?? "spx"; }
        }

        [NinjaScriptProperty]
        [Display(Name = "Mostrar níveis Call (verde)", Order = 3, GroupName = "Vinsc CBOE")]
        public bool ShowGammaLevels
        {
            get { return _showGammaLevels; }
            set { _showGammaLevels = value; }
        }

        [NinjaScriptProperty]
        [Display(Name = "Mostrar níveis Put (vermelho)", Order = 4, GroupName = "Vinsc CBOE")]
        public bool ShowDeltaLevels
        {
            get { return _showDeltaLevels; }
            set { _showDeltaLevels = value; }
        }

        [NinjaScriptProperty]
        [Display(Name = "Intervalo de atualização (min)", Order = 5, GroupName = "Vinsc CBOE")]
        public int FetchIntervalMinutes
        {
            get { return (int)_fetchInterval.TotalMinutes; }
            set { _fetchInterval = TimeSpan.FromMinutes(Math.Max(1, value)); }
        }
    }

    // ── Modelo de dado de opção ──────────────────────────────────
    public class CboeOptionRow
    {
        public double Strike { get; set; }
        public double CallIV { get; set; }
        public double PutIV { get; set; }
        public int CallOI { get; set; }
        public int PutOI { get; set; }
        public string Expiration { get; set; }
    }
}
