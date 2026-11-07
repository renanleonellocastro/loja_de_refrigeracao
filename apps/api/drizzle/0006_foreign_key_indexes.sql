CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "quotes_service_type_idx" ON "quotes" USING btree ("service_type_id");--> statement-breakpoint
CREATE INDEX "service_requests_service_type_idx" ON "service_requests" USING btree ("service_type_id");--> statement-breakpoint
CREATE INDEX "service_requests_quote_idx" ON "service_requests" USING btree ("quote_id");