//+------------------------------------------------------------------+
//|  GlobalSairu_CopySlave.mq5                                       |
//|  EA Esclavo – lee config y señales de Supabase                   |
//|                                                                    |
//|  Instalación:                                                      |
//|    1. Completar solo SUPABASE_URL, SUPABASE_KEY y SLAVE_NAME.    |
//|    2. El resto (master, risk, multiplier, sufijo) se carga        |
//|       automáticamente desde el journal.                           |
//|    3. Habilitar WebRequest y agregar la URL de Supabase.         |
//+------------------------------------------------------------------+
#property strict
#property version "1.46"

#include <Trade\Trade.mqh>
CTrade trade;

//── Inputs mínimos ──────────────────────────────────────────────────
input string SUPABASE_URL  = "https://wvkdvvrbittavgjkezpy.supabase.co";
input string SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2a2R2dnJiaXR0YXZnamtlenB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzkwMTIsImV4cCI6MjA5NDI1NTAxMn0.moCADFa5fKMisy63t9ZO7Lypp77MFX-VtvsBIYv1KO8";
input string SLAVE_NAME    = "Cuenta Esclava";  // Número de cuenta esclava (ej: 198389461)
input int    POLL_MS       = 1000;
input int    SLIPPAGE_PTS  = 10;
input int    MAGIC         = 202500;

//── Config cargada desde Supabase ───────────────────────────────────
string g_master_name   = "";
int    g_risk_type     = 0;    // 0=multiplier 1=balance_ratio 2=fixed_lots
double g_multiplier    = 1.0;
string g_symbol_suffix = "";
bool   g_copy_existing    = false;
bool   g_initialized      = false;
bool   g_is_active        = true;
int    g_refresh_counter  = 0;
const int REFRESH_EVERY   = 3;  // recarga config cada 3 polls (~3 seg con POLL_MS=1000)
int    g_current_day      = -1;
double g_day_start_equity = 0.0;

