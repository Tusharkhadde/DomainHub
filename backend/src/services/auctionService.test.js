import {beforeEach,describe,expect,it,vi} from 'vitest';

const {queryMock,transactionMock}=vi.hoisted(()=>({queryMock:vi.fn(),transactionMock:vi.fn()}));

vi.mock('../repositories/database.js',()=>({query:queryMock,transaction:transactionMock}));

import {auctionList,createTransfer,listUserAuctions,transferAction} from './auctionService.js';

describe('auction and transfer workflows',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
    transactionMock.mockImplementation(work=>work({query:vi.fn().mockResolvedValue([]),insert:vi.fn().mockResolvedValue(101)}));
  });

  it('does not create a second pending transfer for the same domain',async()=>{
    const txQuery=vi.fn(async sql=>{
      if(sql.startsWith('SELECT * FROM domains'))return [{id:7,owner_id:1}];
      if(sql.includes("FROM auctions WHERE domain_id=? AND status='LIVE'"))return [];
      if(sql.includes("FROM transfers WHERE domain_id=? AND status='PENDING'"))return [{id:9}];
      if(sql.startsWith('SELECT id FROM users'))return [{id:2}];
      return [];
    });
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:vi.fn()}));

    await expect(createTransfer(1,7,'receiver@example.test')).rejects.toMatchObject({status:409});
    expect(txQuery).toHaveBeenCalledWith(expect.stringContaining("FROM transfers WHERE domain_id=? AND status='PENDING'"),[7]);
  });

  it('moves domain ownership when the receiver accepts a pending transfer',async()=>{
    const txQuery=vi.fn(async sql=>{
      if(sql.startsWith('SELECT domain_id FROM transfers'))return [{domain_id:7}];
      if(sql.startsWith('SELECT * FROM transfers'))return [{id:9,domain_id:7,sender_id:1,receiver_id:2,status:'PENDING'}];
      if(sql.startsWith('SELECT * FROM domains'))return [{id:7,owner_id:1}];
      if(sql.includes("FROM auctions WHERE domain_id=? AND status='LIVE'"))return [];
      return [];
    });
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:vi.fn()}));

    await expect(transferAction(2,9,'accept')).resolves.toEqual({status:'ACCEPTED'});
    expect(txQuery.mock.calls[0]).toEqual(['SELECT domain_id FROM transfers WHERE id=?',[9]]);
    expect(txQuery.mock.calls[1]).toEqual(['SELECT * FROM domains WHERE id=? FOR UPDATE',[7]]);
    expect(txQuery).toHaveBeenCalledWith('UPDATE domains SET owner_id=? WHERE id=?',[2,7]);
    expect(txQuery).toHaveBeenCalledWith("UPDATE transfers SET status='REJECTED' WHERE domain_id=? AND status='PENDING' AND id<>?",[7,9]);
    expect(txQuery).toHaveBeenCalledWith('UPDATE transfers SET status=? WHERE id=?',['ACCEPTED',9]);
  });

  it('shows only the deterministic winning bidder when top bids are tied',async()=>{
    const winner={id:3,auction_id:5,bidder_id:2,bid_amount:'50.00',status:'CLOSED'};
    const tiedBidder={id:4,auction_id:5,bidder_id:3,bid_amount:'50.00',status:'CLOSED'};
    queryMock.mockImplementation(async sql=>{
      if(sql.includes("WHERE status='LIVE' AND ends_at<="))return [];
      if(sql.includes('FROM auctions a JOIN domains d')){
        return sql.includes('ub.id=(SELECT')?[winner]:[winner,tiedBidder];
      }
      return [];
    });

    const won=await listUserAuctions(2,'won');

    expect(won).toEqual([winner]);
  });

  it('surfaces auction settlement failures instead of hiding stale results',async()=>{
    queryMock.mockResolvedValueOnce([{id:22}]);
    transactionMock.mockRejectedValueOnce(new Error('settlement database failed'));

    await expect(auctionList(1)).rejects.toThrow('settlement database failed');
  });

  it('settles an ended auction to the highest bidder and closes the listing',async()=>{
    const writes=[];
    const txQuery=vi.fn(async(sql,params)=>{
      if(sql.startsWith('SELECT domain_id FROM auctions'))return [{domain_id:7}];
      if(sql.startsWith('SELECT * FROM domains'))return [{id:7,owner_id:1}];
      if(sql.startsWith('SELECT * FROM auctions'))return [{id:22,status:'LIVE',ends_at:new Date(Date.now()-1000).toISOString()}];
      if(sql.startsWith('SELECT * FROM bids'))return [{bidder_id:2,amount:'50.00'}];
      writes.push({sql,params});
      return [];
    });
    const txInsert=vi.fn(async(sql,params)=>{writes.push({sql,params});return sql.startsWith('INSERT INTO orders')?31:32;});
    transactionMock.mockImplementation(work=>work({query:txQuery,insert:txInsert}));
    queryMock.mockImplementation(async sql=>sql.includes("WHERE status='LIVE' AND ends_at<=")?[{id:22}]:[]);

    await auctionList(1);

    expect(writes).toContainEqual({sql:'UPDATE domains SET owner_id=? WHERE id=?',params:[2,7]});
    expect(writes).toContainEqual({sql:"UPDATE auctions SET status='CLOSED' WHERE id=?",params:[22]});
    expect(txInsert).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO orders'),[2,7,'TRANSFER_PURCHASE','50.00','COMPLETED']);
  });
});
