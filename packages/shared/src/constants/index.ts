// ── Financial defaults ──

export const DEFAULT_STARTING_BALANCE = '100000.00';
export const DEFAULT_MARGIN_USED = '0.00';

// ── Margin requirements ──

export const INITIAL_MARGIN_REQUIREMENT = 0.5; // 50% for short opens
export const MAINTENANCE_MARGIN_REQUIREMENT = 0.25; // 25% maintenance
export const MARGIN_WARNING_THRESHOLD = 0.05; // warn within 5% of breach

// ── Borrow fee rates (annual) ──

export const BORROW_RATE_EASY = '0.0030'; // 0.30%
export const BORROW_RATE_MODERATE = '0.0500'; // 5.0%
export const BORROW_RATE_HARD = '0.2500'; // 25.0%

// ── Borrow tier classification thresholds ──

export const EASY_BORROW_MIN_MARKET_CAP = 10_000_000_000; // $10B
export const EASY_BORROW_MAX_SHORT_INTEREST = 0.05; // 5%
export const EASY_BORROW_MAX_DAYS_TO_COVER = 3;

export const MODERATE_MIN_MARKET_CAP = 500_000_000; // $500M
export const MODERATE_MAX_MARKET_CAP = 10_000_000_000; // $10B
export const MODERATE_MAX_DAYS_TO_COVER = 7;

export const HARD_BORROW_MAX_MARKET_CAP = 500_000_000; // $500M
export const HARD_BORROW_MIN_SHORT_INTEREST = 0.15; // 15%
export const HIGH_SHORT_INTEREST_THRESHOLD = 0.2; // 20%
export const NOT_SHORTABLE_SHORT_INTEREST = 0.4; // 40%

// ── PDT constants ──

export const PDT_MAX_DAY_TRADES = 3;
export const PDT_ROLLING_WINDOW_DAYS = 5; // business days
export const PDT_MIN_EQUITY = 25_000; // $25,000

// ── Cache TTLs (seconds) ──

export const CACHE_TTL_QUOTES = 5;
export const CACHE_TTL_BARS = 60;
export const CACHE_TTL_CLOCK = 30;
export const CACHE_TTL_ASSETS = 3600; // 1 hour
export const CACHE_TTL_SNAPSHOTS = 5;
export const CACHE_TTL_CALENDAR = 86400; // 24 hours

// ── Alpaca ──

export const ALPACA_DATA_BASE_URL = 'https://data.alpaca.markets';

// ── API ──

export const API_PREFIX = 'api/v1';

// ── Crypto ──

export const CRYPTO_ASSET_CLASS = 'crypto';
export const CRYPTO_ALLOWED_ORDER_TYPES = ['market', 'limit', 'stop_limit'] as const;
export const CRYPTO_ALLOWED_TIF = ['gtc', 'ioc'] as const;

// ── WebSocket ──

export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_MAX_CONNECTIONS_PER_CUID = 5;
export const WS_PATH = '/api/v1/ws';
