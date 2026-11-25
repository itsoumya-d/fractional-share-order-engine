import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OrderEngine } from '../engine.js';
import { isMarketOpen } from '../marketHours.js';

describe('OrderEngine & Market Calendar Tests', () => {
  it('correctly determines market hours in London time', () => {
    // Wednesday 10:30 UTC -> Open
    const openTime = new Date('2026-11-25T10:30:00Z');
    assert.equal(isMarketOpen(openTime), true);

    // Wednesday 07:15 UTC -> Pre-market closed
    const earlyTime = new Date('2026-11-25T07:15:00Z');
    assert.equal(isMarketOpen(earlyTime), false);

    // Wednesday 17:00 UTC -> Post-market closed
    const lateTime = new Date('2026-11-25T17:00:00Z');
    assert.equal(isMarketOpen(lateTime), false);

    // Saturday 12:00 UTC -> Weekend closed
    const weekend = new Date('2026-11-28T12:00:00Z');
    assert.equal(isMarketOpen(weekend), false);
  });

  it('queues orders submitted out of market hours and activates them', () => {
    const engine = new OrderEngine();
    engine.registerUser('usr-1', 500);

    // Submit on Saturday (off-market)
    const weekendTime = new Date('2026-11-28T14:00:00Z');
    const order = engine.submitOrder('usr-1', 'BARC', 'BUY', 100, weekendTime);

    assert.equal(order.status, 'QUEUED_FOR_MARKET_OPEN');
    // Cash should be reserved
    assert.equal(engine.getPortfolio('usr-1')?.cashBalance, 400);

    // Market open arrives -> activate queue
    const activated = engine.activateQueuedOrders('BARC');
    assert.equal(activated, 1);
    assert.equal(order.status, 'PENDING_BATCH');
  });

  it('rejects order on insufficient funds', () => {
    const engine = new OrderEngine();
    engine.registerUser('usr-broke', 25.0);

    const order = engine.submitOrder('usr-broke', 'TSLA', 'BUY', 100.0);
    assert.equal(order.status, 'REJECTED');
    assert.match(order.rejectionReason || '', /Insufficient cash balance/);
    assert.equal(engine.getPortfolio('usr-broke')?.cashBalance, 25.0);
  });

  it('batches multiple fractional share orders and allocates high-precision quantities', () => {
    const engine = new OrderEngine();
    engine.registerUser('alice', 1000);
    engine.registerUser('bob', 1000);
    engine.registerUser('charlie', 1000);

    const marketOpenTime = new Date('2026-11-25T11:00:00Z');

    // Alice buys £50 of VOD (share price £175) -> 50 / 175 = 0.28571429 shares
    const ord1 = engine.submitOrder('alice', 'VOD', 'BUY', 50, marketOpenTime);
    // Bob buys £125 of VOD -> 125 / 175 = 0.71428571 shares
    const ord2 = engine.submitOrder('bob', 'VOD', 'BUY', 125, marketOpenTime);
    // Charlie buys £350 of VOD -> 350 / 175 = 2.0 shares
    const ord3 = engine.submitOrder('charlie', 'VOD', 'BUY', 350, marketOpenTime);

    assert.equal(ord1.status, 'PENDING_BATCH');
    assert.equal(ord2.status, 'PENDING_BATCH');
    assert.equal(ord3.status, 'PENDING_BATCH');

    // Execute batch at £175/share
    const batchResult = engine.batchAndExecute('VOD', 175.0);

    assert.equal(batchResult.executedOrderIds.length, 3);
    assert.equal(batchResult.totalCashVolume, 525.0); // 50 + 125 + 350
    // Total shares = 525 / 175 = 3.0 shares exactly
    assert.equal(batchResult.totalSharesAllocated, 3.0);
    assert.equal(batchResult.wholeSharesExecuted, 3);
    assert.equal(batchResult.fractionalInventoryDelta, 0.0);

    // Check Alice portfolio
    const alicePort = engine.getPortfolio('alice');
    assert.equal(alicePort?.positions['VOD'].shares, 0.28571429);
    assert.equal(alicePort?.cashBalance, 950.0);

    // Check Bob portfolio
    const bobPort = engine.getPortfolio('bob');
    assert.equal(bobPort?.positions['VOD'].shares, 0.71428571);
    assert.equal(bobPort?.cashBalance, 875.0);

    // Check Charlie portfolio
    const charliePort = engine.getPortfolio('charlie');
    assert.equal(charliePort?.positions['VOD'].shares, 2.0);
    assert.equal(charliePort?.cashBalance, 650.0);
  });
});
