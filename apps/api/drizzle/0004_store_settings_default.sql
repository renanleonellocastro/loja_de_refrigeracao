-- The single store settings row with the real data of the store (docs/LOJA.md). Editable by the super user.
INSERT INTO "store_settings" ("id", "name", "legal_name", "cnpj", "phone", "whatsapp", "email", "address", "opening_hours", "notification_emails", "default_stock_min")
VALUES (
  1,
  'Refrigeração Castro',
  'Refrigeração Castro Ltda ME',
  '63060560000151',
  '1938041658',
  NULL,
  'refrigeracaocastro@yahoo.com.br',
  '{"cep":"13800061","street":"Rua Doutor Ulhoa Cintra","number":"91","complement":null,"district":"Centro","city":"Mogi Mirim","state":"SP"}',
  '{"0":null,"1":{"opens":"09:00","closes":"18:00"},"2":{"opens":"09:00","closes":"18:00"},"3":{"opens":"09:00","closes":"18:00"},"4":{"opens":"09:00","closes":"18:00"},"5":{"opens":"09:00","closes":"18:00"},"6":null}',
  ARRAY[]::text[],
  1
)
ON CONFLICT ("id") DO NOTHING;
