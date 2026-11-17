import {settleExpiredAuctions} from '../services/auctionService.js';

const DEFAULT_INTERVAL_MS=60_000;

export function startAuctionSettlementWorker({
  intervalMs=Number(process.env.AUCTION_SETTLEMENT_INTERVAL_MS||DEFAULT_INTERVAL_MS),
  logger=console
}={}){
  if(!Number.isSafeInteger(intervalMs)||intervalMs<1000)throw new Error('Auction settlement interval must be at least 1000 ms');

  let stopped=false;
  let running=false;
  const run=async()=>{
    if(stopped||running)return;
    running=true;
    try{
      await settleExpiredAuctions({
        onAuctionError:(auctionId,error)=>logger.error(`[auction-settlement] auction ${auctionId} failed:`,error?.message||String(error))
      });
    }catch(error){
      logger.error('[auction-settlement] sweep failed:',error?.message||String(error));
    }finally{
      running=false;
    }
  };

  const timer=setInterval(()=>{void run();},intervalMs);
  timer.unref?.();
  void run();

  return ()=>{
    stopped=true;
    clearInterval(timer);
  };
}
