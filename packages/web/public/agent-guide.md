# AlgoArena Agent Guide

Everything an AI agent or trading bot needs to interact with the AlgoArena paper trading API.

## Base URL

```
https://algoarena.markets/api/v1
```

## Authentication

Three header-based auth levels. No OAuth, no tokens — just headers on every request.

| Header | Required For | Description |
|---|---|---|
| `x-master-key` | Admin endpoints | Server-level master key for creating API keys |
| `x-algoarena-api-key` | Write endpoints | API key for placing/cancelling orders, creating users |
| `x-algoarena-cuid` | All user endpoints | User CUID — identifies which portfolio to operate on |

## Health Check

Before starting a trading session, verify the API is available:

```
GET /api/v1/health
# No authentication required

# Response:
{ "status": "ok", "timestamp": "2025-01-15T10:30:00.000Z" }
```

## Setup Flow

Run these steps once to get credentials:

```bash
# 1. Request an API key (self-service, rate limited to 3 per 15 minutes)
curl -X POST https://algoarena.markets/api/v1/auth/request-key \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "email": "jane@example.com"}'
# Response: { "message": "Your request has been submitted. You will receive an email when your API key is ready." }

# 2. Create a user (requires API key)
curl -X POST https://algoarena.markets/api/v1/auth/users \
  -H "x-algoarena-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-strategy", "startingBalance": "100000", "pdtEnforced": false}'
# Response: { "cuid": "YOUR_CUID", ... }

# Save YOUR_API_KEY and YOUR_CUID — use them on all subsequent requests.
```

## Trading

### Place an Order

```
POST /api/v1/trading/orders
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
}
```

### Cancel an Order

```
DELETE /api/v1/trading/orders/:orderId
Headers: x-algoarena-api-key, x-algoarena-cuid
```

### List Orders

```
GET /api/v1/trading/orders?status=pending&symbol=AAPL&limit=50&offset=0
Headers: x-algoarena-cuid

Statuses: pending | filled | partially_filled | cancelled | expired | rejected
```

### Get Order with Fills

```
GET /api/v1/trading/orders/:orderId
Headers: x-algoarena-cuid
```

## Crypto Trading

AlgoArena supports cryptocurrency trading alongside equities via the same API. Crypto markets are always open (24/7).

### Symbol Format

Use slash notation (`BTC/USD`) or compact notation (`BTCUSD`) — both are accepted and normalized automatically. URL-encode the slash when using path parameters: `GET /api/v1/market/quotes/BTC%2FUSD`.

### Supported Order Types

- `market` — fills immediately (crypto is always open)
- `limit` — evaluated every 60 seconds
- `stop_limit` — evaluated every 60 seconds
- `trailing_stop` — sell-side only, server-side HWM tracking, evaluated every 60 seconds

**Not supported for crypto:** `stop` orders.

### Supported Time In Force

- `gtc` — good until cancelled
- `ioc` — immediate or cancel

**Not supported for crypto:** `day`, `fok`.

### Key Differences from Equities

- **Always open** — crypto orders fill and evaluate 24/7, no market hours restriction
- **No short selling** — sell side is long-close only
- **No PDT rules** — pattern day trader restrictions do not apply
- **No margin** — crypto positions are not marginable

### Crypto Market Data

```
# Crypto clock (always returns isOpen: true)
GET /api/v1/market/clock?class=crypto
Headers: x-algoarena-cuid

# List crypto assets
GET /api/v1/market/assets?asset_class=crypto
Headers: x-algoarena-cuid

# Crypto quote
GET /api/v1/market/quotes/BTC%2FUSD
Headers: x-algoarena-cuid

# Mixed quotes (equity + crypto in one call)
GET /api/v1/market/quotes?symbols=AAPL,BTC/USD
Headers: x-algoarena-cuid
```

### Example: Buy Crypto

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "BTC/USD",
  "side": "buy",
  "type": "market",
  "quantity": "0.01",
  "timeInForce": "gtc"
}
```

## Trailing Stop Orders

Trailing stops automatically adjust the stop price as the market moves in your favor. The server tracks the high-water mark (HWM) and computes the trigger price every 60 seconds.

### Rules

- **Sell-side only** — trailing stops close existing long positions
- **One trail parameter** — set `trailPercent` OR `trailPrice`, not both
- `trailPercent`: percentage drop from HWM to trigger (> 0, <= 50)
- `trailPrice`: dollar amount drop from HWM to trigger (> 0)
- **Time in force**: `day` or `gtc` only (`ioc`/`fok` not supported)
- **Works for crypto** — use `gtc` time-in-force
- `limitPrice` and `stopPrice` must NOT be set

### Example

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "sell",
  "type": "trailing_stop",
  "quantity": "10",
  "trailPercent": "3.0",
  "timeInForce": "gtc"
}
```

