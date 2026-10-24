CREATE TABLE `entries` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`released` text,
	`favorite` integer DEFAULT false NOT NULL,
	CONSTRAINT "entry_name_nonempty" CHECK(length("name") > 0)
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`entry_id` text NOT NULL,
	CONSTRAINT `identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_identities_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE
);
