CREATE TABLE "figure_fetch_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "figure_fetch_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_started_at" timestamp with time zone NOT NULL,
	"metric_id" text NOT NULL,
	"outcome" text NOT NULL,
	"added" integer NOT NULL,
	"revisions" integer NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "figure_fetch_runs_once" UNIQUE("run_started_at","metric_id"),
	CONSTRAINT "figure_fetch_runs_added_nonneg" CHECK ("figure_fetch_runs"."added" >= 0),
	CONSTRAINT "figure_fetch_runs_revisions_range" CHECK ("figure_fetch_runs"."revisions" >= 0 AND "figure_fetch_runs"."revisions" <= "figure_fetch_runs"."added"),
	CONSTRAINT "figure_fetch_runs_reason_len" CHECK (char_length("figure_fetch_runs"."reason") <= 200),
	CONSTRAINT "figure_fetch_runs_outcome" CHECK ("figure_fetch_runs"."outcome" IN ('stored', 'no_new_period', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "figures" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "figures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"metric_id" text NOT NULL,
	"kind" text DEFAULT 'official' NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"region" text NOT NULL,
	"period" text NOT NULL,
	"source" text NOT NULL,
	"series_id" text NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "figures_series_period_retrieved_unique" UNIQUE("source","series_id","unit","region","period","retrieved_at"),
	CONSTRAINT "figures_kind" CHECK ("figures"."kind" = 'official'),
	CONSTRAINT "figures_period_format" CHECK ("figures"."period" ~ '^\d{4}-\d{2}(-\d{2})?$'),
	CONSTRAINT "figures_source_url_https" CHECK ("figures"."source_url" ~ '^https://')
);
--> statement-breakpoint
CREATE INDEX "figure_fetch_runs_success_idx" ON "figure_fetch_runs" USING btree ("metric_id","run_started_at" DESC NULLS LAST) WHERE "figure_fetch_runs"."outcome" <> 'failed';--> statement-breakpoint
CREATE INDEX "figures_series_latest_idx" ON "figures" USING btree ("source","series_id","unit","region","period" DESC NULLS LAST,"retrieved_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE TRIGGER "figures_forbid_change" BEFORE UPDATE OR DELETE ON "figures" FOR EACH ROW EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "figures_forbid_truncate" BEFORE TRUNCATE ON "figures" FOR EACH STATEMENT EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "figure_fetch_runs_forbid_change" BEFORE UPDATE OR DELETE ON "figure_fetch_runs" FOR EACH ROW EXECUTE FUNCTION revenant_forbid_change();--> statement-breakpoint
CREATE TRIGGER "figure_fetch_runs_forbid_truncate" BEFORE TRUNCATE ON "figure_fetch_runs" FOR EACH STATEMENT EXECUTE FUNCTION revenant_forbid_change();