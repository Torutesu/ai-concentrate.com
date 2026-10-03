CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`channel` text NOT NULL,
	`client_id` text,
	`task` text NOT NULL,
	`task_version` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`input_tokens` integer,
	`cached_input_tokens` integer,
	`output_tokens` integer,
	`reasoning_tokens` integer,
	`cost_micros` integer,
	`latency_ms` integer,
	`error_code` text,
	`redactions` integer DEFAULT 0 NOT NULL,
	`context_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_runs_ws_created` ON `ai_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_runs_actor_created` ON `ai_runs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`actor_id` text NOT NULL,
	`channel` text NOT NULL,
	`client_id` text,
	`operation` text NOT NULL,
	`target_id` text,
	`outcome` text NOT NULL,
	`error_code` text,
	`request_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_ws_created` ON `audit_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_created` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `search_docs` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`production_id` text NOT NULL,
	`item_id` text,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_docs_ws` ON `search_docs` (`workspace_id`,`production_id`);--> statement-breakpoint
CREATE TABLE `source_chunks` (
	`id` integer PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_chunks_ws` ON `source_chunks` (`workspace_id`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_chunk_ordinal` ON `source_chunks` (`source_id`,`ordinal`);--> statement-breakpoint
ALTER TABLE `changes` ADD `status` text DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE `changes` ADD `item_id` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `before_hash` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `origin_kind` text DEFAULT 'server_ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `changes` ADD `client_id` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `run_id` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `decided_by` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `decided_at` text;--> statement-breakpoint
ALTER TABLE `changes` ADD `applied_revision` integer;--> statement-breakpoint
CREATE INDEX `change_status` ON `changes` (`workspace_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `commands` ADD `created_at` text DEFAULT '1970-01-01T00:00:00.000Z' NOT NULL;--> statement-breakpoint
CREATE INDEX `command_created` ON `commands` (`created_at`);--> statement-breakpoint
ALTER TABLE `productions` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `productions` ADD `planned_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `productions` ADD `item_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `productions` ADD `size_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `chars` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `preview` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `ai_excluded` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sources` ADD `chunk_count` integer;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `settings` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `settings_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `generation_ws_created` ON `generation_requests` (`workspace_id`,`created_at`);--> statement-breakpoint
-- Hand-written: FTS5 cannot be expressed in db/schema.ts. Trigram tokenization
-- matches Japanese substrings of 3+ characters; shorter queries use instr().
CREATE VIRTUAL TABLE `search_fts` USING fts5(body, content='search_docs', content_rowid='id', tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER `search_docs_ai` AFTER INSERT ON `search_docs` BEGIN
  INSERT INTO search_fts(rowid, body) VALUES (new.id, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `search_docs_ad` AFTER DELETE ON `search_docs` BEGIN
  INSERT INTO search_fts(search_fts, rowid, body) VALUES ('delete', old.id, old.body);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE `source_chunks_fts` USING fts5(body, content='source_chunks', content_rowid='id', tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER `source_chunks_ai` AFTER INSERT ON `source_chunks` BEGIN
  INSERT INTO source_chunks_fts(rowid, body) VALUES (new.id, new.body);
END;
--> statement-breakpoint
CREATE TRIGGER `source_chunks_ad` AFTER DELETE ON `source_chunks` BEGIN
  INSERT INTO source_chunks_fts(source_chunks_fts, rowid, body) VALUES ('delete', old.id, old.body);
END;
--> statement-breakpoint
-- Backfill summary columns so lists stop parsing the JSON aggregate.
UPDATE `productions` SET
  title = COALESCE(json_extract(data, '$.title'), ''),
  planned_date = COALESCE(json_extract(data, '$.plannedDate'), ''),
  item_count = COALESCE(json_array_length(data, '$.items'), 0),
  size_bytes = length(CAST(data AS BLOB));
--> statement-breakpoint
INSERT INTO `search_docs` (workspace_id, production_id, item_id, body)
  SELECT p.workspace_id, p.id, NULL, json_extract(p.data, '$.title') FROM productions p
  UNION ALL
  SELECT p.workspace_id, p.id, json_extract(i.value, '$.id'),
         json_extract(i.value, '$.title') || char(10) || json_extract(i.value, '$.body')
  FROM productions p, json_each(p.data, '$.items') i;
--> statement-breakpoint
-- Receipts keep a reference only; snapshots already live in revisions.
UPDATE `commands` SET
  result = CASE WHEN json_extract(result, '$.data') IS NOT NULL
    THEN json_object('productionId', json_extract(result, '$.id'), 'revision', json_extract(result, '$.revision'))
    ELSE result END,
  created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
--> statement-breakpoint
UPDATE `sources` SET chars = length(body), preview = substr(body, 1, 600);
--> statement-breakpoint
UPDATE `changes` SET item_id = json_extract(data, '$.itemId');
--> statement-breakpoint
UPDATE `changes` SET status = 'applied'
  WHERE EXISTS (SELECT 1 FROM commands c WHERE c.workspace_id = changes.workspace_id AND c.key = 'apply_' || changes.id);
--> statement-breakpoint
-- Previous semantics: any later revision made a proposal unusable.
UPDATE `changes` SET status = 'stale'
  WHERE status = 'proposed' AND NOT EXISTS (
    SELECT 1 FROM productions p
    WHERE p.workspace_id = changes.workspace_id AND p.id = changes.production_id
      AND p.revision = json_extract(changes.data, '$.baseRevision'));