//+------------------------------------------------------------------+
int OnInit() {
   trade.SetExpertMagicNumber(MAGIC);
   trade.SetDeviationInPoints(SLIPPAGE_PTS);

   if(!LoadConfig()) {
      Print("[GS-Slave] ERROR: no se pudo cargar la configuración del copiador. "
            "Verificá que SLAVE_NAME coincida con el nombre en el journal y que el copiador esté activo.");
      return INIT_FAILED;
   }

   EventSetMillisecondTimer(POLL_MS);
   PrintFormat("[GS-Slave] Iniciado. Escuchando señales de '%s' | Sufijo='%s' | Risk=%d | Mult=%.2f | CopyExisting=%s",
               g_master_name, g_symbol_suffix, g_risk_type, g_multiplier,
               g_copy_existing ? "SI" : "NO");
   g_initialized = false;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTimer() { ProcessSignals(); }

//── Cargar configuración desde copy_copiers ─────────────────────────
bool LoadConfig() {
   string url = SUPABASE_URL
      + "/rest/v1/copy_copiers"
      + "?slave_name=eq." + UrlEncode(SLAVE_NAME)
      + "&limit=1";

   string headers = "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Accept: application/json";

   char req[], res[];
   string res_headers;
   ArrayResize(req, 0);

   int code = WebRequest("GET", url, headers, 5000, req, res, res_headers);
   if(code != 200) {
      PrintFormat("[GS-Slave] ERROR HTTP %d al cargar config", code);
      return false;
   }

   string json = CharArrayToString(res);
   int obj_start = StringFind(json, "{");
   if(obj_start < 0) {
      Print("[GS-Slave] No se encontró configuración para SLAVE_NAME='" + SLAVE_NAME + "'");
      return false;
   }
   int obj_end = FindObjectEnd(json, obj_start);
   if(obj_end < 0) return false;

   string obj      = StringSubstr(json, obj_start, obj_end - obj_start + 1);
   g_master_name   = ParseString(obj, "master_name");
   g_multiplier    = ParseDouble(obj, "multiplier");
   g_symbol_suffix = ParseString(obj, "symbol_suffix");

   string risk_str = ParseString(obj, "risk_type");
   if(risk_str == "balance_ratio") g_risk_type = 1;
   else if(risk_str == "fixed_lots") g_risk_type = 2;
   else g_risk_type = 0;

   g_copy_existing = (StringFind(obj, "\"copy_existing\":true") >= 0);

   bool new_active = (StringFind(obj, "\"is_active\":true") >= 0);
   if(new_active != g_is_active)
      PrintFormat("[GS-Slave] Estado: %s", new_active ? "ACTIVO (reanudando)" : "PAUSADO");
   g_is_active = new_active;

   return StringLen(g_master_name) > 0;
}

//── Polling de señales ───────────────────────────────────────────────
void ProcessSignals() {
   // Recargar config periódicamente para detectar cambios desde el journal
   g_refresh_counter++;
   if(g_refresh_counter >= REFRESH_EVERY) {
      g_refresh_counter = 0;
      string prev_master = g_master_name;
      int    prev_risk   = g_risk_type;
      double prev_mult   = g_multiplier;
      string prev_suffix = g_symbol_suffix;
      bool   prev_copy   = g_copy_existing;
      bool   prev_active = g_is_active;

      if(LoadConfig()) {
         if(prev_mult   != g_multiplier    ||
            prev_risk   != g_risk_type     ||
            prev_suffix != g_symbol_suffix ||
            prev_copy   != g_copy_existing ||
            prev_master != g_master_name) {
            PrintFormat("[GS-Slave] Config actualizada desde journal: Master='%s' Sufijo='%s' Risk=%d Mult=%.2f CopyExisting=%s",
                        g_master_name, g_symbol_suffix, g_risk_type, g_multiplier,
                        g_copy_existing ? "SI" : "NO");
         }
         if(!prev_active && g_is_active) {
            Print("[GS-Slave] Reactivado — sincronizando posiciones perdidas...");
            SyncPositionsOnInit();
         }
      }
      ReportBalance();
   }

   string url = SUPABASE_URL
      + "/rest/v1/copy_signals"
      + "?master_name=eq." + UrlEncode(g_master_name)
      + "&processed=eq.false"
      + "&order=id.asc"
      + "&limit=50";

   string headers = "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Accept: application/json";

   char req[], res[];
   string res_headers;
   ArrayResize(req, 0);

   int code = WebRequest("GET", url, headers, 5000, req, res, res_headers);
   if(code != 200) {
      if(code != -1)
         PrintFormat("[GS-Slave] ERROR HTTP %d al obtener señales", code);
      return;
   }

   string json = CharArrayToString(res);
   if(StringLen(json) < 3) return;

   int pos = 0;
   while(true) {
      int obj_start = StringFind(json, "{", pos);
      if(obj_start < 0) break;
      int obj_end = FindObjectEnd(json, obj_start);
      if(obj_end < 0) break;

      string obj = StringSubstr(json, obj_start, obj_end - obj_start + 1);
      pos = obj_end + 1;

      long   sig_id        = (long)ParseLong(obj, "id");
      string signal_type   = ParseString(obj, "signal_type");
      long   master_ticket = (long)ParseLong(obj, "master_ticket");
      string symbol        = ParseString(obj, "symbol");
      string direction     = ParseString(obj, "direction");
      double lots          = ParseDouble(obj, "lots");
      double sl            = ParseDouble(obj, "sl");
      double tp            = ParseDouble(obj, "tp");
      double master_bal    = ParseDouble(obj, "master_balance");

      if(!g_is_active) {
         MarkProcessed(sig_id, 0, "paused_skip");
         continue;
      }

      if(!g_initialized) {
         if(signal_type != "OPEN") {
            // CLOSE/MODIFY durante init: no hay posición que cerrar/modificar aún
            MarkProcessed(sig_id, 0, "init_skip");
            continue;
         }
         // OPEN durante init: verificar si el esclavo ya tiene esa posición
         string init_tag = "GS:" + IntegerToString(master_ticket);
         bool already_open = false;
         for(int j = 0; j < PositionsTotal(); j++) {
            PositionGetTicket(j);
            if(PositionGetString(POSITION_COMMENT) == init_tag) { already_open = true; break; }
         }
         if(already_open) {
            // Ya fue copiada en una sesión anterior — no duplicar
            MarkProcessed(sig_id, 0, "init_skip_exists");
            continue;
         }
         // No existe en el esclavo → ejecutar (cubre reinicio durante apertura de operación)
      }

      bool   ok           = false;
      long   exec_ticket  = 0;
      string exec_comment = "";

      if(signal_type == "OPEN") {
         string slave_sym = symbol + g_symbol_suffix;
         SymbolSelect(slave_sym, true);

         ENUM_ORDER_TYPE ot = (direction == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
         double price = (ot == ORDER_TYPE_BUY)
            ? SymbolInfoDouble(slave_sym, SYMBOL_ASK)
            : SymbolInfoDouble(slave_sym, SYMBOL_BID);

         if(price <= 0.0) {
            PrintFormat("[GS-Slave] ERROR OPEN: precio=0 para '%s' — verificar Market Watch o sufijo símbolo", slave_sym);
            exec_comment = "error_no_price";
         } else {
            double slave_lots = CalcLots(lots, master_bal, slave_sym);
            string comment    = "GS:" + IntegerToString(master_ticket);
            ok = trade.PositionOpen(slave_sym, ot, slave_lots, price, sl, tp, comment);
            if(ok) {
               exec_ticket  = (long)trade.ResultDeal();
               exec_comment = StringFormat("lots=%.2f price=%.5f", slave_lots, price);
               PrintFormat("[GS-Slave] OPEN %s %s %.2f lots | ticket=%d", slave_sym, direction, slave_lots, exec_ticket);
            } else {
               PrintFormat("[GS-Slave] ERROR OPEN retcode=%d sym=%s dir=%s lots=%.2f price=%.5f",
                           trade.ResultRetcode(), slave_sym, direction, slave_lots, price);
               exec_comment = StringFormat("error_retcode=%d", trade.ResultRetcode());
            }
         }
      }
      else if(signal_type == "CLOSE") {
         ok = CloseByMasterTicket(master_ticket, exec_ticket);
         exec_comment = "closed";
      }
      else if(signal_type == "MODIFY") {
         ok = ModifyByMasterTicket(master_ticket, sl, tp);
         exec_comment = StringFormat("sl=%.5f tp=%.5f", sl, tp);
      }

      MarkProcessed(sig_id, exec_ticket, exec_comment);
   }

   if(!g_initialized) {
      g_initialized = true;
      PrintFormat("[GS-Slave] Listo. Señales anteriores marcadas. Esperando nuevas...");
      SyncPositionsOnInit();
   }
}

//── Cerrar posición esclava por tag (cierra TODAS las coincidencias) ─
bool CloseByMasterTicket(long master_ticket, long &exec_ticket) {
   string tag = "GS:" + IntegerToString(master_ticket);
   bool any_closed = false;
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong tkt = PositionGetTicket(i);
      if(PositionGetString(POSITION_COMMENT) == tag) {
         bool ok = trade.PositionClose(tkt);
         exec_ticket = (long)tkt;
         if(ok) { PrintFormat("[GS-Slave] CLOSE ticket=%d (tag=%s)", tkt, tag); any_closed = true; }
         else     PrintFormat("[GS-Slave] ERROR CLOSE retcode=%d ticket=%d", trade.ResultRetcode(), tkt);
      }
   }
   if(!any_closed) {
      string open_tags = "";
      for(int i = 0; i < PositionsTotal(); i++) {
         PositionGetTicket(i);
         open_tags += PositionGetString(POSITION_COMMENT) + " ";
      }
      PrintFormat("[GS-Slave] CLOSE: no encontré tag=%s | posiciones abiertas: [%s]", tag, open_tags);
   }
   return any_closed;
}

bool ModifyByMasterTicket(long master_ticket, double sl, double tp) {
   string tag = "GS:" + IntegerToString(master_ticket);
   bool found = false;
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong tkt = PositionGetTicket(i);
      if(PositionGetString(POSITION_COMMENT) == tag) {
         // Preservar SL/TP existente si el maestro envía 0 (evita borrar TP accidentalmente)
         double use_sl = (sl > 0.0) ? sl : PositionGetDouble(POSITION_SL);
         double use_tp = (tp > 0.0) ? tp : PositionGetDouble(POSITION_TP);
         bool ok = trade.PositionModify(tkt, use_sl, use_tp);
         if(ok) PrintFormat("[GS-Slave] MODIFY ticket=%d sl=%.5f tp=%.5f", tkt, use_sl, use_tp);
         else   PrintFormat("[GS-Slave] ERROR MODIFY retcode=%d", trade.ResultRetcode());
         found = true;
      }
   }
   return found;
}

