export function domainStatus(expiry, today = new Date()) {
  const day = (v) => {const d=new Date(v);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
  const days=Math.floor((day(expiry)-day(today))/86400000);
  if(days>30)return 'ACTIVE'; if(days>=0)return 'EXPIRING'; if(days>=-30)return 'GRACE'; return 'EXPIRED';
}
