INSERT INTO users(id,name,email,password_hash,role) VALUES
(1,'Domain Hub Admin','admin@domainhub.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','ADMIN'),
(2,'Asha Rao','asha@example.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','USER'),
(3,'Ravi Kumar','ravi@example.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','USER');
INSERT INTO tlds(id,extension,registration_price,renewal_price) VALUES(1,'.com',12.99,14.99),(2,'.in',7.99,9.99),(3,'.dev',16.99,18.99);
INSERT INTO domains(id,name,extension,owner_id,expires_at) VALUES(1,'asha','.com',2,CURRENT_DATE+240),(2,'ravi','.in',3,CURRENT_DATE+20),(3,'greenstudio','.dev',2,CURRENT_DATE+300);
INSERT INTO orders(id,user_id,domain_id,order_type,amount,status) VALUES(1,2,1,'REGISTRATION',12.99,'COMPLETED'),(2,3,2,'REGISTRATION',7.99,'COMPLETED');
INSERT INTO payments(order_id,amount,status) VALUES(1,12.99,'SUCCESS'),(2,7.99,'SUCCESS');
INSERT INTO dns_records(domain_id,record_type,name,value,ttl) VALUES(1,'A','@','203.0.113.10',3600),(1,'TXT','@','domain-hub-demo',3600);
INSERT INTO auctions(id,domain_id,seller_id,starting_price,min_increment,starts_at,ends_at,status) VALUES(1,3,2,25.00,2.50,NOW()-INTERVAL '1 day',NOW()+INTERVAL '5 day','LIVE');
INSERT INTO bids(auction_id,bidder_id,amount) VALUES(1,3,30.00);
ALTER TABLE users ALTER COLUMN id RESTART WITH 4; ALTER TABLE tlds ALTER COLUMN id RESTART WITH 4; ALTER TABLE domains ALTER COLUMN id RESTART WITH 4; ALTER TABLE orders ALTER COLUMN id RESTART WITH 3; ALTER TABLE auctions ALTER COLUMN id RESTART WITH 2;