//── Cálculo de lotes ────────────────────────────────────────────────
double CalcLots(double master_lots, double master_bal, string slave_sym) {
   double result = master_lots;
   if(g_risk_type == 1) {
      double slave_bal = AccountInfoDouble(ACCOUNT_BALANCE);
      if(master_bal > 0 && slave_bal > 0)
         result = master_lots * (slave_bal / master_bal) * g_multiplier;
      else
         result = master_lots * g_multiplier;
   }
   else if(g_risk_type == 2) {
      result = g_multiplier;
   }
   else {
      result = master_lots * g_multiplier;
   }
   double vol_min = SymbolInfoDouble(slave_sym, SYMBOL_VOLUME_MIN);
   double vol_max = SymbolInfoDouble(slave_sym, SYMBOL_VOLUME_MAX);
   double step    = SymbolInfoDouble(slave_sym, SYMBOL_VOLUME_STEP);
   if(vol_min > 0) result = MathMax(result, vol_min);
   if(vol_max > 0) result = MathMin(result, vol_max);
   if(step > 0)    result = MathFloor(result / step) * step;
   return NormalizeDouble(result, 2);
}

//── Marcar señal como procesada ─────────────────────────────────────
void MarkProcessed(long sig_id, long exec_ticket, string exec_comment) {
   string url     = SUPABASE_URL + "/rest/v1/copy_signals?id=eq." + IntegerToString(sig_id);
   string headers = "Content-Type: application/json\r\n"
                  + "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Prefer: return=minimal";

   string slave_bal = DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2);
   string body = StringFormat(
      "{\"processed\":true,\"slave_name\":\"%s\",\"exec_ticket\":%d,"
      "\"exec_comment\":\"%s\",\"slave_balance\":%s}",
      SLAVE_NAME, exec_ticket, exec_comment, slave_bal);

   char req[], res[];
   string res_headers;
   StringToCharArray(body, req, 0, StringLen(body));

   int code = WebRequest("PATCH", url, headers, 5000, req, res, res_headers);
   if(code != 200 && code != 204)
      PrintFormat("[GS-Slave] ERROR PATCH sig_id=%d code=%d", sig_id, code);
}

