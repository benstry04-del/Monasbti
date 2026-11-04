CREATE VIEW payment_valuations AS
WITH documents AS (
 SELECT p.id,p.booking_id,p.user_id,p.created_at,p.status,
 GREATEST(0,p.amount_minor-COALESCE((SELECT sum(r.amount_minor) FROM refunds r WHERE r.payment_id=p.id AND r.status='COMPLETED'),0))::numeric AS net_minor,
 CASE WHEN COALESCE((p.data->>'amendment')::boolean,false) THEN amendment.document ELSE b.data->'contract' END AS document,
 CASE WHEN COALESCE((p.data->>'amendment')::boolean,false) THEN amendment.document->'financials' ELSE b.data->'financials' END AS financials
 FROM payments p JOIN bookings b ON b.id=p.booking_id
 LEFT JOIN LATERAL (
   SELECT a AS document FROM (
     SELECT b.data->'amendment' AS a
     UNION ALL SELECT value FROM jsonb_array_elements(COALESCE(b.data->'amendmentHistory','[]'::jsonb))
   ) candidates WHERE a IS NOT NULL AND (p.data->>'amendmentId' IS NULL OR a->>'id'=p.data->>'amendmentId') LIMIT 1
 ) amendment ON COALESCE((p.data->>'amendment')::boolean,false)
)
SELECT d.id,d.booking_id,d.user_id,d.created_at,d.status,d.net_minor,
 COALESCE(d.document->'snapshot',d.document->'lines','[]'::jsonb) AS lines,
 COALESCE((d.financials->>'total')::numeric,(d.document->>'total')::numeric,0)*1000 AS document_total_minor,
 COALESCE((d.financials->>'tax')::numeric,0)*1000 AS document_tax_minor,
 costs.cost_minor,costs.subtotal_minor,costs.known
FROM documents d
LEFT JOIN LATERAL (
 SELECT sum(round((l->>'cost')::numeric*1000)*(l->>'qty')::int) AS cost_minor,
 sum(round((l->>'price')::numeric*1000)*(l->>'qty')::int) AS subtotal_minor,
 bool_and(l->>'cost' IS NOT NULL) AS known
 FROM jsonb_array_elements(COALESCE(d.document->'snapshot',d.document->'lines','[]'::jsonb)) l
) costs ON true;
