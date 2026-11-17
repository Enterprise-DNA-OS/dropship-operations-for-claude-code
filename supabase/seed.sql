insert into workspace(id,name,demo) values(1,'Harbour Home Demo',true) on conflict do nothing;
insert into vendors(id,name,owner,evidence) values
('10000000-0000-4000-8000-000000000001','Kauri Homewares','Moana','Demo supply agreement'),
('10000000-0000-4000-8000-000000000002','Kauri Outdoor','Aria','Demo supply agreement'),
('10000000-0000-4000-8000-000000000003','Southern Living','','') on conflict do nothing;
insert into products(source_id,vendor_id,retailer_sku,vendor_sku,name,currency,cost_cents,price_cents,available,active,stock_at,source) values
('PR-1','10000000-0000-4000-8000-000000000001','LAMP','KH-LAMP','Rimu desk lamp','NZD',4500,7500,8,true,now()-interval '4 days','Demo feed'),
('PR-2','10000000-0000-4000-8000-000000000002','LAMP','KO-LAMP','Outdoor lamp','NZD',6000,8000,12,true,now(),'Demo feed'),
('PR-3','10000000-0000-4000-8000-000000000003','THROW','SL-THROW','Wool throw','NZD',7000,6500,0,true,now(),'Demo feed') on conflict do nothing;
insert into purchase_orders(id,source_id,number,customer_order,vendor_id,currency,placed_on,confirmed_at,delivery_due,retention_review,evidence) values
('20000000-0000-4000-8000-000000000001','DP-101','PO-101','SHOP-901','10000000-0000-4000-8000-000000000001','NZD',current_date-8,null,current_date-2,current_date+365,'Demo order'),
('20000000-0000-4000-8000-000000000002','DP-102','PO-102','SHOP-901','10000000-0000-4000-8000-000000000002','NZD',current_date-4,now()-interval '3 days',current_date+3,current_date+365,'Demo order'),
('20000000-0000-4000-8000-000000000003','DP-103','PO-103','SHOP-902','10000000-0000-4000-8000-000000000003','NZD',current_date-7,now()-interval '6 days',current_date-1,current_date-1,'Demo order') on conflict do nothing;
insert into items(id,source_id,po_id,vendor_sku,name,quantity,unit_cost_cents,promise_on) values
('30000000-0000-4000-8000-000000000001','LINE-1','20000000-0000-4000-8000-000000000001','KH-LAMP','Rimu desk lamp',10,4500,current_date-3),
('30000000-0000-4000-8000-000000000002','LINE-2','20000000-0000-4000-8000-000000000002','KO-LAMP','Outdoor lamp',2,6000,current_date+1),
('30000000-0000-4000-8000-000000000003','LINE-3','20000000-0000-4000-8000-000000000003','SL-THROW','Wool throw',3,7000,null) on conflict do nothing;
insert into shipments(item_id,reference,quantity,carrier,tracking,shipped_on,delivered_on,evidence,operator) values
('30000000-0000-4000-8000-000000000001','DEMO-SHIP-1',4,'Demo courier','DEMO-TRACK-1',current_date-4,current_date-3,'Demo delivery receipt','Demo operator'),
('30000000-0000-4000-8000-000000000003','DEMO-SHIP-2',3,'Demo courier','DEMO-TRACK-2',current_date-3,null,'Demo dispatch record','Demo operator') on conflict do nothing;
insert into returns(item_id,reference,quantity,reason,review_due,operator) values('30000000-0000-4000-8000-000000000001','RET-101',1,'Shade damaged',current_date-1,'Demo operator') on conflict do nothing;
