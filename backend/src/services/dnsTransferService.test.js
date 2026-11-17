import {beforeEach,describe,expect,it,vi} from 'vitest';

const {queryMock,transactionMock}=vi.hoisted(()=>({queryMock:vi.fn(),transactionMock:vi.fn()}));

vi.mock('../repositories/database.js',()=>({query:queryMock,transaction:transactionMock}));

import {addDns,dnsAction} from './dnsTransferService.js';

describe('DNS ownership workflows',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    queryMock.mockResolvedValue([{id:7}]);
    transactionMock.mockImplementation(work=>work({query:vi.fn().mockResolvedValue([{id:7}]),insert:vi.fn().mockResolvedValue(15)}));
  });

  it('checks and locks domain ownership in the same transaction that adds a record',async()=>{
    const txQuery=vi.fn().mockResolvedValue([{id:7}]);
    const txInsert=vi.fn().mockResolvedValue(15);
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:txInsert}));

    await expect(addDns(1,7,{record_type:'A',name:'@',value:'192.0.2.1',ttl:'3600'})).resolves.toEqual({id:15});

    expect(txQuery).toHaveBeenCalledWith('SELECT id FROM domains WHERE id=? AND owner_id=? FOR UPDATE',[7,1]);
    expect(txInsert).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dns_records'),[7,'A','@','192.0.2.1',null,3600]);
  });

  it('checks and locks record ownership in the same transaction that deletes it',async()=>{
    const txQuery=vi.fn().mockResolvedValue([{id:7}]);
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:vi.fn()}));

    await dnsAction(1,15,'delete');

    expect(txQuery).toHaveBeenNthCalledWith(1,'SELECT d.id FROM dns_records r JOIN domains d ON d.id=r.domain_id WHERE r.id=? AND d.owner_id=? FOR UPDATE',[15,1]);
    expect(txQuery).toHaveBeenNthCalledWith(2,'DELETE FROM dns_records WHERE id=?',[15]);
  });

  it('rejects an MX record without an explicit priority',async()=>{
    await expect(addDns(1,7,{record_type:'MX',name:'@',value:'mail.example.test',priority:'',ttl:3600})).rejects.toThrow('MX priority is required');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('preserves a valid zero MX priority',async()=>{
    const txInsert=vi.fn().mockResolvedValue(15);
    transactionMock.mockImplementation(work=>work({query:vi.fn().mockResolvedValue([{id:7}]),insert:txInsert}));
    await addDns(1,7,{record_type:'MX',name:'@',value:'mail.example.test',priority:0,ttl:3600});

    expect(txInsert).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO dns_records'),[7,'MX','@','mail.example.test',0,3600]);
  });

  it('rejects a zero TTL instead of silently replacing it with the default',async()=>{
    await expect(addDns(1,7,{record_type:'A',name:'@',value:'192.0.2.1',ttl:0})).rejects.toThrow('Invalid DNS record');
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
