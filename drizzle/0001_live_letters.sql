ALTER TABLE "demo_letters" DROP CONSTRAINT "demo_letters_kind";--> statement-breakpoint
ALTER TABLE "demo_letters" ADD CONSTRAINT "demo_letters_kind" CHECK ("demo_letters"."kind" IN ('persona', 'live'));--> statement-breakpoint
ALTER TABLE "demo_letters" ADD CONSTRAINT "demo_letters_live_lock" CHECK ("demo_letters"."kind" <> 'live' OR "demo_letters"."opens_at" = "demo_letters"."sealed_at" + interval '30 seconds');--> statement-breakpoint
CREATE TABLE "demo_letter_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"server_secret" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_letter_drafts_id_format" CHECK ("demo_letter_drafts"."id" ~ '^[A-Za-z0-9_-]{21}[AQgw]$'),
	CONSTRAINT "demo_letter_drafts_server_secret_len" CHECK (octet_length("demo_letter_drafts"."server_secret") = 32)
);
--> statement-breakpoint
CREATE INDEX "demo_letter_drafts_created_at_idx" ON "demo_letter_drafts" USING btree ("created_at");