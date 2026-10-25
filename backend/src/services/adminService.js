import {query} from '../repositories/database.js';
import {fail} from '../utils/errors.js';

const money=value=>Number(value).toFixed(2);

export async function adminSummary(){
  const until=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const [revenue,payments,expiring,live,closed]=await Promise.all([
    query("SELECT COALESCE(SUM(amount),0) revenue FROM payments WHERE status='SUCCESS'"),
    query('SELECT status,COUNT(*) count FROM payments GROUP BY status'),
    query('SELECT id,name,extension,expires_at FROM domains WHERE expires_at BETWEEN CURRENT_DATE AND ? ORDER BY expires_at',[until]),
    query("SELECT COUNT(*) count FROM auctions WHERE status='LIVE'"),
    query("SELECT COUNT(*) count FROM auctions WHERE status IN ('CLOSED','UNSOLD')")
  ]);
  return {revenue:money(revenue[0].revenue),payments,expiringDomains:expiring,liveAuctions:Number(live[0].count),closedAuctions:Number(closed[0].count)};
}

export async function updateTld(id,prices){
  const registration=Number(prices.registration_price),renewal=Number(prices.renewal_price);
  if(!Number.isFinite(registration)||!Number.isFinite(renewal)||registration<0||renewal<0)fail('Prices must be nonnegative numbers');
  const result=await query('UPDATE tlds SET registration_price=?,renewal_price=? WHERE id=?',[registration,renewal,id]);
  return result;
}