The response includes `highWaterMark` and `trailingStopPrice` fields showing the initial HWM (current bid) and computed stop price. These update automatically as the price rises.

## Bracket Orders (OTO / OCO)

Bracket orders let you attach take-profit and/or stop-loss exits to any entry order. When the entry fills, the server automatically creates the child exit orders and links them as an OCO pair — when one child fills, the other is cancelled.

### Request Format

Add a `bracket` object to any order (except `trailing_stop`):

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "buy",
  "type": "market",
  "quantity": "10",
  "timeInForce": "day",
  "bracket": {
    "takeProfit": {
      "limitPrice": "200.00"
    },
    "stopLoss": {
      "stopPrice": "170.00"
    }
  }
}
```

### Rules

- **Optional on any order type** except `trailing_stop`
- `bracket.takeProfit` and `bracket.stopLoss` are each optional, but at least one must be present
- **Children auto-created on full fill** — the server creates opposite-side limit (TP) and stop/stop_limit (SL) child orders
- **OCO behavior** — TP and SL are linked; when one fills, the other is cancelled automatically
- For **buy** brackets: `takeProfit.limitPrice` must be > `stopLoss.stopPrice`
- For **sell** brackets: `takeProfit.limitPrice` must be < `stopLoss.stopPrice`
- Child orders are always `gtc` time-in-force

### Stop-Limit Exit Example

To use a stop-limit (instead of a bare stop) for the stop-loss child, include `limitPrice` in the `stopLoss`:

```
"bracket": {
  "takeProfit": { "limitPrice": "200.00" },
  "stopLoss": { "stopPrice": "170.00", "limitPrice": "169.50" }
}
```

### Response

When the entry fills, the response includes child order IDs:

```json
{
  "id": "entry-order-uuid",
  "status": "filled",
  "bracket": {
    "takeProfitOrderId": "tp-child-uuid",
    "stopLossOrderId": "sl-child-uuid"
  }
}
```

### Standalone OCO

You can link any two pending orders as an OCO pair (without a bracket entry) using `ocoLinkedTo`:

```
POST /api/v1/trading/orders
{
  "symbol": "AAPL",
  "side": "sell",
  "type": "limit",
  "quantity": "10",
  "limitPrice": "200.00",
  "timeInForce": "gtc",
  "ocoLinkedTo": "existing-order-uuid"
}
```

Both orders must be for the same symbol. When one fills, the other is automatically cancelled.

### Crypto Note

For crypto brackets, `stopLoss` requires `limitPrice` (stop_limit). Bare stop orders are not supported for crypto assets.

## Options Trading

AlgoArena supports options trading alongside equities and crypto. Options use OCC symbol format and follow equity market hours.

### Symbol Format

Options use the OCC symbology: `AAPL260320C00230000`
- `AAPL` — underlying symbol (1-6 chars)
- `260320` — expiration date (YYMMDD)
- `C` — call (`C`) or put (`P`)
- `00230000` — strike price * 1000 (e.g. 230.00 = 00230000)

### Options Market Data

```
# Get option chain for an underlying
GET /api/v1/market/options/chain/AAPL
GET /api/v1/market/options/chain/AAPL?expiration=2026-03-20&type=call
Headers: x-algoarena-cuid

# Get available expiration dates
GET /api/v1/market/options/expirations/AAPL
Headers: x-algoarena-cuid

# Get quote for a specific option contract
GET /api/v1/market/options/quotes/AAPL260320C00230000
Headers: x-algoarena-cuid
```

### Supported Order Types

- `market` — fills immediately during market hours
- `limit` — evaluated every 60 seconds during market hours

**Not supported for options:** `stop`, `stop_limit`, `trailing_stop`.

### Supported Time In Force

- `day` — expires at market close
- `gtc` — good until cancelled or expiration

**Not supported for options:** `ioc`, `fok`.

### Key Rules

- **Whole contracts only** — no fractional quantities
- **No short selling** — sell side is long-close only (no naked writing in v1)
- **No PDT rules** — pattern day trader restrictions do not apply to options
- **Multiplier = 100** — cash impact = price * quantity * 100
- **No brackets** — bracket orders not supported for options
- **No trailing stops** — trailing stop parameters not supported for options

### Example: Buy a Call Option

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL260320C00230000",
  "side": "buy",
  "type": "market",
  "quantity": "1",
  "timeInForce": "day"
}
```

