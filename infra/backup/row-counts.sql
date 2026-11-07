-- Rows of every table outside the system schemas, one "schema.table<TAB>count" line each, sorted.
-- Used by backup.sh (inside the dump snapshot) and by restore-test.sh (on the restored copy).
SELECT format('%I.%I', table_schema, table_name),
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                                             false, true, '')))[1]::text::bigint
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY 1;
