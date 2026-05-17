//+------------------------------------------------------------------+
//|  GlobalSairu_CopyMaster.mq5                                      |
//|  EA Maestro – publica señales en Supabase copy_signals           |
//|                                                                   |
//|  Instalación:                                                     |
//|    1. Completar SUPABASE_URL, SUPABASE_KEY y MASTER_NAME.       |
//|    2. Colocar en MQL5/Experts/ y compilar.                       |
//|    3. Adjuntar al gráfico de la cuenta maestra (cualquier par).  |
//|    4. Habilitar WebRequest y agregar la URL de Supabase.         |
//+------------------------------------------------------------------+
#property strict
#property version "1.32"

//── Inputs ─────────────────────────────────────────────────────────
input string SUPABASE_URL = "https://wvkdvvrbittavgjkezpy.supabase.co";
input string SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2a2R2dnJiaXR0YXZnamtlenB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzkwMTIsImV4cCI6MjA5NDI1NTAxMn0.moCADFa5fKMisy63t9ZO7Lypp77MFX-VtvsBIYv1KO8";
input string MASTER_NAME  = "Cuenta Maestra";
input int    POLL_MS      = 1000;

// Secret interno — no visible en parámetros MT5
const string MASTER_SECRET = "GScp_8Kx2nM7vP4qL9wR3j5Tz";

//── Snapshot struct ─────────────────────────────────────────────────
struct PositionSnap {
   long   ticket;
   int    type;
   double lots;
   double open_price;
   double sl;
   double tp;
   char   symbol[32];
};

PositionSnap prev_positions[];
int          prev_count = 0;

int    g_master_report    = 0;
const int MASTER_REPORT_EVERY = 5;
int    g_master_day       = -1;
double g_master_day_start = 0.0;

