import { FractionalOrder, OrderSide, UserPortfolio, BatchExecutionResult } from './types.js';
import { isMarketOpen } from './marketHours.js';

export class OrderEngine {
  private users: Map<string, UserPortfolio> = new Map();
  private orders: Map<string, FractionalOrder> = new Map();
  private orderCounter: number = 1;

  public registerUser(userId: string, initialCash: number): UserPortfolio {
    const portfolio: UserPortfolio = {
      userId,
      cashBalance: initialCash,
      positions: {},
    };
    this.users.set(userId, portfolio);
    return portfolio;
  }

  public getPortfolio(userId: string): UserPortfolio | undefined {
    return this.users.get(userId);
  }

  public submitOrder(
    userId: string,
    ticker: string,
    side: OrderSide,
    cashAmount: number,
    now: Date = new Date()
  ): FractionalOrder {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (cashAmount <= 0) {
      throw new Error(`Cash amount must be strictly positive, got: ${cashAmount}`);
    }

    const orderId = `ord-${ticker.toLowerCase()}-${this.orderCounter++}`;

    // Validate cash balance for BUY
    if (side === 'BUY' && user.cashBalance < cashAmount) {
      const rejectedOrder: FractionalOrder = {
        id: orderId,
        userId,
        ticker,
        side,
        cashAmount,
        status: 'REJECTED',
        createdAt: now,
        rejectionReason: `Insufficient cash balance. Required: £${cashAmount.toFixed(2)}, Available: £${user.cashBalance.toFixed(2)}`,
      };
      this.orders.set(orderId, rejectedOrder);
      return rejectedOrder;
    }

    // Determine status based on market hours
    const open = isMarketOpen(now);
    const status = open ? 'PENDING_BATCH' : 'QUEUED_FOR_MARKET_OPEN';

    // Reserve cash for BUY order
    if (side === 'BUY') {
      user.cashBalance = Math.round((user.cashBalance - cashAmount) * 100) / 100;
    }

    const order: FractionalOrder = {
      id: orderId,
      userId,
      ticker,
      side,
      cashAmount,
      status,
      createdAt: now,
    };

    this.orders.set(orderId, order);
    return order;
  }

  public activateQueuedOrders(ticker: string): number {
    let activatedCount = 0;
    for (const order of this.orders.values()) {
      if (order.ticker === ticker && order.status === 'QUEUED_FOR_MARKET_OPEN') {
        order.status = 'PENDING_BATCH';
        activatedCount++;
      }
    }
    return activatedCount;
  }

  public batchAndExecute(ticker: string, sharePrice: number, now: Date = new Date()): BatchExecutionResult {
    if (sharePrice <= 0) {
      throw new Error(`Share price must be positive, got: ${sharePrice}`);
    }

    const pendingOrders: FractionalOrder[] = [];
    for (const order of this.orders.values()) {
      if (order.ticker === ticker && order.status === 'PENDING_BATCH') {
        pendingOrders.push(order);
      }
    }

    let totalCash = 0;
    let totalSharesAllocated = 0;
    const executedOrderIds: string[] = [];

    for (const order of pendingOrders) {
      const user = this.users.get(order.userId)!;

      // Fractional allocation accurate to 8 decimal places
      const rawShares = order.cashAmount / sharePrice;
      const allocatedShares = Math.round(rawShares * 1e8) / 1e8;

      order.status = 'EXECUTED';
      order.executedShares = allocatedShares;
      order.executionPrice = sharePrice;
      order.executedAt = now;

      // Update position
      const pos = user.positions[ticker] || {
        ticker,
        shares: 0,
        averageCostBasis: 0,
        totalCost: 0,
      };

      const newShares = Math.round((pos.shares + allocatedShares) * 1e8) / 1e8;
      const newTotalCost = Math.round((pos.totalCost + order.cashAmount) * 100) / 100;
      pos.shares = newShares;
      pos.totalCost = newTotalCost;
      pos.averageCostBasis = Math.round((newTotalCost / newShares) * 100) / 100;

      user.positions[ticker] = pos;

      totalCash = Math.round((totalCash + order.cashAmount) * 100) / 100;
      totalSharesAllocated = Math.round((totalSharesAllocated + allocatedShares) * 1e8) / 1e8;
      executedOrderIds.push(order.id);
    }

    const wholeSharesExecuted = Math.ceil(totalSharesAllocated);
    const fractionalInventoryDelta = Math.round((wholeSharesExecuted - totalSharesAllocated) * 1e8) / 1e8;

    return {
      ticker,
      executionPrice: sharePrice,
      totalCashVolume: totalCash,
      totalSharesAllocated,
      wholeSharesExecuted,
      fractionalInventoryDelta,
      executedOrderIds,
    };
  }
}
