// GlobalSairu Journal — NinjaTrader 8 Strategy
// Sincroniza trades manuales cerrados a Supabase automaticamente

#region Using declarations
using System;
using System.Net;
using System.Text;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Strategies;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public class GlobalSairu_Journal : Strategy
    {
        private class PendingTrade
        {
            public string Symbol;
            public string Type;
            public double EntryPrice;
            public int    Quantity;
            public DateTime EntryTime;
            public double PointValue;
        }

        private Dictionary<string, PendingTrade> pending  = new Dictionary<string, PendingTrade>();
        private HashSet<string>                  syncedIds = new HashSet<string>();

        // Token de sync de bajo privilegio (no da acceso a la base de datos)
        private const string SyncToken = "V9YL_kZ-EZe8D2FmcLN6j-YHyBO4wlPA";

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name           = "GlobalSairu_Journal";
                Description    = "Sincroniza trades con el Journal de Global Sairu";
                Calculate      = Calculate.OnBarClose;
                IsOverlay      = true;
                IsAutoScale    = false;
                JournalApiUrl  = "https://global-sairu.pages.dev";
                UserId         = "";
                JournalAccount = "";
            }
            else if (State == State.Realtime)
            {
                Print("GlobalSairu Journal: activo. Esperando trades...");
            }
        }

        protected override void OnBarUpdate() { }

        protected override void OnExecutionUpdate(Execution execution, string executionId,
            double price, int quantity, MarketPosition marketPosition,
            string orderId, DateTime time)
        {
            string symbol = execution.Instrument.FullName;
            double pv     = execution.Instrument.MasterInstrument.PointValue;

            Print("GlobalSairu: ejecución " + symbol + " | pos=" + marketPosition + " | price=" + price + " | qty=" + quantity);

            if (marketPosition == MarketPosition.Long || marketPosition == MarketPosition.Short)
            {
                // Entrada: abrir posición
                if (!pending.ContainsKey(symbol))
                {
                    pending[symbol] = new PendingTrade
                    {
                        Symbol     = symbol,
                        Type       = marketPosition == MarketPosition.Long ? "BUY" : "SELL",
                        EntryPrice = price,
                        Quantity   = quantity,
                        EntryTime  = time,
                        PointValue = pv
                    };
                    Print("GlobalSairu: entrada registrada " + symbol + " " + pending[symbol].Type + " @ " + price);
                }
            }
            else if (marketPosition == MarketPosition.Flat && pending.ContainsKey(symbol))
            {
                // Salida: trade completo
                var pt      = pending[symbol];
                double diff = pt.Type == "BUY" ? (price - pt.EntryPrice) : (pt.EntryPrice - price);
                double profit = Math.Round(diff * pt.PointValue * pt.Quantity, 2);

                string tradeId = pt.EntryTime.Ticks.ToString() + "_" + time.Ticks.ToString();
                pending.Remove(symbol);

                if (!syncedIds.Contains(tradeId))
                {
                    syncedIds.Add(tradeId);
                    string sym  = pt.Symbol;
                    string type = pt.Type;
                    string date = time.ToString("yyyy-MM-dd");
                    string open = pt.EntryTime.ToString("HH:mm");
                    int    qty  = pt.Quantity;
                    Task.Factory.StartNew(() => SendTrade(sym, type, profit, date, open, qty, tradeId));
                }
            }
        }

        private void SendTrade(string symbol, string type, double profit,
            string date, string openTime, int contracts, string tradeId)
        {
            try
            {
                long id = Math.Abs(tradeId.GetHashCode());

                string json = "{" +
                    "\"token\":\"" + SyncToken + "\"," +
                    "\"id\":" + id + "," +
                    "\"userId\":\"" + UserId + "\"," +
                    "\"symbol\":\"" + symbol + "\"," +
                    "\"type\":\"" + type + "\"," +
                    "\"profit\":" + profit.ToString(System.Globalization.CultureInfo.InvariantCulture) + "," +
                    "\"date\":\"" + date + "\"," +
                    "\"openTime\":\"" + openTime + "\"," +
                    "\"account\":\"" + JournalAccount + "\"," +
                    "\"note\":\"NinjaTrader | Contratos: " + contracts + "\"" +
                    "}";

                using (var client = new WebClient())
                {
                    client.Encoding = Encoding.UTF8;
                    client.Headers.Add("Content-Type", "application/json");
                    client.UploadString(JournalApiUrl + "/api/ea/sync-trade", "POST", json);
                }
                Print("GlobalSairu Journal: trade enviado — " + symbol + " " + type + " P&L: " + profit);
            }
            catch (Exception ex)
            {
                Print("GlobalSairu Journal Error: " + ex.Message);
            }
        }

        #region Properties
        [NinjaScriptProperty]
        [Display(Name = "Journal API URL", Order = 1, GroupName = "GlobalSairu Journal")]
        public string JournalApiUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "USER_ID (copiar desde el journal)", Order = 2, GroupName = "GlobalSairu Journal")]
        public string UserId { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "JOURNAL_ACCOUNT (nombre exacto)", Order = 3, GroupName = "GlobalSairu Journal")]
        public string JournalAccount { get; set; }
        #endregion
    }
}
