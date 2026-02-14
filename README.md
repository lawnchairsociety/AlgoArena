# AlgoArena

A paper trading platform for testing algorithmic and AI trading strategies against real-time market data. All trading is done via API — the web UI is a read-only dashboard for viewing trades, positions, and market data.

## How It Works

- **API-first trading**: Trading bots and AI agents place orders through a REST API using API keys. No manual trading through the UI.
- **Virtual portfolios**: Each user is identified by a CUID (collision-resistant unique identifier), created via the API. Every CUID gets its own isolated portfolio with a configurable starting balance (default $100k).
- **Real market data, simulated execution**: Market data (quotes, bars, snapshots) comes from Alpaca's SIP feed (NBBO). Orders are simulated against real prices but executed entirely in the database — no real broker orders are placed.
- **PDT enforcement (optional)**: Pattern Day Trader rules can be enabled or disabled per user at creation time, so you can test strategies with or without the 3-day-trade restriction.
- **Short selling**: Full support for short positions with margin requirements (50% initial, 25% maintenance), borrow fee tiers (easy/moderate/hard), and Short Sale Restriction (SSR) simulation.
- **Fractional shares**: All quantities support up to 6 decimal places.

## Architecture

```
algoarena/
├── packages/
│   ├── api/        # NestJS backend — order engine, portfolio, market data, auth
│   ├── web/        # React frontend — read-only dashboard
│   └── shared/     # Shared TypeScript types and constants
└── drizzle.config.ts
```

**Tech stack**: NestJS, React + Vite, PostgreSQL, Valkey, Drizzle ORM, TanStack Query/Router, Tailwind + shadcn/ui, Recharts
**Hosting**: DigitalOcean (managed PostgreSQL + Valkey)

## API Overview

All endpoints are prefixed with `/api/v1`. Four auth levels:

| Level | Header(s) | Use Case |
|---|---|---|
| Admin | `X-Master-Key` | Creating API keys |
| Write | `X-AlgoArena-API-Key` + `X-AlgoArena-CUID` | Placing/cancelling orders (bots & AI agents) |
| Read | `X-AlgoArena-CUID` | Portfolio, orders, positions, market data |
| Public | None | Aggregate platform stats |

### Key Endpoints

- `GET /health` — Health check (no auth required)
- `POST /trading/orders` — Place an order (market, limit, stop, stop-limit)
- `GET /portfolio/account` — Account summary (cash, equity, P&L, day trade count)
- `GET /portfolio/positions` — Current positions with unrealized P&L
- `GET /market/quotes/:symbol` — Latest quote from SIP feed
- `GET /market/bars/:symbol` — Historical price bars

Full API docs served at `/docs` (OpenAPI + Scalar UI).

### Rate Limits

Per-CUID, enforced via Valkey:

| Endpoint Group | Limit |
|---|---|
| Market Data | 120 req/min |
| Portfolio | 60 req/min |
| Trading | 30 req/min |

Every throttled response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers for client-side self-throttling.

## Order Simulation

Orders are evaluated against live Alpaca quotes:

- **Market orders**: Fill immediately at current ask (buy) or bid (sell) during market hours; queued until open if placed after hours.
- **Limit/Stop/Stop-limit**: Evaluated every 60 seconds during market hours against current quotes.
- **IOC/FOK**: Evaluated immediately at placement — no deferred processing.
- **Day orders**: Automatically expired at market close (4:00 PM ET).

## Scheduled Jobs

| Time | Job |
|---|---|
| Every 60s (market hours) | Evaluate pending limit/stop orders |
| 9:30 AM ET | Fill queued market orders |
| 4:00 PM ET | Expire unfilled day orders |
| 4:30 PM ET | Snapshot all portfolios |
| End of day | Accrue borrow fees, check maintenance margin |

## Getting Started

```bash
# Copy environment config
cp .env.example .env
# Edit .env with your Alpaca credentials and a master key

# Start PostgreSQL and Valkey
docker compose up -d

# Install dependencies
pnpm install

# Build shared package
pnpm build:shared

# Run database migrations
pnpm db:migrate

# Start the API server
pnpm dev:api

# Start the frontend
pnpm dev:web
```

The default `.env.example` values match the `docker-compose.yml` services, so the only things you need to fill in are your [Alpaca](https://alpaca.markets/) API credentials (free tier works) and a `MASTER_KEY` of your choice.

### Quick Workflow

1. Generate an API key: `POST /api/v1/auth/api-keys` (requires master key)
2. Create a CUID user: `POST /api/v1/auth/users`
3. Check market data: `GET /api/v1/market/quotes/AAPL` (with `X-AlgoArena-CUID` header)
4. Place an order: `POST /api/v1/trading/orders`
5. View your portfolio: enter your CUID in the web dashboard

## Contributing: Market Data Providers

The market data layer is abstracted behind a `MarketDataProvider` interface, making it straightforward to add new data sources.

### Architecture

```
MarketDataProvider (abstract)       ← defines the contract
  └── AlpacaClientService           ← Alpaca implementation (default)
MarketDataService                   ← caching layer, consumes any provider
MarketDataController                ← REST endpoints
```

The active provider is selected at runtime via the `MARKET_DATA_PROVIDER` environment variable (defaults to `alpaca`).

### Implemented Providers

| Key | Provider | Notes |
|---|---|---|
| `alpaca` | [Alpaca Markets](https://alpaca.markets/) | Free tier available. Requires `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_API_URL`. |

### Adding a New Provider

1. Create `packages/api/src/modules/market-data/your-provider-client.service.ts`
2. Extend `MarketDataProvider` and implement all abstract methods
3. Map your API's response shapes to the canonical types in `types/market-data-provider.types.ts`
4. Register it in the `PROVIDERS` map in `market-data.module.ts`
5. Add any required env vars to `.env.example` and `config/env.validation.ts`
6. Set `MARKET_DATA_PROVIDER=your-key` in `.env`
