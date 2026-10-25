import {describe,it,expect} from 'vitest';
import {domainStatus} from './domainStatus.js';
describe('UTC calendar domain status boundaries',()=>{const today='2026-01-01T18:00:00Z';for(const [offset,status] of [[31,'ACTIVE'],[30,'EXPIRING'],[1,'EXPIRING'],[0,'EXPIRING'],[-1,'GRACE'],[-30,'GRACE'],[-31,'EXPIRED']])it(`${offset} days => ${status}`,()=>{const d=new Date(Date.UTC(2026,0,1+offset));expect(domainStatus(d,today)).toBe(status);});});
