UPDATE work_completion_records SET note = NULL
WHERE note IS NOT NULL AND trim(note, char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)) = '';
--> statement-breakpoint
ALTER TABLE `game_records` ADD `additional_completion_count` integer DEFAULT 0 NOT NULL
  CONSTRAINT "game_records_completion_count" CHECK (typeof(additional_completion_count) = 'integer' AND additional_completion_count BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
INSERT INTO `game_records` (game_id, additional_completion_count)
SELECT work_id, count(*) FROM work_completion_records
WHERE work_type = 'game' AND completed_date IS NULL AND note IS NULL
GROUP BY work_id
ON CONFLICT (game_id) DO UPDATE SET additional_completion_count = excluded.additional_completion_count;
--> statement-breakpoint
ALTER TABLE `anime_records` ADD `additional_completion_count` integer DEFAULT 0 NOT NULL
  CONSTRAINT "anime_records_completion_count" CHECK (typeof(additional_completion_count) = 'integer' AND additional_completion_count BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
INSERT INTO `anime_records` (anime_id, additional_completion_count)
SELECT work_id, count(*) FROM work_completion_records
WHERE work_type = 'anime' AND completed_date IS NULL AND note IS NULL
GROUP BY work_id
ON CONFLICT (anime_id) DO UPDATE SET additional_completion_count = excluded.additional_completion_count;
--> statement-breakpoint
ALTER TABLE `comic_records` ADD `additional_completion_count` integer DEFAULT 0 NOT NULL
  CONSTRAINT "comic_records_completion_count" CHECK (typeof(additional_completion_count) = 'integer' AND additional_completion_count BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
INSERT INTO `comic_records` (comic_id, additional_completion_count)
SELECT work_id, count(*) FROM work_completion_records
WHERE work_type = 'comic' AND completed_date IS NULL AND note IS NULL
GROUP BY work_id
ON CONFLICT (comic_id) DO UPDATE SET additional_completion_count = excluded.additional_completion_count;
--> statement-breakpoint
ALTER TABLE `novel_records` ADD `additional_completion_count` integer DEFAULT 0 NOT NULL
  CONSTRAINT "novel_records_completion_count" CHECK (typeof(additional_completion_count) = 'integer' AND additional_completion_count BETWEEN 0 AND 9007199254740991);
--> statement-breakpoint
INSERT INTO `novel_records` (novel_id, additional_completion_count)
SELECT work_id, count(*) FROM work_completion_records
WHERE work_type = 'novel' AND completed_date IS NULL AND note IS NULL
GROUP BY work_id
ON CONFLICT (novel_id) DO UPDATE SET additional_completion_count = excluded.additional_completion_count;
--> statement-breakpoint
CREATE TABLE `__new_work_completion_records` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`work_type` text NOT NULL,
	`completed_date` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_work_completion_records_work_id_work_type_entries_id_type_fk` FOREIGN KEY (`work_id`,`work_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "work_completion_records_work_type" CHECK("work_type" in ('game', 'anime', 'comic', 'novel')),
	CONSTRAINT "work_completion_records_detail" CHECK("completed_date" is not null or ("note" is not null and trim("note", char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)) <> ''))
);
--> statement-breakpoint
INSERT INTO `__new_work_completion_records`(`id`, `work_id`, `work_type`, `completed_date`, `note`, `created_at`, `updated_at`) SELECT `id`, `work_id`, `work_type`, `completed_date`, `note`, `created_at`, `updated_at` FROM `work_completion_records`
WHERE completed_date IS NOT NULL OR note IS NOT NULL;--> statement-breakpoint
DROP TABLE `work_completion_records`;--> statement-breakpoint
ALTER TABLE `__new_work_completion_records` RENAME TO `work_completion_records`;--> statement-breakpoint
CREATE INDEX `work_completion_records_work_created` ON `work_completion_records` (`work_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `work_completion_records_date` ON `work_completion_records` (json_extract("completed_date", '$.year'),json_extract("completed_date", '$.month'),json_extract("completed_date", '$.day'),`work_id`);--> statement-breakpoint
CREATE INDEX `work_completion_records_work_date` ON `work_completion_records` (`work_id`,json_extract("completed_date", '$.year') desc,json_extract("completed_date", '$.month') desc,json_extract("completed_date", '$.day') desc,`id`);
