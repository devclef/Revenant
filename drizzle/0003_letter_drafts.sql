CREATE TABLE "letter_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"server_secret" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "letter_drafts_id_format" CHECK ("letter_drafts"."id" ~ '^[A-Za-z0-9_-]{21}[AQgw]$'),
	CONSTRAINT "letter_drafts_server_secret_len" CHECK (octet_length("letter_drafts"."server_secret") = 32)
);
--> statement-breakpoint
CREATE INDEX "letter_drafts_created_at_idx" ON "letter_drafts" USING btree ("created_at");