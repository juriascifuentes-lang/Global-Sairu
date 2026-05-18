// GlobalSairu Journal — NinjaTrader 8 AddOn
// Sincroniza trades cerrados a Supabase automaticamente
// Instrucciones: Herramientas → Importar NinjaScript → selecciona este archivo

#region Using declarations
using System;
using System.Net.Http;
using System.Text;
using System.Collections.Generic;
using System.Threading.Tasks;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Strategies;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public class GlobalSairu_Journal : Strategy
    {
        private HttpClient httpClient;
        private HashSet<string> syncedIds = new HashSet<string>();
        private bool historySynced = false;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name                = "GlobalSairu_Journal";
                Description         = "Sincroniza trades con el Journal de Global Sairu";
                Calculate           = Calculate.OnBarClose;
                IsOverlay           = true;
                IsAutoScale         = false;
                SupabaseUrl         = "https://wvkdvvrbittavgjkezpy.supabase.co";
                SupabaseKey         = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2a2R2dnJiaXR0YXZnamtlenB5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY3OTAxMiwiZXhwIjoyMDk0MjU1MDEyfQ.5vUm8FSJZTswxlsz7TzEOEy0ScGUu27KrTGNncjta6g";
                UserId              = "";
                JournalAccount      = "";
            }
            else if (State == State.DataLoaded)
            {
                httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("apikey", SupabaseKey);
                httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer " + SupabaseKey);
                httpClient.DefaultRequestHeaders.Add("Prefer", "return=minimal");
            }
            else if (State == State.Terminated)
            {
                httpClient?.Dispose();
            }
        }

        protected override void OnBarUpdate() { }

        protected override void OnExecutionUpdate(Execution execution, string executionId,
            double price, int quantity, MarketPosition marketPosition,
            string orderId, DateTime time)
        {
            if (!historySynced)
            {
                historySynced = true;
                Task.Run(() => SyncHistory());
            }
        }

        private void SyncHistory()
        {
            try
            {
                var trades = SystemPerformance.AllTrades;
                int synced = 0;
                foreach (Trade trade in trades)
                {
                    string tradeId = trade.Entry.Time.Ticks.ToString() + "_" + trade.Exit.Time.Ticks.ToString();
                    if (syncedIds.Contains(tradeId)) continue;

                    bool ok = SendTrade(trade, tradeId);
                    if (ok)
                    {
                        syncedIds.Add(tradeId);
                        synced++;
                    }
                }
                Print("GlobalSairu Journal: " + synced + " trades sincronizados.");
            }
            catch (Exception ex)
            {
                Print("GlobalSairu Journal Error: " + ex.Message);
            }
        }

        private bool SendTrade(Trade trade, string tradeId)
        {
            try
            {
                string symbol    = trade.Entry.Instrument.FullName;
                string type      = trade.Entry.MarketPosition == MarketPosition.Long ? "BUY" : "SELL";
                double profit    = Math.Round(trade.ProfitCurrency, 2);
                string dateStr   = trade.Exit.Time.ToString("yyyy-MM-dd");
                string openTime  = trade.Entry.Time.ToString("HH:mm");
                int    contracts = trade.Quantity;

                long id = Math.Abs(tradeId.GetHashCode());

                string json = "{" +
                    "\"id\":" + id + "," +
                    "\"user_id\":\"" + UserId + "\"," +
                    "\"symbol\":\"" + symbol + "\"," +
                    "\"type\":\"" + type + "\"," +
                    "\"profit\":" + profit.ToString(System.Globalization.CultureInfo.InvariantCulture) + "," +
                    "\"date\":\"" + dateStr + "\"," +
                    "\"open_time\":\"" + openTime + "\"," +
                    "\"account\":\"" + JournalAccount + "\"," +
                    "\"note\":\"Importado desde NinjaTrader | Contratos: " + contracts + "\"," +
                    "\"entry_images\":[]" +
                    "}";

                string url = SupabaseUrl + "/rest/v1/trades";
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var task = httpClient.PostAsync(url, content);
                task.Wait(5000);

                int status = (int)task.Result.StatusCode;
                return status == 200 || status == 201;
            }
            catch
            {
                return false;
            }
        }

        #region Properties
        [NinjaScriptProperty]
        [Display(Name = "Supabase URL", Order = 1, GroupName = "GlobalSairu Journal")]
        public string SupabaseUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Supabase Key", Order = 2, GroupName = "GlobalSairu Journal")]
        public string SupabaseKey { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "USER_ID (copiar desde el journal)", Order = 3, GroupName = "GlobalSairu Journal")]
        public string UserId { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "JOURNAL_ACCOUNT (nombre exacto)", Order = 4, GroupName = "GlobalSairu Journal")]
        public string JournalAccount { get; set; }
        #endregion
    }
}
