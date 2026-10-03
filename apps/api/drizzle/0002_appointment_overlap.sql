-- A technician never has two overlapping appointments (docs/DOMINIO.md invariant 3).
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING gist ("employee_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&);
