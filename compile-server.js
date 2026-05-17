// GlobalSairu — Servidor local de compilación de EAs
// Ejecutar con: npm run compile-server
// El panel de Conectar MT5 lo detecta automáticamente y genera .ex5 por cuenta

const http        = require('http')
const { execFileSync } = require('child_process')
const fs          = require('fs')
const path        = require('path')

const PORT         = 3001
const TEMPLATE     = 'C:\\Users\\MT5\\OneDrive\\Desktop\\Journal\\MT5_EA\\GlobalSairu_Journal.mq5'
const ADVISORS_DIR = 'C:\\Users\\MT5\\AppData\\Roaming\\MetaQuotes\\Terminal\\53785E099C927DB68A545C249CDBCE06\\MQL5\\Experts\\Advisors'
const META_EDITOR  = 'C:\\Users\\MT5\\AppData\\Roaming\\MetaTrader 5 IC Markets Global\\MetaEditor64.exe'

function compileForAccount(accountName) {
  const safeName = accountName.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const mq5Path  = path.join(ADVISORS_DIR, `GS_Journal_${safeName}.mq5`)
  const ex5Path  = path.join(ADVISORS_DIR, `GS_Journal_${safeName}.ex5`)
  const logPath  = path.join(process.env.TEMP || 'C:\\Temp', 'mq5compile.log')

  // Leer plantilla y reemplazar nombre de cuenta
  const template = fs.readFileSync(TEMPLATE, 'utf8')
  const source   = template.replace(
    /input string JOURNAL_ACCOUNT\s*=\s*"[^"]*";/,
    `input string JOURNAL_ACCOUNT   = "${accountName}";`
  )

  fs.writeFileSync(mq5Path, source, 'utf8')
  execFileSync(META_EDITOR, [`/compile:${mq5Path}`, `/log:${logPath}`], { timeout: 30000 })

  if (!fs.existsSync(ex5Path)) {
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf16le') : 'sin log'
    throw new Error('Compilación fallida: ' + log.slice(0, 300))
  }

  return { ex5Path, safeName }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/ping') {
    res.setHeader('Content-Type', 'application/json')
    res.end('{"status":"ok"}')
    return
  }

  if (url.pathname === '/compile-ea') {
    const account = url.searchParams.get('account') || ''
    if (!account) { res.writeHead(400); res.end('Falta parámetro account'); return }

    console.log(`⚙  Compilando EA para: "${account}"...`)
    try {
      const { ex5Path, safeName } = compileForAccount(account)
      const data = fs.readFileSync(ex5Path)
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="GlobalSairu_Journal_${safeName}.ex5"`)
      res.setHeader('Content-Length', data.length)
      res.writeHead(200)
      res.end(data)
      console.log(`✓  Enviado: GlobalSairu_Journal_${safeName}.ex5 (${data.length} bytes)`)
    } catch (e) {
      console.error('✗  Error:', e.message)
      res.writeHead(500)
      res.end(e.message)
    }
    return
  }

  res.writeHead(404); res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✓  GlobalSairu Compile Server activo → http://localhost:${PORT}`)
  console.log(`   MetaEditor : ${META_EDITOR}`)
  console.log(`   Advisors   : ${ADVISORS_DIR}`)
  console.log(`   Plantilla  : ${TEMPLATE}\n`)
})
