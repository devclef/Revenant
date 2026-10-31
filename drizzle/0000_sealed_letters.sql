CREATE TABLE "demo_letters" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope" text NOT NULL,
	"envelope_hash" text NOT NULL,
	"sealed_at" timestamp with time zone NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"server_secret" "bytea" NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "demo_letters_id_format" CHECK ("demo_letters"."id" ~ '^[A-Za-z0-9_-]{21}[AQgw]$'),
	CONSTRAINT "demo_letters_envelope_hash_format" CHECK ("demo_letters"."envelope_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "demo_letters_server_secret_len" CHECK (octet_length("demo_letters"."server_secret") = 32),
	CONSTRAINT "demo_letters_kind" CHECK ("demo_letters"."kind" IN ('persona'))
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" text PRIMARY KEY NOT NULL,
	"envelope" text NOT NULL,
	"envelope_hash" text NOT NULL,
	"sealed_at" timestamp with time zone NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"server_secret" "bytea" NOT NULL,
	CONSTRAINT "letters_id_format" CHECK ("letters"."id" ~ '^[A-Za-z0-9_-]{21}[AQgw]$'),
	CONSTRAINT "letters_envelope_hash_format" CHECK ("letters"."envelope_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "letters_server_secret_len" CHECK (octet_length("letters"."server_secret") = 32),
	CONSTRAINT "letters_opens_at_min_lock" CHECK (("letters"."opens_at" AT TIME ZONE 'UTC') >= ("letters"."sealed_at" AT TIME ZONE 'UTC') + interval '3 months')
);
--> statement-breakpoint
CREATE TABLE "openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" text,
	"demo_letter_id" text,
	"ciphertext" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "openings_ciphertext_len" CHECK (octet_length("openings"."ciphertext") BETWEEN 1 AND 65536),
	CONSTRAINT "openings_nonce_len" CHECK (octet_length("openings"."nonce") = 12),
	CONSTRAINT "openings_exactly_one_letter" CHECK (num_nonnulls("openings"."letter_id", "openings"."demo_letter_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "openings" ADD CONSTRAINT "openings_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openings" ADD CONSTRAINT "openings_demo_letter_id_demo_letters_id_fk" FOREIGN KEY ("demo_letter_id") REFERENCES "public"."demo_letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "openings_letter_id_idx" ON "openings" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "openings_demo_letter_id_idx" ON "openings" USING btree ("demo_letter_id");--> statement-breakpoint
CREATE FUNCTION revenant_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'revenant: % on % is not allowed; sealed records are immutable', TG_OP, TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "letters_forbid_change" BEFORE UPDATE OR DELETE ON "letters" FOR EACH ROW EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "letters_forbid_truncate" BEFORE TRUNCATE ON "letters" FOR EACH STATEMENT EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "demo_letters_forbid_change" BEFORE UPDATE OR DELETE ON "demo_letters" FOR EACH ROW EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "demo_letters_forbid_truncate" BEFORE TRUNCATE ON "demo_letters" FOR EACH STATEMENT EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "openings_forbid_change" BEFORE UPDATE OR DELETE ON "openings" FOR EACH ROW EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "openings_forbid_truncate" BEFORE TRUNCATE ON "openings" FOR EACH STATEMENT EXECUTE FUNCTION revenant_forbid_change();