CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic" varchar(255) NOT NULL,
	"message_key" varchar(255) NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp (6) with time zone NOT NULL,
	"published_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	CONSTRAINT "pk_user_roles" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp (6) with time zone NOT NULL,
	CONSTRAINT "uk_users_email" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_outbox_pending" ON "outbox" USING btree ("created_at") WHERE "outbox"."published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");