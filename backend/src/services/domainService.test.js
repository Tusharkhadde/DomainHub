import {beforeEach,describe,expect,it,vi} from 'vitest';

const {queryMock,transactionMock}=vi.hoisted(()=>({queryMock:vi.fn(),transactionMock:vi.fn()}));

vi.mock('../repositories/database.js',()=>({query:queryMock,transaction:transactionMock}));

import {buyDomain,searchDomain} from './domainService.js';

describe('domain search and registration',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    queryMock.mockImplementation(async sql=>sql.includes('FROM tlds')?[{id:1,extension:'.com',registration_price:'12.99',renewal_price:'14.99'}]:[]);
    transactionMock.mockImplementation(async work=>work({query:vi.fn().mockResolvedValue([]),insert:vi.fn().mockResolvedValue(1)}));
  });

  it('marks a popular name unavailable even if it is absent from workspace records',async()=>{
    const [result]=await searchDomain('Google.com');

    expect(result).toMatchObject({name:'google',extension:'.com',available:false});
  });

  it('marks an unregistered random name available and includes its TLD price',async()=>{
    const [result]=await searchDomain('random-check-name.com');

    expect(result).toMatchObject({name:'random-check-name',extension:'.com',available:true,registrationPrice:'12.99',renewalPrice:'14.99'});
  });

  it('does not let users register a name shown as popular and unavailable',async()=>{
    await expect(buyDomain(2,'google.com')).rejects.toMatchObject({status:409});
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('creates a workspace registration for an available random name',async()=>{
    const txQuery=vi.fn(async sql=>sql.startsWith('SELECT * FROM tlds')?[{registration_price:'12.99'}]:[]);
    const txInsert=vi.fn(async sql=>sql.startsWith('INSERT INTO domains')?12:21);
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:txInsert}));

    await expect(buyDomain(2,'random-check-name.com')).resolves.toMatchObject({id:12,domain:'random-check-name.com',orderId:21});
    expect(txInsert).toHaveBeenCalledTimes(3);
  });
});