Cash deducted: ask price * 1 * 100 (e.g. if ask = $5.20, cost = $520).

### Multi-Leg Orders

Place 2-4 option legs atomically as one order. All legs must share the same underlying and expiration.

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

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
}
```

Rules:
- All legs must be valid OCC option symbols
- All legs must share the same underlying and expiration
- 2-4 legs allowed
- All-or-nothing: either all legs fill or none

### Expiration Handling

- **ITM options** auto-close at intrinsic value at 4:01 PM ET on expiration day
- **OTM options** expire worthless (position deleted)
- Pending option orders for expiring contracts are expired at the same time
- WebSocket event `option.expired` is emitted for each expired position

## Portfolio

```
# Account summary (cash, equity, P&L, PDT status)
GET /api/v1/portfolio/account
Headers: x-algoarena-cuid

# All open positions with unrealized P&L
GET /api/v1/portfolio/positions
Headers: x-algoarena-cuid

# Single position
GET /api/v1/portfolio/positions/:symbol
Headers: x-algoarena-cuid

# Portfolio value history (wrapped with drawdown)
GET /api/v1/portfolio/history?period=30d
Headers: x-algoarena-cuid
# Periods: 7d, 30d, 90d, ytd, 1y, all
# Response: { period, interval: "1d", snapshots: [{ date, equity, cash, positionsValue, dayPnl, totalPnl, drawdown }] }

# Enhanced trade history (with FIFO round-trip matching)
GET /api/v1/portfolio/trades?limit=50&offset=0&symbol=AAPL&side=buy&startDate=2026-01-01&endDate=2026-02-01
Headers: x-algoarena-cuid
# Response: { trades: [{ id, orderId, symbol, side, quantity, price, total, timestamp, roundTrip }], pagination: { total, limit, offset } }
# roundTrip (on closing fills): { entryPrice, exitPrice, pnl, returnPct, holdingDays }
```

## Portfolio Analytics

```
# Full portfolio analytics (Sharpe, drawdown, win rate, benchmark comparison)
GET /api/v1/portfolio/analytics?period=all&benchmark=SPY
Headers: x-algoarena-cuid

# Periods: 7d, 30d, 90d, ytd, 1y, all (default: all)
# Benchmark: any 1-5 letter symbol (default: SPY)
```

Response structure:

```json
{
  "period": "all",
  "startDate": "2026-01-01",
  "endDate": "2026-02-16",
  "startingEquity": "100000.00",
  "endingEquity": "105000.00",
  "returns": {
    "totalReturn": "0.0500",
    "annualizedReturn": "0.1200",
    "dailyReturns": { "mean": "0.000200", "stdDev": "0.010000", "min": "-0.030000", "max": "0.025000", "positive": 15, "negative": 10, "flat": 2 }
  },
  "risk": {
    "sharpeRatio": 1.25,
    "sortinoRatio": 1.80,
    "maxDrawdown": "-0.0500",
    "maxDrawdownDuration": 5,
    "currentDrawdown": "-0.0100",
    "volatility": "0.1587",
    "beta": 0.85,
    "alpha": 0.0200,
    "calmarRatio": 2.40,
    "valueAtRisk95": "-0.016000"
  },
  "benchmark": {
    "symbol": "SPY",
    "totalReturn": "0.0300",
    "sharpeRatio": 0.90,
    "maxDrawdown": "-0.0400",
    "correlation": 0.75
  },
  "trading": {
    "totalTrades": 25,
    "winRate": "0.6000",
    "avgWin": "500.00",
    "avgLoss": "-200.00",
    "profitFactor": "1.50",
    "avgHoldingPeriod": "3.5",
    "largestWin": "2000.00",
    "largestLoss": "-800.00",
    "expectancy": "180.00"
  }
}
```

Notes:
- Risk ratios (Sharpe, Sortino, beta, alpha, Calmar, VaR95) require at least 5 days of data — returns `null` if insufficient
- Benchmark section returns `null` if benchmark data is unavailable
- Trading metrics are based on FIFO round-trip matching from fills
- Analytics are cached for 5 minutes, history for 60 seconds

## Market Data

```
# Single quote
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
Headers: x-algoarena-cuid
```

## Account Management

```
# List users under your API key
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
Body: { "startingBalance": "100000" }  // optional, defaults to $100k
```

## WebSocket Events

```
Connect: wss://algoarena.markets/api/v1/ws

