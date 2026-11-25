export type OrderSide = 'BUY' | 'SELL';

export type OrderStatus = 'QUEUED_FOR_MARKET_OPEN' | 'PENDING_BATCH' | 'EXECUTED' | 'REJECTED';

export interface FractionalOrder {
  id: string;
  userId: string;
  ticker: string;
  side: OrderSide;
  cashAmount: number;
  status: OrderStatus;
  createdAt: Date;
  executedShares?: number;
  executionPrice?: number;
  executedAt?: Date;
  rejectionReason?: string;
}

export interface PortfolioPosition {
  ticker: string;
  shares: number;
  averageCostBasis: number;
  totalCost: number;
}

export interface UserPortfolio {
  userId: string;
  cashBalance: number;
  positions: Record<string, PortfolioPosition>;
}

export interface BatchExecutionResult {
  ticker: string;
  executionPrice: number;
  totalCashVolume: number;
  totalSharesAllocated: number;
  wholeSharesExecuted: number;
  fractionalInventoryDelta: number;
  executedOrderIds: string[];
}