//+------------------------------------------------------------------+
int OnInit() {
   EventSetMillisecondTimer(POLL_MS);
   PrintFormat("[GS-Master] Iniciado. Master: %s", MASTER_NAME);
   SnapshotPositions(prev_positions, prev_count);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() {
   g_master_report++;
   if(g_master_report >= MASTER_REPORT_EVERY) {
      g_master_report = 0;
      ReportBalance();
   }

   PositionSnap curr[];
   int curr_count = 0;
   SnapshotPositions(curr, curr_count);

   // ── Detectar OPEN (tickets nuevos) ────────────────────────────
   for(int i = 0; i < curr_count; i++) {
      if(!ExistsInPrev(curr[i].ticket)) {
         PublishSignal("OPEN",
            curr[i].ticket,
            CharArrayToString(curr[i].symbol),
            curr[i].type == ORDER_TYPE_BUY ? "BUY" : "SELL",
            curr[i].lots,
            curr[i].open_price,
            curr[i].sl,
            curr[i].tp);
      }
   }

   // ── Detectar CLOSE (tickets desaparecidos) ─────────────────────
   for(int i = 0; i < prev_count; i++) {
      if(!ExistsInCurr(prev_positions[i].ticket, curr, curr_count)) {
         PublishSignal("CLOSE",
            prev_positions[i].ticket,
            CharArrayToString(prev_positions[i].symbol),
            prev_positions[i].type == ORDER_TYPE_BUY ? "BUY" : "SELL",
            prev_positions[i].lots,
            0.0, 0.0, 0.0);
      }
   }

   // ── Detectar MODIFY (SL/TP cambiado) ─────────────────────────
   for(int i = 0; i < curr_count; i++) {
      int idx = FindInPrev(curr[i].ticket);
      if(idx >= 0) {
         if(MathAbs(curr[i].sl - prev_positions[idx].sl) > 1e-8 ||
            MathAbs(curr[i].tp - prev_positions[idx].tp) > 1e-8) {
            PublishSignal("MODIFY",
               curr[i].ticket,
               CharArrayToString(curr[i].symbol),
               curr[i].type == ORDER_TYPE_BUY ? "BUY" : "SELL",
               curr[i].lots,
               curr[i].open_price,
               curr[i].sl,
               curr[i].tp);
         }
      }
   }

   // Actualizar snapshot manualmente (evita ArrayCopy con strings)
   ArrayResize(prev_positions, curr_count);
   for(int i = 0; i < curr_count; i++) prev_positions[i] = curr[i];
   prev_count = curr_count;
}

//── Snapshot ────────────────────────────────────────────────────────
void SnapshotPositions(PositionSnap &arr[], int &cnt) {
   cnt = PositionsTotal();
   ArrayResize(arr, cnt);
   for(int i = 0; i < cnt; i++) {
      ulong ticket = PositionGetTicket(i);
      arr[i].ticket     = (long)ticket;
      arr[i].type       = (int)PositionGetInteger(POSITION_TYPE);
      arr[i].lots       = PositionGetDouble(POSITION_VOLUME);
      arr[i].open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      arr[i].sl         = PositionGetDouble(POSITION_SL);
      arr[i].tp         = PositionGetDouble(POSITION_TP);
      string sym = PositionGetString(POSITION_SYMBOL);
      StringToCharArray(sym, arr[i].symbol, 0, 32);
   }
}

bool ExistsInPrev(long ticket) {
   for(int i = 0; i < prev_count; i++)
      if(prev_positions[i].ticket == ticket) return true;
   return false;
}

bool ExistsInCurr(long ticket, const PositionSnap &arr[], int cnt) {
   for(int i = 0; i < cnt; i++)
      if(arr[i].ticket == ticket) return true;
   return false;
}

int FindInPrev(long ticket) {
   for(int i = 0; i < prev_count; i++)
      if(prev_positions[i].ticket == ticket) return i;
   return -1;
}

//── Reportar balance y Day PnL ──────────────────────────────────────
void ReportBalance() {
   MqlDateTime dt;
   TimeCurrent(dt);
   if(dt.day_of_year != g_master_day) {
      g_master_day       = dt.day_of_year;
      g_master_day_start = AccountInfoDouble(ACCOUNT_EQUITY);
   }
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double profit     = AccountInfoDouble(ACCOUNT_PROFIT);
   double day_profit = equity - g_master_day_start;

   string url     = SUPABASE_URL + "/rest/v1/copy_balances";
   string headers = "Content-Type: application/json\r\n"
                  + "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Prefer: resolution=merge-duplicates,return=minimal";
   string body = StringFormat(
      "{\"account_name\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,"
      "\"profit\":%.2f,\"day_profit\":%.2f}",
      MASTER_NAME, balance, equity, profit, day_profit);
   char req[], res[];
   string res_headers;
   StringToCharArray(body, req, 0, StringLen(body));
   WebRequest("POST", url, headers, 5000, req, res, res_headers);
}

//── Publicar señal en Supabase ───────────────────────────────────────
void PublishSignal(string signal_type,
                   long   master_ticket,
                   string symbol,
                   string direction,
                   double lots,
                   double open_price,
                   double sl,
                   double tp)
{
   string url     = SUPABASE_URL + "/rest/v1/copy_signals";
   string headers = "Content-Type: application/json\r\n"
                  + "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Prefer: return=minimal";

   string body = StringFormat(
      "{\"master_name\":\"%s\","
      "\"signal_type\":\"%s\","
      "\"master_ticket\":%d,"
      "\"symbol\":\"%s\","
      "\"direction\":\"%s\","
      "\"lots\":%.2f,"
      "\"open_price\":%.5f,"
      "\"sl\":%.5f,"
      "\"tp\":%.5f,"
      "\"master_secret\":\"%s\"}",
      MASTER_NAME, signal_type, master_ticket,
      symbol, direction, lots, open_price, sl, tp, MASTER_SECRET);

   char req[], res[];
   string res_headers;
   StringToCharArray(body, req, 0, StringLen(body));

   int code = WebRequest("POST", url, headers, 5000, req, res, res_headers);
   if(code != 201 && code != 200)
      PrintFormat("[GS-Master] ERROR HTTP %d al publicar %s ticket=%d", code, signal_type, master_ticket);
   else
      PrintFormat("[GS-Master] %s publicado: ticket=%d symbol=%s lots=%.2f", signal_type, master_ticket, symbol, lots);
}