//── Reportar balance y Day PnL a Supabase ───────────────────────────
void ReportBalance() {
   MqlDateTime dt;
   TimeCurrent(dt);
   if(dt.day_of_year != g_current_day) {
      g_current_day      = dt.day_of_year;
      g_day_start_equity = AccountInfoDouble(ACCOUNT_EQUITY);
   }
   double balance    = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity     = AccountInfoDouble(ACCOUNT_EQUITY);
   double profit     = AccountInfoDouble(ACCOUNT_PROFIT);
   double day_profit = equity - g_day_start_equity;

   string url     = SUPABASE_URL + "/rest/v1/copy_balances";
   string headers = "Content-Type: application/json\r\n"
                  + "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Prefer: resolution=merge-duplicates,return=minimal";
   string body = StringFormat(
      "{\"account_name\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,"
      "\"profit\":%.2f,\"day_profit\":%.2f}",
      SLAVE_NAME, balance, equity, profit, day_profit);
   char req[], res[];
   string res_headers;
   StringToCharArray(body, req, 0, StringLen(body));
   WebRequest("POST", url, headers, 5000, req, res, res_headers);
}

//── Sincronizar posiciones al inicio (o al reactivar) ───────────────
void SyncPositionsOnInit() {
   if(StringLen(g_master_name) == 0) return;
   Print("[GS-Slave] SYNC: verificando posiciones activas del maestro...");

   datetime since = TimeGMT() - 86400;
   MqlDateTime dt;
   TimeToStruct(since, dt);
   string cutoff = StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);

   string url = SUPABASE_URL
      + "/rest/v1/copy_signals"
      + "?master_name=eq." + UrlEncode(g_master_name)
      + "&created_at=gte." + cutoff
      + "&order=id.asc"
      + "&limit=500";

   string headers = "apikey: " + SUPABASE_KEY + "\r\n"
                  + "Authorization: Bearer " + SUPABASE_KEY + "\r\n"
                  + "Accept: application/json";
   char req[], res[];
   string res_headers;
   ArrayResize(req, 0);
   int code = WebRequest("GET", url, headers, 10000, req, res, res_headers);
   if(code != 200) { PrintFormat("[GS-Slave] SYNC: error HTTP %d", code); return; }

   string json = CharArrayToString(res);

   // Construir lista de posiciones maestras activas (OPEN sin CLOSE correspondiente)
   long   tickets[500];
   string symbols_s[500];
   string dirs[500];
   double lots_a[500];
   double sls_a[500];
   double tps_a[500];
   int    cnt = 0;

   int scan = 0;
   while(true) {
      int os = StringFind(json, "{", scan); if(os < 0) break;
      int oe = FindObjectEnd(json, os);     if(oe < 0) break;
      string obj = StringSubstr(json, os, oe - os + 1);
      scan = oe + 1;

      string stype  = ParseString(obj, "signal_type");
      long   ticket = (long)ParseLong(obj, "master_ticket");

      if(stype == "OPEN" && cnt < 500) {
         tickets[cnt]   = ticket;
         symbols_s[cnt] = ParseString(obj, "symbol");
         dirs[cnt]      = ParseString(obj, "direction");
         lots_a[cnt]    = ParseDouble(obj, "lots");
         sls_a[cnt]     = ParseDouble(obj, "sl");
         tps_a[cnt]     = ParseDouble(obj, "tp");
         cnt++;
      } else if(stype == "MODIFY") {
         // Actualizar sl/tp con el valor más reciente (señales ordenadas por id asc)
         double mod_sl = ParseDouble(obj, "sl");
         double mod_tp = ParseDouble(obj, "tp");
         for(int i = 0; i < cnt; i++) {
            if(tickets[i] == ticket) {
               if(mod_sl > 0.0) sls_a[i] = mod_sl;
               if(mod_tp > 0.0) tps_a[i] = mod_tp;
               break;
            }
         }
      } else if(stype == "CLOSE") {
         for(int i = 0; i < cnt; i++) {
            if(tickets[i] == ticket) {
               for(int j = i; j < cnt - 1; j++) {
                  tickets[j]   = tickets[j+1];
                  symbols_s[j] = symbols_s[j+1];
                  dirs[j]      = dirs[j+1];
                  lots_a[j]    = lots_a[j+1];
                  sls_a[j]     = sls_a[j+1];
                  tps_a[j]     = tps_a[j+1];
               }
               cnt--;
               break;
            }
         }
      }
   }

   int synced = 0;
   for(int i = 0; i < cnt; i++) {
      string tag = "GS:" + IntegerToString(tickets[i]);
      bool has_pos = false;
      for(int j = 0; j < PositionsTotal(); j++) {
         PositionGetTicket(j);
         if(PositionGetString(POSITION_COMMENT) == tag) { has_pos = true; break; }
      }
      if(!has_pos) {
         string slave_sym = symbols_s[i] + g_symbol_suffix;
         SymbolSelect(slave_sym, true);
         ENUM_ORDER_TYPE ot = (dirs[i] == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
         double price = (ot == ORDER_TYPE_BUY)
            ? SymbolInfoDouble(slave_sym, SYMBOL_ASK)
            : SymbolInfoDouble(slave_sym, SYMBOL_BID);
         if(price > 0.0) {
            double slave_lots = CalcLots(lots_a[i], 0.0, slave_sym);
            bool ok = trade.PositionOpen(slave_sym, ot, slave_lots, price, sls_a[i], tps_a[i], tag);
            if(ok)
               PrintFormat("[GS-Slave] SYNC OPEN %s %s %.2f lots | master_ticket=%d", slave_sym, dirs[i], slave_lots, tickets[i]);
            else
               PrintFormat("[GS-Slave] SYNC ERROR retcode=%d sym=%s", trade.ResultRetcode(), slave_sym);
            synced++;
         } else {
            PrintFormat("[GS-Slave] SYNC SKIP %s: precio=0 (verificar símbolo/sufijo)", slave_sym);
         }
      }
   }
   PrintFormat("[GS-Slave] SYNC: %d posicion(es) sincronizada(s) de %d activas en maestro", synced, cnt);

   // Cerrar posiciones huérfanas: el esclavo tiene GS:{ticket} pero el maestro ya no lo tiene activo
   int closed_orphans = 0;
   for(int j = PositionsTotal() - 1; j >= 0; j--) {
      ulong tkt = PositionGetTicket(j);
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "GS:") != 0) continue; // no es una posición copiada
      string ticket_str = StringSubstr(comment, 3);
      long slave_master_ticket = StringToInteger(ticket_str);
      bool still_active = false;
      for(int k = 0; k < cnt; k++) {
         if(tickets[k] == slave_master_ticket) { still_active = true; break; }
      }
      if(!still_active) {
         bool ok = trade.PositionClose(tkt);
         if(ok) PrintFormat("[GS-Slave] SYNC CLOSE huérfana ticket=%d (tag=%s)", tkt, comment);
         else   PrintFormat("[GS-Slave] SYNC ERROR CLOSE huérfana retcode=%d ticket=%d", trade.ResultRetcode(), tkt);
         closed_orphans++;
      }
   }
   if(closed_orphans > 0)
      PrintFormat("[GS-Slave] SYNC: %d posicion(es) huérfana(s) cerrada(s)", closed_orphans);
}

