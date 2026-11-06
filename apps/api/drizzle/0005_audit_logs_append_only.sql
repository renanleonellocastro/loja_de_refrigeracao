-- The audit trail is append only (RF-41, docs/SEGURANCA.md): rows are inserted and read, never changed or removed.
-- TRUNCATE stays possible for the database owner so tests can start from empty tables.
CREATE FUNCTION "audit_logs_reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append only: % is not allowed', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_change"();
