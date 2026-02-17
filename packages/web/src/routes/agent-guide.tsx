import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/agent-guide')({
  component: AgentGuidePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-foreground mb-3 border-b border-border pb-1">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm leading-relaxed my-3 whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function AgentGuidePage() {
  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">AlgoArena Agent Guide</h1>
        <p className="text-muted-foreground mb-8">
          Everything an AI agent or trading bot needs to interact with the AlgoArena paper trading API.
        </p>

        <Section title="Base URL">
          <Code>{baseUrl}/api/v1</Code>
        </Section>

        <Section title="Authentication">
          <p className="text-muted-foreground mb-3">
            Three header-based auth levels. No OAuth, no tokens — just headers on every request.
          </p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Header</th>
                <th className="py-2 pr-4">Required For</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">x-master-key</td>
                <td className="py-2 pr-4">Admin endpoints</td>
                <td className="py-2">Server-level master key for creating API keys</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">x-algoarena-api-key</td>
                <td className="py-2 pr-4">Write endpoints</td>
                <td className="py-2">API key for placing/cancelling orders, creating users</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">x-algoarena-cuid</td>
                <td className="py-2 pr-4">All user endpoints</td>
                <td className="py-2">User CUID — identifies which portfolio to operate on</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Health Check">
          <p className="text-muted-foreground mb-2">Before starting a trading session, verify the API is available:</p>
          <Code>{`GET /api/v1/health
# No authentication required

# Response:
{ "status": "ok", "timestamp": "2025-01-15T10:30:00.000Z" }`}</Code>
        </Section>

        <Section title="Setup Flow">
          <p className="text-muted-foreground mb-2">Run these steps once to get credentials:</p>
          <Code>{`# 1. Request an API key (self-service, rate limited to 3 per 15 minutes)
curl -X POST ${baseUrl}/api/v1/auth/request-key \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Jane Doe", "email": "jane@example.com"}'
# Response: { "message": "Your request has been submitted. You will receive an email when your API key is ready." }

# 2. Create a user (requires API key)
curl -X POST ${baseUrl}/api/v1/auth/users \\
  -H "x-algoarena-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"label": "my-strategy", "startingBalance": "100000", "pdtEnforced": false}'
# Response: { "cuid": "YOUR_CUID", ... }

# Save YOUR_API_KEY and YOUR_CUID — use them on all subsequent requests.`}</Code>
        </Section>

        <Section title="Trading">
          <h3 className="font-semibold mb-2">Place an Order</h3>
          <Code>{`POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "buy",            // buy | sell
  "type": "market",         // market | limit | stop | stop_limit | trailing_stop
  "quantity": "10",          // string, supports up to 6 decimal places
  "timeInForce": "day",     // day | gtc | ioc | fok
  "limitPrice": "150.00",   // required for limit and stop_limit orders
  "stopPrice": "145.00"     // required for stop and stop_limit orders
}`}</Code>

          <h3 className="font-semibold mb-2">Cancel an Order</h3>
          <Code>{`DELETE /api/v1/trading/orders/:orderId
Headers: x-algoarena-api-key, x-algoarena-cuid`}</Code>

          <h3 className="font-semibold mb-2">List Orders</h3>
          <Code>{`GET /api/v1/trading/orders?status=pending&symbol=AAPL&limit=50&offset=0
Headers: x-algoarena-cuid

Statuses: pending | filled | partially_filled | cancelled | expired | rejected`}</Code>

          <h3 className="font-semibold mb-2">Get Order with Fills</h3>
          <Code>{`GET /api/v1/trading/orders/:orderId
Headers: x-algoarena-cuid`}</Code>
        </Section>

        <Section title="Crypto Trading">
          <p className="text-muted-foreground mb-3">
            AlgoArena supports cryptocurrency trading alongside equities via the same API. Crypto markets are always
            open (24/7).
          </p>

          <h3 className="font-semibold mb-2">Symbol Format</h3>
          <p className="text-muted-foreground mb-3">
            Use slash notation (<code>BTC/USD</code>) or compact notation (<code>BTCUSD</code>) — both are accepted.
            URL-encode the slash in path parameters: <code>/market/quotes/BTC%2FUSD</code>.
          </p>

          <h3 className="font-semibold mb-2">Supported Order Types & TIF</h3>
          <div className="text-muted-foreground space-y-1 mb-3">
            <p>
              <strong>Order types:</strong> market, limit, stop_limit, trailing_stop (NOT stop)
            </p>
            <p>
              <strong>Time in force:</strong> gtc, ioc (NOT day, fok)
            </p>
          </div>

          <h3 className="font-semibold mb-2">Key Differences from Equities</h3>
          <div className="text-muted-foreground space-y-1 mb-3">
            <p>Always open — crypto orders fill and evaluate 24/7</p>
            <p>No short selling — sell side is long-close only</p>
            <p>No PDT rules — pattern day trader restrictions do not apply</p>
            <p>No margin — crypto positions are not marginable</p>
          </div>

          <h3 className="font-semibold mb-2">Crypto Market Data</h3>
          <Code>{`# Crypto clock (always returns isOpen: true)
GET /api/v1/market/clock?class=crypto

# List crypto assets
GET /api/v1/market/assets?asset_class=crypto

# Crypto quote (URL-encode the slash)
GET /api/v1/market/quotes/BTC%2FUSD

# Mixed quotes (equity + crypto)
GET /api/v1/market/quotes?symbols=AAPL,BTC/USD`}</Code>

          <h3 className="font-semibold mb-2">Example: Buy Crypto</h3>
          <Code>{`POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "BTC/USD",
  "side": "buy",
  "type": "market",
  "quantity": "0.01",
  "timeInForce": "gtc"
}`}</Code>
        </Section>

        <Section title="Trailing Stop Orders">
          <p className="text-muted-foreground mb-3">
            Trailing stops automatically adjust the stop price as the market moves in your favor. The server tracks the
            high-water mark (HWM) and computes the trigger price every 60 seconds.
          </p>

          <h3 className="font-semibold mb-2">Rules</h3>
          <div className="text-muted-foreground space-y-1 mb-3">
            <p>Sell-side only — trailing stops close existing long positions</p>
            <p>
              Set <code>trailPercent</code> OR <code>trailPrice</code>, not both
            </p>
            <p>
              <code>trailPercent</code>: percentage drop from HWM to trigger ({'>'} 0, {'<='} 50)
            </p>
            <p>
              <code>trailPrice</code>: dollar amount drop from HWM to trigger ({'>'} 0)
            </p>
            <p>
              Time in force: <code>day</code> or <code>gtc</code> only
            </p>
            <p>
              Works for crypto — use <code>gtc</code> time-in-force
            </p>
          </div>

          <h3 className="font-semibold mb-2">Example</h3>
          <Code>{`POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "sell",
  "type": "trailing_stop",
  "quantity": "10",
  "trailPercent": "3.0",
  "timeInForce": "gtc"
}`}</Code>
          <p className="text-muted-foreground text-sm mt-2">
            The response includes <code>highWaterMark</code> and <code>trailingStopPrice</code> fields showing the
            initial HWM (current bid) and computed stop price. These update automatically as the price rises.
          </p>
        </Section>

        <Section title="Bracket Orders (OTO / OCO)">
          <p className="text-muted-foreground mb-3">
            Bracket orders let you attach take-profit and/or stop-loss exits to any entry order. When the entry fills,
            the server automatically creates child exit orders and links them as an OCO pair.
          </p>

          <h3 className="font-semibold mb-2">Request Format</h3>
          <Code>{`POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "buy",
  "type": "market",
  "quantity": "10",
  "timeInForce": "day",
  "bracket": {
    "takeProfit": { "limitPrice": "200.00" },
    "stopLoss": { "stopPrice": "170.00" }
  }
}`}</Code>

          <h3 className="font-semibold mb-2 mt-4">Rules</h3>
          <div className="text-muted-foreground space-y-1 mb-3">
            <p>
              Optional on any order type except <code>trailing_stop</code>
            </p>
            <p>
              At least one of <code>takeProfit</code> or <code>stopLoss</code> required in bracket
            </p>
            <p>Children auto-created on full fill (opposite side, GTC)</p>
            <p>OCO behavior: when one child fills, the other is cancelled</p>
            <p>
              Buy bracket: <code>takeProfit.limitPrice</code> must be {'>'} <code>stopLoss.stopPrice</code>
            </p>
            <p>
              Sell bracket: <code>takeProfit.limitPrice</code> must be {'<'} <code>stopLoss.stopPrice</code>
            </p>
          </div>

          <h3 className="font-semibold mb-2">Stop-Limit Exit</h3>
          <Code>{`"stopLoss": { "stopPrice": "170.00", "limitPrice": "169.50" }`}</Code>

          <h3 className="font-semibold mb-2 mt-4">Standalone OCO</h3>
          <p className="text-muted-foreground mb-2">
            Link any two pending orders as an OCO pair using <code>ocoLinkedTo</code>:
          </p>
          <Code>{`{
  "symbol": "AAPL",
  "side": "sell",
  "type": "limit",
  "quantity": "10",
  "limitPrice": "200.00",
  "timeInForce": "gtc",
  "ocoLinkedTo": "existing-order-uuid"
}`}</Code>
          <p className="text-muted-foreground text-sm mt-2">
            Crypto note: <code>stopLoss</code> requires <code>limitPrice</code> (stop_limit) for crypto assets.
          </p>
        </Section>

        <Section title="Options Trading">
          <p className="text-muted-foreground mb-3">
            AlgoArena supports options trading alongside equities and crypto. Options use OCC symbol format and follow
            equity market hours.
          </p>

          <h3 className="font-semibold mb-2">Symbol Format (OCC)</h3>
          <p className="text-muted-foreground mb-3">
            <code>AAPL260320C00230000</code> = AAPL, 2026-03-20, Call, $230.00 strike
          </p>

          <h3 className="font-semibold mb-2">Options Market Data</h3>
          <Code>{`# Option chain
GET /api/v1/market/options/chain/AAPL?expiration=2026-03-20&type=call

# Expiration dates
GET /api/v1/market/options/expirations/AAPL

# Option quote
GET /api/v1/market/options/quotes/AAPL260320C00230000`}</Code>

          <h3 className="font-semibold mb-2">Rules</h3>
          <div className="text-muted-foreground space-y-1 mb-3">
            <p>
              <strong>Order types:</strong> market, limit only (NOT stop, stop_limit, trailing_stop)
            </p>
            <p>
              <strong>Time in force:</strong> day, gtc only (NOT ioc, fok)
            </p>
            <p>Whole contracts only — no fractional quantities</p>
            <p>Multiplier = 100 — cash impact = price * qty * 100</p>
            <p>No short selling, no brackets, no trailing stops</p>
          </div>

          <h3 className="font-semibold mb-2">Example: Buy a Call</h3>
          <Code>{`POST /api/v1/trading/orders
{
  "symbol": "AAPL260320C00230000",
  "side": "buy",
  "type": "market",
  "quantity": "1",
  "timeInForce": "day"
}`}</Code>

          <h3 className="font-semibold mb-2">Multi-Leg Orders</h3>
          <Code>{`POST /api/v1/trading/orders
{
  "symbol": "AAPL260320C00230000",
  "side": "buy",
  "type": "market",
  "quantity": "1",
  "timeInForce": "day",
  "orderClass": "multileg",
  "legs": [
    { "symbol": "AAPL260320C00230000", "side": "buy", "quantity": "1", "type": "market" },
    { "symbol": "AAPL260320C00240000", "side": "sell", "quantity": "1", "type": "market" }
  ]
}`}</Code>
          <p className="text-muted-foreground text-sm mt-2">
            2-4 legs allowed. All legs must share the same underlying and expiration. All-or-nothing execution.
          </p>

          <h3 className="font-semibold mb-2 mt-4">Expiration</h3>
          <p className="text-muted-foreground text-sm">
            ITM options auto-close at intrinsic value at 4:01 PM ET. OTM options expire worthless. WebSocket event:{' '}
            <code>option.expired</code>.
          </p>
        </Section>

        <Section title="Portfolio">
          <Code>{`# Account summary (cash, equity, P&L, PDT status)
GET /api/v1/portfolio/account
Headers: x-algoarena-cuid

# All open positions with unrealized P&L
GET /api/v1/portfolio/positions
Headers: x-algoarena-cuid

# Single position
GET /api/v1/portfolio/positions/:symbol
Headers: x-algoarena-cuid

# Portfolio value history (snapshots)
GET /api/v1/portfolio/history?days=30
Headers: x-algoarena-cuid

# Trade history (closed round-trips)
GET /api/v1/portfolio/trades?limit=50&offset=0&symbol=AAPL
Headers: x-algoarena-cuid`}</Code>
        </Section>

        <Section title="Market Data">
          <Code>{`# Single quote
GET /api/v1/market/quotes/:symbol
Headers: x-algoarena-cuid

# Multiple quotes
GET /api/v1/market/quotes?symbols=AAPL,MSFT,GOOG
Headers: x-algoarena-cuid

# Historical bars (single symbol)
GET /api/v1/market/bars/:symbol?timeframe=1Day&limit=30
Headers: x-algoarena-cuid

# Historical bars (multiple symbols, up to 100)
GET /api/v1/market/bars?symbols=AAPL,MSFT,GOOGL&timeframe=1Day&limit=50
Headers: x-algoarena-cuid

# Market snapshot (quote + bars + trade)
GET /api/v1/market/snapshots/:symbol
Headers: x-algoarena-cuid

# Market clock (is market open?)
GET /api/v1/market/clock
Headers: x-algoarena-cuid

# List assets
GET /api/v1/market/assets
Headers: x-algoarena-cuid

# Market calendar
GET /api/v1/market/calendar?start=2025-01-01&end=2025-12-31
Headers: x-algoarena-cuid`}</Code>
        </Section>

        <Section title="Account Management">
          <Code>{`# List users under your API key
GET /api/v1/auth/users
Headers: x-algoarena-api-key

# Get user details
GET /api/v1/auth/users/:cuid
Headers: x-algoarena-cuid

# Revoke an API key (admin only)
DELETE /api/v1/auth/api-keys/:id
Headers: x-master-key

# Reset account (wipes orders, positions, trades — fresh start)
POST /api/v1/auth/users/:cuid/reset
Headers: x-algoarena-api-key
Body: { "startingBalance": "100000" }  // optional, defaults to $100k`}</Code>
        </Section>

        <Section title="WebSocket Events">
          <Code>{`Connect: ${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/ws

// Auth is via HTTP headers on the WebSocket handshake (same as REST):
//   x-algoarena-api-key: YOUR_API_KEY
//   x-algoarena-cuid: YOUR_CUID
//
// Example with wscat:
// wscat -c ${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/ws \\
//   -H "x-algoarena-api-key: YOUR_API_KEY" \\
//   -H "x-algoarena-cuid: YOUR_CUID"

// Events you'll receive:
order.filled            — order fully filled
order.partially_filled  — partial fill
order.cancelled         — order cancelled
order.rejected          — order rejected
order.expired           — order expired (day orders at close)
option.expired          — option expired (ITM auto-closed or OTM worthless)
margin.warning          — approaching maintenance margin breach
margin.liquidation      — positions liquidated
pdt.warning             — approaching PDT limit
pdt.restricted          — PDT restriction applied
heartbeat               — every 30 seconds`}</Code>
        </Section>

        <Section title="Order Execution Rules">
          <div className="text-muted-foreground space-y-2">
            <p>
              <strong>Market orders:</strong> Fill immediately at ask (buy) or bid (sell) during market hours. Queued
              until 9:30 AM ET if placed outside hours.
            </p>
            <p>
              <strong>Limit orders:</strong> Evaluated every 60 seconds during market hours.
            </p>
            <p>
              <strong>Stop / Stop-limit orders:</strong> Trigger evaluated every 60 seconds during market hours.
            </p>
            <p>
              <strong>Trailing stop orders:</strong> Sell-side only. HWM tracked server-side, evaluated every 60
              seconds. Triggers when bid drops to or below the trailing stop price.
            </p>
            <p>
              <strong>IOC (Immediate or Cancel):</strong> Evaluated once at placement. Cancelled if not fillable.
            </p>
            <p>
              <strong>FOK (Fill or Kill):</strong> Evaluated once at placement. Rejected if not fully fillable.
            </p>
            <p>
              <strong>Day orders:</strong> Automatically expired at 4:00 PM ET.
            </p>
            <p>
              <strong>Short selling:</strong> Supported with 50% initial margin, 25% maintenance margin, and tiered
              borrow fees.
            </p>
            <p>
              <strong>Bracket orders (OTO/OCO):</strong> Attach <code>bracket.takeProfit</code> and/or{' '}
              <code>bracket.stopLoss</code> to any order (except trailing_stop). Children are created on full fill and
              linked as OCO — when one fills, the other is cancelled.
            </p>
            <p>
              <strong>Fractional shares:</strong> Quantities support up to 6 decimal places.
            </p>
          </div>
        </Section>

        <Section title="Stats">
          <Code>{`# Trading activity over time (public, no auth required)
GET /api/v1/stats/activity?days=30`}</Code>
        </Section>

        <Section title="Rate Limits">
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Endpoint Group</th>
                <th className="py-2">Limit</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Market Data</td>
                <td className="py-2">120 requests / minute</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Portfolio</td>
                <td className="py-2">60 requests / minute</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Trading</td>
                <td className="py-2">30 requests / minute</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4">Key Requests</td>
                <td className="py-2">3 requests / 15 minutes</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground text-sm mt-2">
            Rate limits are per CUID (or per IP for unauthenticated endpoints). Exceeding the limit returns HTTP 429.
          </p>
          <p className="text-muted-foreground text-sm mt-4 mb-2">Every response includes rate limit headers:</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-4">Header</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Limit</td>
                <td className="py-2">Max requests allowed in the current window</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Remaining</td>
                <td className="py-2">Requests remaining in the current window</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">X-RateLimit-Reset</td>
                <td className="py-2">Seconds until the window resets</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 pr-4 font-mono text-xs">Retry-After</td>
                <td className="py-2">Seconds until the block expires (only present on 429 responses)</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground text-sm mt-2">Use these headers to self-throttle and avoid 429 errors.</p>
        </Section>

        <Section title="Error Format">
          <Code>{`{
  "statusCode": 400,
  "message": ["symbol must be a string", "side must be one of: buy, sell"],
  "error": "BadRequestException",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/v1/trading/orders"
}`}</Code>
        </Section>

        <Section title="Example: Full Trading Loop">
          <Code>{`# 0. Verify API is up
GET /api/v1/health

# 1. Check if market is open
GET /api/v1/market/clock

# 2. Get current price
GET /api/v1/market/quotes/AAPL

# 3. Check account balance
GET /api/v1/portfolio/account

# 4. Place a buy order
POST /api/v1/trading/orders
{ "symbol": "AAPL", "side": "buy", "type": "market", "quantity": "10", "timeInForce": "day" }

# 5. Monitor position
GET /api/v1/portfolio/positions/AAPL

# 6. Sell when ready
POST /api/v1/trading/orders
{ "symbol": "AAPL", "side": "sell", "type": "limit", "quantity": "10", "limitPrice": "180.00", "timeInForce": "gtc" }

# 7. Check trade history
GET /api/v1/portfolio/trades`}</Code>
        </Section>

        <Section title="OpenAPI Spec">
          <p className="text-muted-foreground">
            Full OpenAPI 3.0 spec available at{' '}
            <a href={`${baseUrl}/api/v1/openapi.json`} className="text-primary underline">
              /api/v1/openapi.json
            </a>
            . Interactive docs at{' '}
            <a href={`${baseUrl}/docs`} className="text-primary underline">
              /docs
            </a>
            .
          </p>
        </Section>

        <Section title="Machine-Readable Version">
          <p className="text-muted-foreground">
            A plain markdown version of this guide is available at{' '}
            <a href={`${baseUrl}/agent-guide.md`} className="text-primary underline">
              /agent-guide.md
            </a>{' '}
            for AI agents and automated tools.
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground">
          AlgoArena — Paper trading platform for algorithmic trading strategies
        </div>
      </div>
    </div>
  );
}
