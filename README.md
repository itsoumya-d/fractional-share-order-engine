# Fractional Share Order Engine

High-precision fractional share investment order execution, market hours routing, and pooled custody allocation engine in TypeScript and Node.js.

## Problem
In retail investment and wealth-tech platforms, users submit cash-amount stock purchases (e.g., invest £50 in a £420 stock). The broker must validate trading session hours, atomically aggregate multiple fractional orders into whole-share market lots, execute against liquidity venues, and proportionally distribute fractional share quantities down to 8 decimal places without floating-point drift or penny-fraction leakage.

## Architecture
- **Market Hours Routing**: Enforces market operating calendars (LSE regular hours 08:00–16:30 London time, excluding weekends and exchange holidays), queueing off-market orders for session opening.
- **Order Aggregator & Netting**: Batches buy and sell orders for a single ticker to minimize exchange execution costs and broker inventory risk.
- **Fixed-Point Decimal Math**: Eliminates IEEE-754 floating-point inaccuracies using scaled micro-share and fractional-cent integers.
- **Custody Allocation & Ledger**: Updates user portfolio balances and audit journals with strict idempotency and atomic isolation.

## Running Tests
```bash
npm install
npm test
```
