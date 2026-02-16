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
  "type": "market",         // market | limit | stop | stop_limit
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

# Portfolio value history (snapshots)
GET /api/v1/portfolio/history?days=30
Headers: x-algoarena-cuid

# Trade history (closed round-trips)
GET /api/v1/portfolio/trades?limit=50&offset=0&symbol=AAPL
Headers: x-algoarena-cuid
```

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
margin.warning          — approaching maintenance margin breach
margin.liquidation      — positions liquidated
pdt.warning             — approaching PDT limit
pdt.restricted          — PDT restriction applied
heartbeat               — every 30 seconds
```

## Order Execution Rules

- **Market orders:** Fill immediately at ask (buy) or bid (sell) during market hours. Queued until 9:30 AM ET if placed outside hours.
- **Limit orders:** Evaluated every 60 seconds during market hours.
- **Stop / Stop-limit orders:** Trigger evaluated every 60 seconds during market hours.
- **IOC (Immediate or Cancel):** Evaluated once at placement. Cancelled if not fillable.
- **FOK (Fill or Kill):** Evaluated once at placement. Rejected if not fully fillable.
- **Day orders:** Automatically expired at 4:00 PM ET.
- **Short selling:** Supported with 50% initial margin, 25% maintenance margin, and tiered borrow fees.
- **Fractional shares:** Quantities support up to 6 decimal places.

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