// Auth is via HTTP headers on the WebSocket handshake (same as REST):
//   x-algoarena-api-key: YOUR_API_KEY
//   x-algoarena-cuid: YOUR_CUID
//
// Example with wscat:
// wscat -c wss://algoarena.markets/api/v1/ws \
//   -H "x-algoarena-api-key: YOUR_API_KEY" \
//   -H "x-algoarena-cuid: YOUR_CUID"

// Events you'll receive:
order.filled            — order fully filled
order.partially_filled  — partial fill
order.cancelled         — order cancelled
order.rejected          — order rejected
order.expired           — order expired (day orders at close)
option.expired          — option expired (ITM auto-closed or OTM worthless)
market.session          — session change (pre_market, regular, after_hours, closed)
margin.warning          — approaching maintenance margin breach
margin.liquidation      — positions liquidated
pdt.warning             — approaching PDT limit
pdt.restricted          — PDT restriction applied
risk.order_rejected     — order rejected by risk controls
risk.loss_limit         — loss/drawdown limit triggered
risk.warning            — approaching a risk limit
heartbeat               — every 30 seconds
```

## Extended Hours Trading

AlgoArena supports pre-market (4:00 AM - 9:30 AM ET) and after-hours (4:00 PM - 8:00 PM ET) trading via the `extendedHours` flag on orders.

### How to Use

Add `"extendedHours": true` to your order request:

```
POST /api/v1/trading/orders
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

{
  "symbol": "AAPL",
  "side": "buy",
  "type": "limit",
  "quantity": "10",
  "limitPrice": "150.00",
  "timeInForce": "day",
  "extendedHours": true
}
```

### Rules

- **Limit orders only** — market, stop, stop_limit, and trailing_stop are not allowed
- **Time in force**: `day` or `gtc` only (no `ioc`/`fok`)
- **No brackets** — cannot combine with bracket orders
- **No trailing stops** — cannot combine with trail parameters
- **Not for crypto** — crypto trades 24/7, no extended hours needed
- **Not for options** — options don't have extended hours sessions
- **Day order expiration**: Extended hours day orders expire at 8:00 PM ET (instead of 4:00 PM)
- **Default is false** — existing behavior is unchanged when omitted

### Clock Endpoint

The market clock endpoint returns session information:

```
GET /api/v1/market/clock
Headers: x-algoarena-cuid

Response:
{
  "timestamp": "...",
  "isOpen": false,
  "session": "after_hours",
  "nextOpen": "...",
  "nextClose": "...",
  "sessions": {
    "preMarket": { "start": "04:00", "end": "09:30" },
    "regular": { "start": "09:30", "end": "16:00" },
    "afterHours": { "start": "16:00", "end": "20:00" }
  }
}
```

Sessions: `pre_market`, `regular`, `after_hours`, `closed`.

## Order Execution Rules

- **Market orders:** Fill immediately at ask (buy) or bid (sell) during market hours. Queued until 9:30 AM ET if placed outside hours.
- **Limit orders:** Evaluated every 60 seconds during market hours.
- **Stop / Stop-limit orders:** Trigger evaluated every 60 seconds during market hours.
- **Trailing stop orders:** Sell-side only. HWM tracked server-side, evaluated every 60 seconds. Triggers when bid drops to or below the trailing stop price.
- **IOC (Immediate or Cancel):** Evaluated once at placement. Cancelled if not fillable.
- **FOK (Fill or Kill):** Evaluated once at placement. Rejected if not fully fillable.
- **Day orders:** Automatically expired at 4:00 PM ET (or 8:00 PM ET with `extendedHours: true`).
- **Short selling:** Supported with 50% initial margin, 25% maintenance margin, and tiered borrow fees.
- **Bracket orders (OTO/OCO):** Attach `bracket.takeProfit` and/or `bracket.stopLoss` to any order (except trailing_stop). Children are created on full fill and linked as OCO — when one fills, the other is cancelled.
- **Fractional shares:** Quantities support up to 6 decimal places.

## Risk Controls

Configurable per-user risk limits that evaluate every order before execution.

### Get Risk Controls & Status

```
GET /api/v1/trading/risk-controls
Headers: x-algoarena-cuid

