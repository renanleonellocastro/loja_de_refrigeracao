-- Volume of RNF-10 (docs/REQUISITOS.md) on top of the development seed, for the k6 load test (docs/TESTES.md):
-- 10 thousand products, 50 thousand orders with items and timeline, and the customers who signed them.
-- The load customers carry the password of the sample accounts, so k6 signs in as carga-N@castro.dev.

INSERT INTO users (role, name, email, phone, password_hash, email_verified_at, privacy_accepted_at, privacy_version, search_text)
SELECT 'CLIENT', 'Cliente Carga ' || n, 'carga-' || n || '@castro.dev', '1998' || lpad(n::text, 7, '0'),
       (SELECT password_hash FROM users WHERE email = 'cliente@castro.dev'), now(), now(), '1',
       'cliente carga ' || n || ' carga-' || n || '@castro.dev 1998' || lpad(n::text, 7, '0')
FROM generate_series(1, 500) AS n;

WITH category AS (SELECT array_agg(id ORDER BY id) AS ids FROM categories)
INSERT INTO products (slug, name, category_id, brand, model, condition, description, price_cents, stock_available, stock_min, search_text)
SELECT 'produto-carga-' || n,
       'Produto de carga ' || n,
       category.ids[1 + n % array_length(category.ids, 1)],
       (ARRAY['Brastemp', 'Consul', 'Electrolux', 'Springer', 'Embraco', 'Tecumseh'])[1 + n % 6],
       'MOD-' || n,
       CASE WHEN n % 4 = 0 THEN 'USED' ELSE 'NEW' END::product_condition,
       'Produto gerado para o teste de carga.',
       5000 + (n * 7919) % 500000,
       CASE WHEN n % 10 = 0 THEN 0 ELSE 1000000 END,
       2,
       'produto de carga ' || n || ' ' || lower((ARRAY['Brastemp', 'Consul', 'Electrolux', 'Springer', 'Embraco', 'Tecumseh'])[1 + n % 6]) || ' mod-' || n
FROM generate_series(1, 10000) AS n, category;

WITH customer AS (SELECT array_agg(id ORDER BY id) AS ids FROM users WHERE email LIKE 'carga-%'),
     manager AS (SELECT id FROM users WHERE email = 'gerente@castro.dev')
INSERT INTO orders (customer_id, channel, status, total_cents, created_by_id, created_at, updated_at)
SELECT customer.ids[1 + n % array_length(customer.ids, 1)],
       CASE WHEN n % 5 = 0 THEN 'COUNTER' ELSE 'ONLINE' END::order_channel,
       CASE WHEN n % 5 = 0 THEN 'PICKED_UP'
            ELSE (ARRAY['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELED'])[1 + n % 4] END::order_status,
       0,
       CASE WHEN n % 5 = 0 THEN manager.id ELSE customer.ids[1 + n % array_length(customer.ids, 1)] END,
       now() - make_interval(mins => n * 15),
       now() - make_interval(mins => n * 15)
FROM generate_series(1, 50000) AS n, customer, manager;

WITH product AS (SELECT array_agg(id ORDER BY id) AS ids FROM products WHERE slug LIKE 'produto-carga-%')
INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity)
SELECT o.id, p.id, p.name, p.price_cents, 1 + line % 3
FROM orders o
CROSS JOIN generate_series(0, 1) AS line
CROSS JOIN product
JOIN products p ON p.id = product.ids[1 + (o.id * 31 + line * 4999) % array_length(product.ids, 1)];

UPDATE orders o SET total_cents = t.total
FROM (SELECT order_id, sum(unit_price_cents * quantity) AS total FROM order_items GROUP BY order_id) t
WHERE t.order_id = o.id;

INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at)
SELECT id, NULL, CASE WHEN channel = 'COUNTER' THEN 'PICKED_UP' ELSE 'PENDING_REVIEW' END::order_status,
       created_by_id, created_at
FROM orders;

INSERT INTO order_events (order_id, from_status, to_status, actor_id, created_at)
SELECT id, 'PENDING_REVIEW', status, (SELECT id FROM users WHERE email = 'gerente@castro.dev'), created_at + interval '1 hour'
FROM orders WHERE channel = 'ONLINE' AND status <> 'PENDING_REVIEW';

ANALYZE;
