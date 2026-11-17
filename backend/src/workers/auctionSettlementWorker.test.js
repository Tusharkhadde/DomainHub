import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const {settleExpiredAuctionsMock}=vi.hoisted(()=>({settleExpiredAuctionsMock:vi.fn()}));

vi.mock('../services/auctionService.js',()=>({settleExpiredAuctions:settleExpiredAuctionsMock}));

import {startAuctionSettlementWorker} from './auctionSettlementWorker.js';

describe('auction settlement worker',()=>{
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.clearAllMocks();
    settleExpiredAuctionsMock.mockResolvedValue(undefined);
  });

  afterEach(()=>vi.useRealTimers());

  it('runs once at startup and then at each configured interval',async()=>{
    const stop=startAuctionSettlementWorker({intervalMs:1000,logger:{error:vi.fn()}});

    await vi.advanceTimersByTimeAsync(0);
    expect(settleExpiredAuctionsMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(settleExpiredAuctionsMock).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(settleExpiredAuctionsMock).toHaveBeenCalledTimes(2);
  });

  it('logs a failed sweep and retries on the next interval',async()=>{
    const logger={error:vi.fn()};
    settleExpiredAuctionsMock.mockRejectedValueOnce(new Error('database unavailable'));
    const stop=startAuctionSettlementWorker({intervalMs:1000,logger});

    await vi.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalledWith('[auction-settlement] sweep failed:', 'database unavailable');
    await vi.advanceTimersByTimeAsync(1000);
    expect(settleExpiredAuctionsMock).toHaveBeenCalledTimes(2);
    stop();
  });

  it('rejects invalid polling intervals',()=>{
    expect(()=>startAuctionSettlementWorker({intervalMs:0})).toThrow('Auction settlement interval must be at least 1000 ms');
  });
});