//── Utilidades JSON ──────────────────────────────────────────────────
long ParseLong(const string &obj, const string &key) {
   string search = "\"" + key + "\":";
   int p = StringFind(obj, search);
   if(p < 0) return 0;
   p += StringLen(search);
   string rest = StringSubstr(obj, p);
   int i = 0;
   while(i < StringLen(rest) && StringGetCharacter(rest, i) == ' ') i++;
   rest = StringSubstr(rest, i);
   string num = "";
   for(i = 0; i < StringLen(rest); i++) {
      ushort c = StringGetCharacter(rest, i);
      if(c == '-' || (c >= '0' && c <= '9')) num += ShortToString(c);
      else break;
   }
   return StringLen(num) > 0 ? (long)StringToInteger(num) : 0;
}

double ParseDouble(const string &obj, const string &key) {
   string search = "\"" + key + "\":";
   int p = StringFind(obj, search);
   if(p < 0) return 0.0;
   p += StringLen(search);
   string rest = StringSubstr(obj, p);
   int i = 0;
   while(i < StringLen(rest) && StringGetCharacter(rest, i) == ' ') i++;
   rest = StringSubstr(rest, i);
   string num = "";
   for(i = 0; i < StringLen(rest); i++) {
      ushort c = StringGetCharacter(rest, i);
      if(c == '-' || c == '.' || (c >= '0' && c <= '9')) num += ShortToString(c);
      else break;
   }
   return StringLen(num) > 0 ? StringToDouble(num) : 0.0;
}

string ParseString(const string &obj, const string &key) {
   string search = "\"" + key + "\":\"";
   int p = StringFind(obj, search);
   if(p < 0) return "";
   p += StringLen(search);
   int end = StringFind(obj, "\"", p);
   if(end < 0) return "";
   return StringSubstr(obj, p, end - p);
}

int FindObjectEnd(const string &s, int start) {
   int depth = 0;
   for(int i = start; i < StringLen(s); i++) {
      ushort c = StringGetCharacter(s, i);
      if(c == '{') depth++;
      else if(c == '}') { depth--; if(depth == 0) return i; }
   }
   return -1;
}

string UrlEncode(const string &s) {
   string r = s;
   StringReplace(r, " ", "%20");
   return r;
}