Response:
{
  "userId": "YOUR_CUID",
  "controls": {
    "maxPositionPct": "0.2500",
    "maxPositionValue": null,
    "maxPositions": 50,
    "maxOrderValue": null,
    "maxOrderQuantity": null,
    "maxPriceDeviationPct": "0.1000",
    "maxDailyTrades": 100,
    "maxDailyNotional": null,
    "maxDailyLossPct": null,
    "maxDrawdownPct": null,
    "autoFlattenOnLoss": false,
    "shortSellingEnabled": true,
    "maxShortExposurePct": "0.5000",
    "maxSingleShortPct": "0.1500"
  },
  "status": {
    "dailyTradeCount": 5,
    "dailyNotional": "15000.00",
    "dailyPnl": "-200.00",
    "dailyPnlPct": "-0.002000",
    "currentDrawdown": "-0.010000",
    "shortExposurePct": "0.050000",
    "largestPositionPct": "0.150000",
    "positionCount": 3,
    "isRestricted": false,
    "restrictionReason": null
  }
}
```

### Update Risk Controls

```
PUT /api/v1/trading/risk-controls
Headers: x-algoarena-api-key, x-algoarena-cuid
Content-Type: application/json

// Apply a preset profile:
{ "profile": "conservative" }

// Or set individual limits:
{
  "maxPositionPct": "0.15",
  "maxDailyTrades": 20,
  "shortSellingEnabled": false
}

// Profiles: conservative, moderate, aggressive, unrestricted
// Set a field to null to remove the limit
```

### Risk Events

```
GET /api/v1/trading/risk-controls/events?limit=50&offset=0
Headers: x-algoarena-cuid
```

### Risk Control Fields

| Field | Default | Description |
|---|---|---|
| maxPositionPct | 0.25 | Max position as % of equity |
| maxPositionValue | null | Max position value in dollars |
| maxPositions | 50 | Max number of open positions |
| maxOrderValue | null | Max single order value |
| maxOrderQuantity | null | Max single order quantity |
| maxPriceDeviationPct | 0.10 | Max limit/stop price deviation from market |
| maxDailyTrades | 100 | Max trades per day |
| maxDailyNotional | null | Max daily notional volume |
| maxDailyLossPct | null | Max daily loss as % of starting balance |
| maxDrawdownPct | null | Max drawdown from peak equity |
| autoFlattenOnLoss | false | Auto-close all positions on loss/drawdown breach |
| shortSellingEnabled | true | Whether short selling is allowed |
| maxShortExposurePct | 0.50 | Max total short exposure as % of equity |
| maxSingleShortPct | 0.15 | Max single short position as % of equity |

### WebSocket Events

```
risk.order_rejected  — order rejected by risk controls (includes violations array)
risk.loss_limit      — loss/drawdown limit triggered (includes action: auto_flatten or warning)
risk.warning         — approaching a risk limit
```

## Stats

```
# Trading activity over time (public, no auth required)
GET /api/v1/stats/activity?days=30
```

## Rate Limits

| Endpoint Group | Limit |
|---|---|
| Market Data | 120 requests / minute |
| Portfolio | 60 requests / minute |
| Trading | 30 requests / minute |
| Key Requests | 3 requests / 15 minutes |

Rate limits are per CUID (or per IP for unauthenticated endpoints). Exceeding the limit returns HTTP 429.

Every response includes rate limit headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Seconds until the window resets |
| `Retry-After` | Seconds until the block expires (only present on 429 responses) |

Use these headers to self-throttle and avoid 429 errors.

## Error Format

```json
{
  "statusCode": 400,
  "message": ["symbol must be a string", "side must be one of: buy, sell"],
  "error": "BadRequestException",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/v1/trading/orders"
}
```

## Example: Full Trading Loop

```
# 0. Verify API is up
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
GET /api/v1/portfolio/trades
```

## OpenAPI Spec

Full OpenAPI 3.0 spec available at `/api/v1/openapi.json`. Interactive docs at `/docs`.
