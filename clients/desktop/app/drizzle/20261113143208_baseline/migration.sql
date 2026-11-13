CREATE TABLE `preferences` (
	`id` integer PRIMARY KEY,
	`general` text NOT NULL,
	`appearance` text NOT NULL,
	`navigation` text NOT NULL,
	`library` text NOT NULL,
	`usage` text NOT NULL,
	`playback` text NOT NULL,
	`shortcuts` text NOT NULL,
	`network` text NOT NULL,
	`updates` text NOT NULL,
	`proxy_credentials_ciphertext` blob,
	`proxy_credentials_revision` text,
	CONSTRAINT "preferences_singleton" CHECK("id" = 1),
	CONSTRAINT "preferences_credentials_pair" CHECK(("proxy_credentials_ciphertext" is null) = ("proxy_credentials_revision" is null)),
	CONSTRAINT "preferences_credentials_revision" CHECK(length("proxy_credentials_revision") > 0)
);
--> statement-breakpoint
CREATE TABLE `anime_annotation_content_attachments` (
	`annotation_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `anime_annotation_content_attachments_pk` PRIMARY KEY(`annotation_id`, `attachment_id`),
	CONSTRAINT `fk_anime_annotation_content_attachments_annotation_id_anime_annotations_id_fk` FOREIGN KEY (`annotation_id`) REFERENCES `anime_annotations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_annotation_content_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `anime_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`file_id` text,
	`image_id` text,
	`location` text NOT NULL,
	CONSTRAINT `fk_anime_annotations_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_annotations_file_id_anime_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `anime_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_anime_annotations_image_id_attachments_id_fk` FOREIGN KEY (`image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `anime_directories` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`definition` text NOT NULL,
	`recognition_profile_id` text,
	CONSTRAINT `fk_anime_directories_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_directories_recognition_profile_id_anime_file_recognition_profiles_id_fk` FOREIGN KEY (`recognition_profile_id`) REFERENCES `anime_file_recognition_profiles`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `anime_directories_path` UNIQUE(`anime_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `anime_episode_description_attachments` (
	`episode_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `anime_episode_description_attachments_pk` PRIMARY KEY(`episode_id`, `attachment_id`),
	CONSTRAINT `fk_anime_episode_description_attachments_episode_id_anime_episodes_id_fk` FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_episode_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `anime_episode_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`episode_id` text NOT NULL,
	CONSTRAINT `anime_episode_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_anime_episode_external_identities_episode_id_anime_episodes_id_fk` FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_episode_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "anime_episode_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `anime_episode_records` (
	`episode_id` text PRIMARY KEY NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_anime_episode_records_episode_id_anime_episodes_id_fk` FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_episode_records_completed" CHECK("is_completed" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `anime_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`original_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`release_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`number_label` text,
	`type` text,
	`declared_duration_ms` integer,
	CONSTRAINT `fk_anime_episodes_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_anime_episodes_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "anime_episodes_id" CHECK(length("id") > 0),
	CONSTRAINT "anime_episodes_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991)),
	CONSTRAINT "anime_episodes_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_episodes_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_episodes_type" CHECK("type" in ('regular', 'special')),
	CONSTRAINT "anime_episodes_duration" CHECK("declared_duration_ms" is null or (typeof("declared_duration_ms") = 'integer' and "declared_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `anime_extra_description_attachments` (
	`extra_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `anime_extra_description_attachments_pk` PRIMARY KEY(`extra_id`, `attachment_id`),
	CONSTRAINT `fk_anime_extra_description_attachments_extra_id_anime_extras_id_fk` FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_extra_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `anime_extra_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`extra_id` text NOT NULL,
	CONSTRAINT `anime_extra_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_anime_extra_external_identities_extra_id_anime_extras_id_fk` FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_extra_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "anime_extra_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `anime_extra_records` (
	`extra_id` text PRIMARY KEY NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_anime_extra_records_extra_id_anime_extras_id_fk` FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_extra_records_completed" CHECK("is_completed" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `anime_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`original_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`release_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`type` text,
	`declared_duration_ms` integer,
	CONSTRAINT `fk_anime_extras_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_anime_extras_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "anime_extras_id" CHECK(length("id") > 0),
	CONSTRAINT "anime_extras_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991)),
	CONSTRAINT "anime_extras_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_extras_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_extras_type" CHECK("type" in ('opening', 'ending', 'promotion', 'interview', 'other')),
	CONSTRAINT "anime_extras_duration" CHECK("declared_duration_ms" is null or (typeof("declared_duration_ms") = 'integer' and "declared_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `anime_file_episodes` (
	`file_id` text NOT NULL,
	`episode_id` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	CONSTRAINT `anime_file_episodes_pk` PRIMARY KEY(`file_id`, `episode_id`),
	CONSTRAINT `fk_anime_file_episodes_file_id_anime_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `anime_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_file_episodes_episode_id_anime_episodes_id_fk` FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_file_episodes_preferred_value" CHECK("is_preferred" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `anime_file_extras` (
	`file_id` text NOT NULL,
	`extra_id` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	CONSTRAINT `anime_file_extras_pk` PRIMARY KEY(`file_id`, `extra_id`),
	CONSTRAINT `fk_anime_file_extras_file_id_anime_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `anime_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_file_extras_extra_id_anime_extras_id_fk` FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON DELETE CASCADE,
	CONSTRAINT "anime_file_extras_preferred_value" CHECK("is_preferred" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `anime_file_recognition_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`definition` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "anime_file_recognition_profiles_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `anime_files` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`note` text,
	`association_mode` text DEFAULT 'automatic' NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`availability` text DEFAULT '{"status":"unchecked"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`anime_id` text NOT NULL,
	`metadata` text,
	`position` text,
	`preferences` text,
	`playback_choices` text DEFAULT '{"audioTrack":null,"subtitleTrack":null,"audioDelaySeconds":0,"subtitleDelaySeconds":0}' NOT NULL,
	CONSTRAINT `fk_anime_files_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `anime_files_path` UNIQUE(`anime_id`,`path`),
	CONSTRAINT "anime_files_preferred_value" CHECK("is_preferred" in (0, 1)),
	CONSTRAINT "anime_files_association_mode" CHECK("association_mode" in ('automatic', 'manual'))
);
--> statement-breakpoint
CREATE TABLE `anime_playback_preferences` (
	`anime_id` text PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	CONSTRAINT `fk_anime_playback_preferences_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `anime_records` (
	`anime_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`additional_duration_ms` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_anime_records_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "anime_records_status" CHECK("status" in ('planned', 'active', 'onHold')),
	CONSTRAINT "anime_records_duration" CHECK("additional_duration_ms" is null or (typeof("additional_duration_ms") = 'integer' and "additional_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `anime_watch_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`context_names` text NOT NULL,
	`anime_id` text NOT NULL,
	`file_id` text,
	`episode_id` text,
	`extra_id` text,
	CONSTRAINT `fk_anime_watch_activity_anime_id_animes_entry_id_fk` FOREIGN KEY (`anime_id`) REFERENCES `animes`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_anime_watch_activity_file_id_anime_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `anime_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_anime_watch_activity_episode_id_anime_episodes_id_fk` FOREIGN KEY (`episode_id`) REFERENCES `anime_episodes`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_anime_watch_activity_extra_id_anime_extras_id_fk` FOREIGN KEY (`extra_id`) REFERENCES `anime_extras`(`id`) ON DELETE SET NULL,
	CONSTRAINT "anime_watch_activity_start" CHECK("started_at" is null or (typeof("started_at") = 'integer' and "started_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_watch_activity_end" CHECK("ended_at" is null or (typeof("ended_at") = 'integer' and "ended_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "anime_watch_activity_duration" CHECK("duration_ms" is null or (typeof("duration_ms") = 'integer' and "duration_ms" between 0 and 9007199254740991)),
	CONSTRAINT "anime_watch_activity_interval" CHECK("ended_at" > "started_at" and "duration_ms" <= "ended_at" - "started_at"),
	CONSTRAINT "anime_watch_activity_part" CHECK("episode_id" is null or "extra_id" is null)
);
--> statement-breakpoint
CREATE TABLE `animes` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('anime') VIRTUAL,
	`release_date` text,
	`original_languages` text DEFAULT '[]' NOT NULL,
	`backdrop_image_id` text,
	`title_logo_id` text,
	`release_status` text,
	`release_end_date` text,
	`declared_duration_ms` integer,
	`declared_regular_episode_count` integer,
	`declared_special_episode_count` integer,
	CONSTRAINT `fk_animes_backdrop_image_id_attachments_id_fk` FOREIGN KEY (`backdrop_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_animes_title_logo_id_attachments_id_fk` FOREIGN KEY (`title_logo_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_animes_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "animes_release_status" CHECK("release_status" in ('planned', 'ongoing', 'finished', 'paused', 'cancelled')),
	CONSTRAINT "animes_duration" CHECK("declared_duration_ms" is null or (typeof("declared_duration_ms") = 'integer' and "declared_duration_ms" between 0 and 9007199254740991)),
	CONSTRAINT "animes_regular_count" CHECK("declared_regular_episode_count" is null or (typeof("declared_regular_episode_count") = 'integer' and "declared_regular_episode_count" between 0 and 9007199254740991)),
	CONSTRAINT "animes_special_count" CHECK("declared_special_episode_count" is null or (typeof("declared_special_episode_count") = 'integer' and "declared_special_episode_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "attachments_id" CHECK(length("id") > 0),
	CONSTRAINT "attachments_sha256" CHECK(length("sha256") = 64 and "sha256" not glob '*[^0-9a-f]*'),
	CONSTRAINT "attachments_size" CHECK("byte_size" is null or (typeof("byte_size") = 'integer' and "byte_size" between 0 and 9007199254740991)),
	CONSTRAINT "attachments_width" CHECK("width" is null or (typeof("width") = 'integer' and "width" between 1 and 9007199254740991)),
	CONSTRAINT "attachments_height" CHECK("height" is null or (typeof("height") = 'integer' and "height" between 1 and 9007199254740991)),
	CONSTRAINT "attachments_dimensions" CHECK(("width" is null) = ("height" is null)),
	CONSTRAINT "attachments_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('character') VIRTUAL,
	`birth_date` text,
	`gender` text,
	`blood_type` text,
	`age` text,
	`height` text,
	`weight` text,
	`bust` text,
	`waist` text,
	`hips` text,
	`cup_size` text,
	CONSTRAINT `fk_characters_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "characters_gender" CHECK("gender" in ('male', 'female', 'nonBinary', 'genderless', 'other')),
	CONSTRAINT "characters_blood_type" CHECK("blood_type" in ('a', 'b', 'ab', 'o'))
);
--> statement-breakpoint
CREATE TABLE `collection_description_attachments` (
	`collection_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `collection_description_attachments_pk` PRIMARY KEY(`collection_id`, `attachment_id`),
	CONSTRAINT `fk_collection_description_attachments_collection_id_collections_id_fk` FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_collection_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `collection_members` (
	`collection_id` text NOT NULL,
	`membership_mode` text GENERATED ALWAYS AS ('manual') VIRTUAL,
	`entry_id` text NOT NULL,
	`note` text,
	`order_in_collection` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `collection_members_pk` PRIMARY KEY(`collection_id`, `entry_id`),
	CONSTRAINT `fk_collection_members_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_collection_members_collection_id_membership_mode_collections_id_membership_mode_fk` FOREIGN KEY (`collection_id`,`membership_mode`) REFERENCES `collections`(`id`,`membership_mode`) ON DELETE CASCADE,
	CONSTRAINT "collection_members_order" CHECK("order_in_collection" is null or (typeof("order_in_collection") = 'integer' and "order_in_collection" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`primary_image_id` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`membership_mode` text DEFAULT 'manual' NOT NULL,
	`dynamic_rules` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_collections_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `collections_id_mode` UNIQUE(`id`,`membership_mode`),
	CONSTRAINT "collections_name" CHECK(length("name") > 0),
	CONSTRAINT "collections_nsfw" CHECK("is_nsfw" in (0, 1)),
	CONSTRAINT "collections_rules" CHECK(("membership_mode" = 'manual' and "dynamic_rules" is null) or ("membership_mode" = 'dynamic' and "dynamic_rules" is not null)),
	CONSTRAINT "collections_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comic_annotation_content_attachments` (
	`annotation_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `comic_annotation_content_attachments_pk` PRIMARY KEY(`annotation_id`, `attachment_id`),
	CONSTRAINT `fk_comic_annotation_content_attachments_annotation_id_comic_annotations_id_fk` FOREIGN KEY (`annotation_id`) REFERENCES `comic_annotations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_annotation_content_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `comic_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`file_id` text,
	`image_id` text,
	`location` text NOT NULL,
	`quote` text,
	CONSTRAINT `fk_comic_annotations_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_annotations_file_id_comic_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `comic_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_comic_annotations_image_id_attachments_id_fk` FOREIGN KEY (`image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `comic_chapter_description_attachments` (
	`chapter_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `comic_chapter_description_attachments_pk` PRIMARY KEY(`chapter_id`, `attachment_id`),
	CONSTRAINT `fk_comic_chapter_description_attachments_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_chapter_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `comic_chapter_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	CONSTRAINT `comic_chapter_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_comic_chapter_external_identities_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_chapter_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "comic_chapter_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `comic_chapter_records` (
	`chapter_id` text PRIMARY KEY NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_comic_chapter_records_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_chapter_records_completed" CHECK("is_completed" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `comic_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`original_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`release_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`number_label` text,
	`declared_page_count` integer,
	CONSTRAINT `fk_comic_chapters_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_comic_chapters_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "comic_chapters_id" CHECK(length("id") > 0),
	CONSTRAINT "comic_chapters_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991)),
	CONSTRAINT "comic_chapters_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_chapters_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_chapters_pages" CHECK("declared_page_count" is null or (typeof("declared_page_count") = 'integer' and "declared_page_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comic_directories` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`definition` text NOT NULL,
	`recognition_profile_id` text,
	CONSTRAINT `fk_comic_directories_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_directories_recognition_profile_id_comic_file_recognition_profiles_id_fk` FOREIGN KEY (`recognition_profile_id`) REFERENCES `comic_file_recognition_profiles`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `comic_directories_path` UNIQUE(`comic_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `comic_file_chapters` (
	`file_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	CONSTRAINT `comic_file_chapters_pk` PRIMARY KEY(`file_id`, `chapter_id`),
	CONSTRAINT `fk_comic_file_chapters_file_id_comic_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `comic_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_file_chapters_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_file_chapters_preferred_value" CHECK("is_preferred" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `comic_file_recognition_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`definition` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "comic_file_recognition_profiles_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comic_file_volumes` (
	`file_id` text NOT NULL,
	`volume_id` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	CONSTRAINT `comic_file_volumes_pk` PRIMARY KEY(`file_id`, `volume_id`),
	CONSTRAINT `fk_comic_file_volumes_file_id_comic_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `comic_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_file_volumes_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_file_volumes_preferred_value" CHECK("is_preferred" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `comic_files` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`note` text,
	`association_mode` text DEFAULT 'automatic' NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`availability` text DEFAULT '{"status":"unchecked"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`kind` text NOT NULL,
	`metadata` text,
	`position` text,
	`progress` real,
	`text_encoding` text,
	`preferences` text,
	CONSTRAINT `fk_comic_files_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `comic_files_path` UNIQUE(`comic_id`,`path`),
	CONSTRAINT "comic_files_preferred_value" CHECK("is_preferred" in (0, 1)),
	CONSTRAINT "comic_files_association_mode" CHECK("association_mode" in ('automatic', 'manual')),
	CONSTRAINT "comic_files_kind" CHECK("kind" in ('file', 'directory')),
	CONSTRAINT "comic_files_progress" CHECK("progress" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE `comic_reading_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`context_names` text NOT NULL,
	`comic_id` text NOT NULL,
	`file_id` text,
	`volume_id` text,
	`chapter_id` text,
	CONSTRAINT `fk_comic_reading_activity_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_reading_activity_file_id_comic_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `comic_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_comic_reading_activity_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_comic_reading_activity_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE SET NULL,
	CONSTRAINT "comic_reading_activity_start" CHECK("started_at" is null or (typeof("started_at") = 'integer' and "started_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_reading_activity_end" CHECK("ended_at" is null or (typeof("ended_at") = 'integer' and "ended_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_reading_activity_duration" CHECK("duration_ms" is null or (typeof("duration_ms") = 'integer' and "duration_ms" between 0 and 9007199254740991)),
	CONSTRAINT "comic_reading_activity_interval" CHECK("ended_at" > "started_at" and "duration_ms" <= "ended_at" - "started_at"),
	CONSTRAINT "comic_reading_activity_part" CHECK("volume_id" is null or "chapter_id" is null)
);
--> statement-breakpoint
CREATE TABLE `comic_reading_preferences` (
	`comic_id` text PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	CONSTRAINT `fk_comic_reading_preferences_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `comic_records` (
	`comic_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`additional_duration_ms` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_comic_records_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "comic_records_status" CHECK("status" in ('planned', 'active', 'onHold')),
	CONSTRAINT "comic_records_duration" CHECK("additional_duration_ms" is null or (typeof("additional_duration_ms") = 'integer' and "additional_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comic_volume_chapters` (
	`volume_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`number_label` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `comic_volume_chapters_pk` PRIMARY KEY(`volume_id`, `chapter_id`),
	CONSTRAINT `fk_comic_volume_chapters_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_volume_chapters_chapter_id_comic_chapters_id_fk` FOREIGN KEY (`chapter_id`) REFERENCES `comic_chapters`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_volume_chapters_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comic_volume_description_attachments` (
	`volume_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `comic_volume_description_attachments_pk` PRIMARY KEY(`volume_id`, `attachment_id`),
	CONSTRAINT `fk_comic_volume_description_attachments_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_comic_volume_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `comic_volume_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`volume_id` text NOT NULL,
	CONSTRAINT `comic_volume_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_comic_volume_external_identities_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_volume_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "comic_volume_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `comic_volume_records` (
	`volume_id` text PRIMARY KEY NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_comic_volume_records_volume_id_comic_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `comic_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "comic_volume_records_completed" CHECK("is_completed" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `comic_volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`original_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`release_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`comic_id` text NOT NULL,
	`number_label` text,
	`declared_page_count` integer,
	`declared_chapter_count` integer,
	CONSTRAINT `fk_comic_volumes_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_comic_volumes_comic_id_comics_entry_id_fk` FOREIGN KEY (`comic_id`) REFERENCES `comics`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "comic_volumes_id" CHECK(length("id") > 0),
	CONSTRAINT "comic_volumes_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991)),
	CONSTRAINT "comic_volumes_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_volumes_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "comic_volumes_pages" CHECK("declared_page_count" is null or (typeof("declared_page_count") = 'integer' and "declared_page_count" between 0 and 9007199254740991)),
	CONSTRAINT "comic_volumes_chapters" CHECK("declared_chapter_count" is null or (typeof("declared_chapter_count") = 'integer' and "declared_chapter_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `comics` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('comic') VIRTUAL,
	`release_date` text,
	`original_languages` text DEFAULT '[]' NOT NULL,
	`backdrop_image_id` text,
	`title_logo_id` text,
	`release_status` text,
	`release_end_date` text,
	`declared_page_count` integer,
	`declared_volume_count` integer,
	`declared_chapter_count` integer,
	CONSTRAINT `fk_comics_backdrop_image_id_attachments_id_fk` FOREIGN KEY (`backdrop_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_comics_title_logo_id_attachments_id_fk` FOREIGN KEY (`title_logo_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_comics_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "comics_release_status" CHECK("release_status" in ('planned', 'ongoing', 'finished', 'paused', 'cancelled')),
	CONSTRAINT "comics_page_count" CHECK("declared_page_count" is null or (typeof("declared_page_count") = 'integer' and "declared_page_count" between 0 and 9007199254740991)),
	CONSTRAINT "comics_volume_count" CHECK("declared_volume_count" is null or (typeof("declared_volume_count") = 'integer' and "declared_volume_count" between 0 and 9007199254740991)),
	CONSTRAINT "comics_chapter_count" CHECK("declared_chapter_count" is null or (typeof("declared_chapter_count") = 'integer' and "declared_chapter_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`original_name` text,
	`sort_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`added_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name_key` blob GENERATED ALWAYS AS (kisaki_name_key_v1("name")) STORED,
	`sort_name_key` blob GENERATED ALWAYS AS (kisaki_name_key_v1(coalesce("sort_name", "name"))) STORED,
	`original_name_key` blob GENERATED ALWAYS AS (kisaki_name_key_v1("original_name")) STORED,
	CONSTRAINT `fk_entries_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `entries_id_type` UNIQUE(`id`,`type`),
	CONSTRAINT "entries_type" CHECK("type" in ('game', 'anime', 'comic', 'novel', 'character', 'person', 'organization')),
	CONSTRAINT "entries_id" CHECK(length("id") > 0),
	CONSTRAINT "entries_name" CHECK(length("name") > 0),
	CONSTRAINT "entries_nsfw" CHECK("is_nsfw" in (0, 1)),
	CONSTRAINT "entries_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "entries_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `entry_description_attachments` (
	`entry_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `entry_description_attachments_pk` PRIMARY KEY(`entry_id`, `attachment_id`),
	CONSTRAINT `fk_entry_description_attachments_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_entry_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `entry_evaluations` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`rating` integer,
	`favorite` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_entry_evaluations_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT "entry_evaluations_rating" CHECK("rating" is null or (typeof("rating") = 'integer' and "rating" between 0 and 100)),
	CONSTRAINT "entry_evaluations_favorite" CHECK("favorite" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `entry_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`entry_id` text NOT NULL,
	CONSTRAINT `entry_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_entry_external_identities_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT "entry_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "entry_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `entry_tags` (
	`entry_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`note` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`order_in_entry` integer DEFAULT 0 NOT NULL,
	`order_in_tag` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `entry_tags_pk` PRIMARY KEY(`entry_id`, `tag_id`),
	CONSTRAINT `fk_entry_tags_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_entry_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
	CONSTRAINT "entry_tags_spoiler" CHECK("is_spoiler" in (0, 1)),
	CONSTRAINT "entry_tags_entry_order" CHECK("order_in_entry" is null or (typeof("order_in_entry") = 'integer' and "order_in_entry" between 0 and 9007199254740991)),
	CONSTRAINT "entry_tags_tag_order" CHECK("order_in_tag" is null or (typeof("order_in_tag") = 'integer' and "order_in_tag" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `extension_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`declared_id` text NOT NULL,
	`trusted_public_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `extension_secrets` (
	`extension_id` text NOT NULL,
	`key` text NOT NULL,
	`encrypted_value` blob NOT NULL,
	`revision` text NOT NULL,
	CONSTRAINT `extension_secrets_pk` PRIMARY KEY(`extension_id`, `key`),
	CONSTRAINT "extension_secrets_revision" CHECK(length("revision") > 0)
);
--> statement-breakpoint
CREATE TABLE `extension_storage` (
	`extension_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`revision` text NOT NULL,
	CONSTRAINT `extension_storage_pk` PRIMARY KEY(`extension_id`, `key`),
	CONSTRAINT "extension_storage_revision" CHECK(length("revision") > 0)
);
--> statement-breakpoint
CREATE TABLE `font_attachments` (
	`font_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	`metadata` text NOT NULL,
	CONSTRAINT `font_attachments_pk` PRIMARY KEY(`font_id`, `attachment_id`),
	CONSTRAINT `fk_font_attachments_font_id_fonts_id_fk` FOREIGN KEY (`font_id`) REFERENCES `fonts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_font_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `fonts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_annotation_content_attachments` (
	`annotation_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `game_annotation_content_attachments_pk` PRIMARY KEY(`annotation_id`, `attachment_id`),
	CONSTRAINT `fk_game_annotation_content_attachments_annotation_id_game_annotations_id_fk` FOREIGN KEY (`annotation_id`) REFERENCES `game_annotations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_game_annotation_content_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `game_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`game_id` text NOT NULL,
	`image_id` text NOT NULL,
	CONSTRAINT `fk_game_annotations_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_game_annotations_image_id_attachments_id_fk` FOREIGN KEY (`image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `game_backup_recoveries` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`backup_id` text NOT NULL,
	`protection_backup_id` text,
	`target_path` text NOT NULL,
	`target_kind` text NOT NULL,
	`workspace_path` text NOT NULL UNIQUE,
	`manifest_sha256` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolution` text,
	`resolved_at` integer,
	CONSTRAINT `fk_game_backup_recoveries_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_game_backup_recoveries_backup_id_game_save_backups_id_fk` FOREIGN KEY (`backup_id`) REFERENCES `game_save_backups`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_game_backup_recoveries_protection_backup_id_game_save_backups_id_fk` FOREIGN KEY (`protection_backup_id`) REFERENCES `game_save_backups`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "game_backup_recoveries_kind" CHECK("target_kind" in ('file', 'directory')),
	CONSTRAINT "game_backup_recoveries_resolution" CHECK("resolution" in ('restored', 'rolledBack', 'keptCurrent')),
	CONSTRAINT "game_backup_recoveries_resolution_time" CHECK(("resolution" is null) = ("resolved_at" is null)),
	CONSTRAINT "game_backup_recoveries_digest" CHECK(length("manifest_sha256") = 64 and "manifest_sha256" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE TABLE `game_directories` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`game_id` text NOT NULL,
	CONSTRAINT `fk_game_directories_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `game_directories_path` UNIQUE(`game_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `game_launch_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`definition` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_game_launch_configs_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "game_launch_configs_preferred_value" CHECK("is_preferred" in (0, 1)),
	CONSTRAINT "game_launch_configs_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `game_play_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`context_names` text NOT NULL,
	`game_id` text NOT NULL,
	`launch_config_id` text,
	CONSTRAINT `fk_game_play_activity_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_game_play_activity_launch_config_id_game_launch_configs_id_fk` FOREIGN KEY (`launch_config_id`) REFERENCES `game_launch_configs`(`id`) ON DELETE SET NULL,
	CONSTRAINT "game_play_activity_start" CHECK("started_at" is null or (typeof("started_at") = 'integer' and "started_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "game_play_activity_end" CHECK("ended_at" is null or (typeof("ended_at") = 'integer' and "ended_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "game_play_activity_duration" CHECK("duration_ms" is null or (typeof("duration_ms") = 'integer' and "duration_ms" between 0 and 9007199254740991)),
	CONSTRAINT "game_play_activity_interval" CHECK("ended_at" > "started_at" and "duration_ms" <= "ended_at" - "started_at")
);
--> statement-breakpoint
CREATE TABLE `game_records` (
	`game_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`additional_duration_ms` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_game_records_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "game_records_status" CHECK("status" in ('planned', 'active', 'onHold')),
	CONSTRAINT "game_records_duration" CHECK("additional_duration_ms" is null or (typeof("additional_duration_ms") = 'integer' and "additional_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `game_save_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`source_config_id` text,
	`source_config_name` text NOT NULL,
	`source_path` text NOT NULL,
	`source_kind` text NOT NULL,
	`reason` text NOT NULL,
	`archive_attachment_id` text NOT NULL,
	`tree_digest` text NOT NULL,
	`unpacked_size_bytes` integer NOT NULL,
	`note` text,
	`is_locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_game_save_backups_game_id_games_entry_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_game_save_backups_source_config_id_game_launch_configs_id_fk` FOREIGN KEY (`source_config_id`) REFERENCES `game_launch_configs`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_game_save_backups_archive_attachment_id_attachments_id_fk` FOREIGN KEY (`archive_attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT "game_save_backups_kind" CHECK("source_kind" in ('file', 'directory')),
	CONSTRAINT "game_save_backups_reason" CHECK("reason" in ('manual', 'automatic', 'beforeRestore')),
	CONSTRAINT "game_save_backups_locked" CHECK("is_locked" in (0, 1)),
	CONSTRAINT "game_save_backups_size" CHECK("unpacked_size_bytes" is null or (typeof("unpacked_size_bytes") = 'integer' and "unpacked_size_bytes" between 0 and 9007199254740991)),
	CONSTRAINT "game_save_backups_digest" CHECK(length("tree_digest") = 64 and "tree_digest" not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE TABLE `games` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('game') VIRTUAL,
	`release_date` text,
	`original_languages` text DEFAULT '[]' NOT NULL,
	`backdrop_image_id` text,
	`title_logo_id` text,
	`icon_image_id` text,
	CONSTRAINT `fk_games_backdrop_image_id_attachments_id_fk` FOREIGN KEY (`backdrop_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_games_title_logo_id_attachments_id_fk` FOREIGN KEY (`title_logo_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_games_icon_image_id_attachments_id_fk` FOREIGN KEY (`icon_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_games_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `installed_extensions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`artifact` text NOT NULL,
	`package_path` text NOT NULL,
	`enabled` integer NOT NULL,
	`update_repository_id` text,
	`allow_prerelease` integer DEFAULT false NOT NULL,
	`prepared_update` text,
	`prepared_package_path` text,
	CONSTRAINT `fk_installed_extensions_update_repository_id_extension_repositories_id_fk` FOREIGN KEY (`update_repository_id`) REFERENCES `extension_repositories`(`id`) ON DELETE SET NULL,
	CONSTRAINT "installed_extensions_enabled" CHECK("enabled" in (0, 1)),
	CONSTRAINT "installed_extensions_prerelease" CHECK("allow_prerelease" in (0, 1)),
	CONSTRAINT "installed_extensions_prepared_path" CHECK(("prepared_update" is null) = ("prepared_package_path" is null))
);
--> statement-breakpoint
CREATE TABLE `metadata_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`entry_type` text NOT NULL,
	`preferred_languages` text DEFAULT '[]' NOT NULL,
	`definition` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `metadata_profiles_id_type` UNIQUE(`id`,`entry_type`),
	CONSTRAINT "metadata_profiles_type" CHECK("entry_type" in ('game', 'anime', 'comic', 'novel', 'character', 'person', 'organization')),
	CONSTRAINT "metadata_profiles_default_value" CHECK("is_default" in (0, 1)),
	CONSTRAINT "metadata_profiles_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `note_content_attachments` (
	`note_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `note_content_attachments_pk` PRIMARY KEY(`note_id`, `attachment_id`),
	CONSTRAINT `fk_note_content_attachments_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_note_content_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `note_entry_links` (
	`note_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`order_in_note` integer DEFAULT 0 NOT NULL,
	`order_in_entry` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `note_entry_links_pk` PRIMARY KEY(`note_id`, `entry_id`),
	CONSTRAINT `fk_note_entry_links_note_id_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_note_entry_links_entry_id_entries_id_fk` FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT "note_entry_links_note_order" CHECK("order_in_note" is null or (typeof("order_in_note") = 'integer' and "order_in_note" between 0 and 9007199254740991)),
	CONSTRAINT "note_entry_links_entry_order" CHECK("order_in_entry" is null or (typeof("order_in_entry") = 'integer' and "order_in_entry" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`primary_image_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_notes_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `novel_annotation_content_attachments` (
	`annotation_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `novel_annotation_content_attachments_pk` PRIMARY KEY(`annotation_id`, `attachment_id`),
	CONSTRAINT `fk_novel_annotation_content_attachments_annotation_id_novel_annotations_id_fk` FOREIGN KEY (`annotation_id`) REFERENCES `novel_annotations`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_annotation_content_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `novel_annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`file_id` text,
	`image_id` text,
	`location` text NOT NULL,
	`quote` text,
	CONSTRAINT `fk_novel_annotations_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_annotations_file_id_novel_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `novel_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_novel_annotations_image_id_attachments_id_fk` FOREIGN KEY (`image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `novel_directories` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`definition` text NOT NULL,
	`recognition_profile_id` text,
	CONSTRAINT `fk_novel_directories_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_directories_recognition_profile_id_novel_file_recognition_profiles_id_fk` FOREIGN KEY (`recognition_profile_id`) REFERENCES `novel_file_recognition_profiles`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `novel_directories_path` UNIQUE(`novel_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `novel_file_recognition_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`definition` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "novel_file_recognition_profiles_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `novel_file_volumes` (
	`file_id` text NOT NULL,
	`volume_id` text NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	CONSTRAINT `novel_file_volumes_pk` PRIMARY KEY(`file_id`, `volume_id`),
	CONSTRAINT `fk_novel_file_volumes_file_id_novel_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `novel_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_file_volumes_volume_id_novel_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "novel_file_volumes_preferred_value" CHECK("is_preferred" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `novel_files` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`note` text,
	`association_mode` text DEFAULT 'automatic' NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`availability` text DEFAULT '{"status":"unchecked"}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`kind` text NOT NULL,
	`metadata` text,
	`position` text,
	`progress` real,
	`text_encoding` text,
	`preferences` text,
	CONSTRAINT `fk_novel_files_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `novel_files_path` UNIQUE(`novel_id`,`path`),
	CONSTRAINT "novel_files_preferred_value" CHECK("is_preferred" in (0, 1)),
	CONSTRAINT "novel_files_association_mode" CHECK("association_mode" in ('automatic', 'manual')),
	CONSTRAINT "novel_files_kind" CHECK("kind" in ('file', 'directory')),
	CONSTRAINT "novel_files_progress" CHECK("progress" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE `novel_reading_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`context_names` text NOT NULL,
	`novel_id` text NOT NULL,
	`file_id` text,
	`volume_id` text,
	CONSTRAINT `fk_novel_reading_activity_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_reading_activity_file_id_novel_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `novel_files`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_novel_reading_activity_volume_id_novel_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON DELETE SET NULL,
	CONSTRAINT "novel_reading_activity_start" CHECK("started_at" is null or (typeof("started_at") = 'integer' and "started_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "novel_reading_activity_end" CHECK("ended_at" is null or (typeof("ended_at") = 'integer' and "ended_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "novel_reading_activity_duration" CHECK("duration_ms" is null or (typeof("duration_ms") = 'integer' and "duration_ms" between 0 and 9007199254740991)),
	CONSTRAINT "novel_reading_activity_interval" CHECK("ended_at" > "started_at" and "duration_ms" <= "ended_at" - "started_at")
);
--> statement-breakpoint
CREATE TABLE `novel_reading_preferences` (
	`novel_id` text PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	CONSTRAINT `fk_novel_reading_preferences_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `novel_records` (
	`novel_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`additional_duration_ms` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_novel_records_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "novel_records_status" CHECK("status" in ('planned', 'active', 'onHold')),
	CONSTRAINT "novel_records_duration" CHECK("additional_duration_ms" is null or (typeof("additional_duration_ms") = 'integer' and "additional_duration_ms" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `novel_volume_description_attachments` (
	`volume_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `novel_volume_description_attachments_pk` PRIMARY KEY(`volume_id`, `attachment_id`),
	CONSTRAINT `fk_novel_volume_description_attachments_volume_id_novel_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_novel_volume_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `novel_volume_external_identities` (
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`volume_id` text NOT NULL,
	CONSTRAINT `novel_volume_external_identities_pk` PRIMARY KEY(`source`, `source_id`),
	CONSTRAINT `fk_novel_volume_external_identities_volume_id_novel_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "novel_volume_external_identities_source" CHECK(length("source") > 0),
	CONSTRAINT "novel_volume_external_identities_source_id" CHECK(length("source_id") > 0)
);
--> statement-breakpoint
CREATE TABLE `novel_volume_records` (
	`volume_id` text PRIMARY KEY NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_novel_volume_records_volume_id_novel_volumes_id_fk` FOREIGN KEY (`volume_id`) REFERENCES `novel_volumes`(`id`) ON DELETE CASCADE,
	CONSTRAINT "novel_volume_records_completed" CHECK("is_completed" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `novel_volumes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`original_name` text,
	`aliases` text DEFAULT '[]' NOT NULL,
	`description` text,
	`primary_image_id` text,
	`external_links` text DEFAULT '[]' NOT NULL,
	`release_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`novel_id` text NOT NULL,
	`number_label` text,
	`declared_page_count` integer,
	CONSTRAINT `fk_novel_volumes_primary_image_id_attachments_id_fk` FOREIGN KEY (`primary_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_novel_volumes_novel_id_novels_entry_id_fk` FOREIGN KEY (`novel_id`) REFERENCES `novels`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT "novel_volumes_id" CHECK(length("id") > 0),
	CONSTRAINT "novel_volumes_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991)),
	CONSTRAINT "novel_volumes_created" CHECK("created_at" is null or (typeof("created_at") = 'integer' and "created_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "novel_volumes_updated" CHECK("updated_at" is null or (typeof("updated_at") = 'integer' and "updated_at" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "novel_volumes_pages" CHECK("declared_page_count" is null or (typeof("declared_page_count") = 'integer' and "declared_page_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `novels` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('novel') VIRTUAL,
	`release_date` text,
	`original_languages` text DEFAULT '[]' NOT NULL,
	`backdrop_image_id` text,
	`title_logo_id` text,
	`release_status` text,
	`release_end_date` text,
	`declared_page_count` integer,
	`declared_volume_count` integer,
	CONSTRAINT `fk_novels_backdrop_image_id_attachments_id_fk` FOREIGN KEY (`backdrop_image_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_novels_title_logo_id_attachments_id_fk` FOREIGN KEY (`title_logo_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT,
	CONSTRAINT `fk_novels_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "novels_release_status" CHECK("release_status" in ('planned', 'ongoing', 'finished', 'paused', 'cancelled')),
	CONSTRAINT "novels_page_count" CHECK("declared_page_count" is null or (typeof("declared_page_count") = 'integer' and "declared_page_count" between 0 and 9007199254740991)),
	CONSTRAINT "novels_volume_count" CHECK("declared_volume_count" is null or (typeof("declared_volume_count") = 'integer' and "declared_volume_count" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `onboarding_state` (
	`id` integer PRIMARY KEY,
	`state` text NOT NULL,
	CONSTRAINT "onboarding_state_singleton" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('organization') VIRTUAL,
	`founded_date` text,
	`dissolved_date` text,
	CONSTRAINT `fk_organizations_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`entry_type` text GENERATED ALWAYS AS ('person') VIRTUAL,
	`birth_date` text,
	`death_date` text,
	`gender` text,
	CONSTRAINT `fk_persons_entry_id_entry_type_entries_id_type_fk` FOREIGN KEY (`entry_id`,`entry_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT "persons_gender" CHECK("gender" in ('male', 'female', 'nonBinary', 'genderless', 'other'))
);
--> statement-breakpoint
CREATE TABLE `scan_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`work_type` text NOT NULL,
	`root_path` text NOT NULL,
	`metadata_profile_id` text NOT NULL,
	`definition` text NOT NULL,
	`register_existing_content` integer DEFAULT false NOT NULL,
	`watch_enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_scan_configs_metadata_profile_id_work_type_metadata_profiles_id_entry_type_fk` FOREIGN KEY (`metadata_profile_id`,`work_type`) REFERENCES `metadata_profiles`(`id`,`entry_type`) ON DELETE RESTRICT,
	CONSTRAINT "scan_configs_work_type" CHECK("work_type" in ('game', 'anime', 'comic', 'novel')),
	CONSTRAINT "scan_configs_register_existing" CHECK("register_existing_content" in (0, 1)),
	CONSTRAINT "scan_configs_watch_enabled" CHECK("watch_enabled" in (0, 1)),
	CONSTRAINT "scan_configs_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_config_id` text NOT NULL,
	`config_snapshot` text NOT NULL,
	`scope` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	CONSTRAINT "scan_runs_status" CHECK("status" in ('active', 'completed', 'failed', 'cancelled', 'interrupted'))
);
--> statement-breakpoint
CREATE TABLE `showcase_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`layout` text NOT NULL,
	`item_size` text NOT NULL,
	`open_mode` text NOT NULL,
	`limit` integer,
	`is_visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "showcase_sections_layout" CHECK("layout" in ('horizontal', 'grid')),
	CONSTRAINT "showcase_sections_item_size" CHECK("item_size" in ('xs', 'sm', 'md', 'lg', 'xl')),
	CONSTRAINT "showcase_sections_open_mode" CHECK("open_mode" in ('page', 'dialog')),
	CONSTRAINT "showcase_sections_visible" CHECK("is_visible" in (0, 1)),
	CONSTRAINT "showcase_sections_limit" CHECK("limit" is null or (typeof("limit") = 'integer' and "limit" between 1 and 9007199254740991)),
	CONSTRAINT "showcase_sections_order" CHECK("sort_order" is null or (typeof("sort_order") = 'integer' and "sort_order" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `tag_description_attachments` (
	`tag_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	CONSTRAINT `tag_description_attachments_pk` PRIMARY KEY(`tag_id`, `attachment_id`),
	CONSTRAINT `fk_tag_description_attachments_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_tag_description_attachments_attachment_id_attachments_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL UNIQUE,
	`description` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name_order_key` blob GENERATED ALWAYS AS (kisaki_name_key_v1("name")) STORED,
	CONSTRAINT "tags_name" CHECK(length("name") > 0),
	CONSTRAINT "tags_name_key" CHECK(length("name_key") > 0),
	CONSTRAINT "tags_nsfw" CHECK("is_nsfw" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`input` text,
	`result` text,
	`error` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	CONSTRAINT "task_runs_status" CHECK("status" in ('queued', 'running', 'pausing', 'paused', 'cancelling', 'completed', 'failed', 'cancelled', 'interrupted'))
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`light` text NOT NULL,
	`dark` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_character_links` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`work_type` text NOT NULL,
	`note` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`order_in_work` integer DEFAULT 0 NOT NULL,
	`character_id` text NOT NULL,
	`role` text,
	`order_in_character` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_work_character_links_character_id_characters_entry_id_fk` FOREIGN KEY (`character_id`) REFERENCES `characters`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_work_character_links_work_id_work_type_entries_id_type_fk` FOREIGN KEY (`work_id`,`work_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT `work_character_links_identity` UNIQUE(`work_id`,`character_id`),
	CONSTRAINT "work_character_links_work_type" CHECK("work_type" in ('game', 'anime', 'comic', 'novel')),
	CONSTRAINT "work_character_links_role" CHECK("role" in ('main', 'supporting', 'cameo', 'other')),
	CONSTRAINT "work_character_links_spoiler" CHECK("is_spoiler" in (0, 1)),
	CONSTRAINT "work_character_links_work_order" CHECK("order_in_work" is null or (typeof("order_in_work") = 'integer' and "order_in_work" between 0 and 9007199254740991)),
	CONSTRAINT "work_character_links_character_order" CHECK("order_in_character" is null or (typeof("order_in_character") = 'integer' and "order_in_character" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `work_completion_records` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`completed_date` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_work_completion_records_work_id_entries_id_fk` FOREIGN KEY (`work_id`) REFERENCES `entries`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `work_organization_links` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`work_type` text NOT NULL,
	`note` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`order_in_work` integer DEFAULT 0 NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`order_in_organization` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_work_organization_links_organization_id_organizations_entry_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_work_organization_links_work_id_work_type_entries_id_type_fk` FOREIGN KEY (`work_id`,`work_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT `work_organization_links_identity` UNIQUE(`work_id`,`organization_id`,`role`),
	CONSTRAINT "work_organization_links_role" CHECK(("work_type" = 'game' and "role" in ('creator','originalCreator','developer','studio','producer','music','sound','publisher','distributor','localization','other')) or ("work_type" = 'anime' and "role" in ('creator','originalCreator','studio','producer','music','sound','publisher','distributor','localization','other')) or ("work_type" = 'comic' and "role" in ('creator','originalCreator','publisher','distributor','imprint','localization','other')) or ("work_type" = 'novel' and "role" in ('creator','originalCreator','publisher','distributor','imprint','localization','other'))),
	CONSTRAINT "work_organization_links_spoiler" CHECK("is_spoiler" in (0, 1)),
	CONSTRAINT "work_organization_links_work_order" CHECK("order_in_work" is null or (typeof("order_in_work") = 'integer' and "order_in_work" between 0 and 9007199254740991)),
	CONSTRAINT "work_organization_links_organization_order" CHECK("order_in_organization" is null or (typeof("order_in_organization") = 'integer' and "order_in_organization" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `work_person_links` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`work_type` text NOT NULL,
	`note` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`order_in_work` integer DEFAULT 0 NOT NULL,
	`person_id` text NOT NULL,
	`character_id` text,
	`role` text NOT NULL,
	`order_in_person` integer DEFAULT 0 NOT NULL,
	`order_in_character` integer,
	CONSTRAINT `fk_work_person_links_person_id_persons_entry_id_fk` FOREIGN KEY (`person_id`) REFERENCES `persons`(`entry_id`) ON DELETE CASCADE,
	CONSTRAINT `fk_work_person_links_work_id_work_type_entries_id_type_fk` FOREIGN KEY (`work_id`,`work_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT `fk_work_person_links_work_id_character_id_work_character_links_work_id_character_id_fk` FOREIGN KEY (`work_id`,`character_id`) REFERENCES `work_character_links`(`work_id`,`character_id`) ON DELETE CASCADE,
	CONSTRAINT "work_person_links_role" CHECK(("work_type" = 'game' and "role" in ('creator','characterCreator','originalCreator','director','scenario','direction','storyboard','characterDesign','illustration','drawing','animationDirector','art','photography','sound','music','programmer','producer','publisher','translator','editor','voiceActor','other') and ("character_id" is null or "role" in ('characterCreator','characterDesign','illustration','drawing','voiceActor','other'))) or ("work_type" = 'anime' and "role" in ('creator','characterCreator','originalCreator','director','scenario','seriesComposition','direction','storyboard','characterDesign','illustration','drawing','animationDirector','art','photography','sound','music','producer','publisher','translator','editor','voiceActor','other') and ("character_id" is null or "role" in ('characterCreator','characterDesign','illustration','drawing','voiceActor','other'))) or ("work_type" = 'comic' and "role" in ('creator','characterCreator','originalCreator','scenario','storyboard','characterDesign','illustration','drawing','art','publisher','translator','editor','other') and ("character_id" is null or "role" in ('characterCreator','characterDesign','illustration','drawing','other'))) or ("work_type" = 'novel' and "role" in ('creator','characterCreator','originalCreator','characterDesign','illustration','art','publisher','translator','editor','other') and ("character_id" is null or "role" in ('characterCreator','characterDesign','illustration','other')))),
	CONSTRAINT "work_person_links_character_order_present" CHECK(("character_id" is null) = ("order_in_character" is null)),
	CONSTRAINT "work_person_links_spoiler" CHECK("is_spoiler" in (0, 1)),
	CONSTRAINT "work_person_links_work_order" CHECK("order_in_work" is null or (typeof("order_in_work") = 'integer' and "order_in_work" between 0 and 9007199254740991)),
	CONSTRAINT "work_person_links_person_order" CHECK("order_in_person" is null or (typeof("order_in_person") = 'integer' and "order_in_person" between 0 and 9007199254740991)),
	CONSTRAINT "work_person_links_character_order" CHECK("order_in_character" is null or (typeof("order_in_character") = 'integer' and "order_in_character" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE `work_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`from_type` text NOT NULL,
	`to_id` text NOT NULL,
	`to_type` text NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`order_in_from` integer DEFAULT 0 NOT NULL,
	`order_in_to` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_work_relations_from_id_from_type_entries_id_type_fk` FOREIGN KEY (`from_id`,`from_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT `fk_work_relations_to_id_to_type_entries_id_type_fk` FOREIGN KEY (`to_id`,`to_type`) REFERENCES `entries`(`id`,`type`) ON DELETE CASCADE,
	CONSTRAINT `work_relations_identity` UNIQUE(`from_id`,`to_id`,`type`),
	CONSTRAINT "work_relations_from_type" CHECK("from_type" in ('game', 'anime', 'comic', 'novel')),
	CONSTRAINT "work_relations_to_type" CHECK("to_type" in ('game', 'anime', 'comic', 'novel')),
	CONSTRAINT "work_relations_type" CHECK("type" in ('sequel', 'sideStory', 'spinOff', 'summary', 'adaptation', 'remake', 'remaster', 'port', 'expansion', 'compilation', 'alternativeVersion', 'related')),
	CONSTRAINT "work_relations_distinct" CHECK("from_id" <> "to_id"),
	CONSTRAINT "work_relations_symmetric_order" CHECK("type" not in ('alternativeVersion', 'related') or "from_id" < "to_id" collate binary),
	CONSTRAINT "work_relations_same_medium" CHECK("type" not in ('remake', 'remaster') or "from_type" = "to_type"),
	CONSTRAINT "work_relations_game_only" CHECK("type" not in ('port', 'expansion') or ("from_type" = 'game' and "to_type" = 'game')),
	CONSTRAINT "work_relations_from_order" CHECK("order_in_from" is null or (typeof("order_in_from") = 'integer' and "order_in_from" between 0 and 9007199254740991)),
	CONSTRAINT "work_relations_to_order" CHECK("order_in_to" is null or (typeof("order_in_to") = 'integer' and "order_in_to" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `anime_annotation_content_attachments_attachment` ON `anime_annotation_content_attachments` (`attachment_id`,`annotation_id`);--> statement-breakpoint
CREATE INDEX `anime_annotations_created` ON `anime_annotations` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `anime_annotations_work_created` ON `anime_annotations` (`anime_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `anime_annotations_image` ON `anime_annotations` (`image_id`);--> statement-breakpoint
CREATE INDEX `anime_annotations_file` ON `anime_annotations` (`file_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `anime_directories_profile` ON `anime_directories` (`recognition_profile_id`);--> statement-breakpoint
CREATE INDEX `anime_episode_description_attachments_attachment` ON `anime_episode_description_attachments` (`attachment_id`,`episode_id`);--> statement-breakpoint
CREATE INDEX `anime_episode_external_identities_owner` ON `anime_episode_external_identities` (`episode_id`);--> statement-breakpoint
CREATE INDEX `anime_episodes_owner_order` ON `anime_episodes` (`anime_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `anime_episodes_primary_image` ON `anime_episodes` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `anime_extra_description_attachments_attachment` ON `anime_extra_description_attachments` (`attachment_id`,`extra_id`);--> statement-breakpoint
CREATE INDEX `anime_extra_external_identities_owner` ON `anime_extra_external_identities` (`extra_id`);--> statement-breakpoint
CREATE INDEX `anime_extras_owner_order` ON `anime_extras` (`anime_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `anime_extras_primary_image` ON `anime_extras` (`primary_image_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_file_episodes_preferred` ON `anime_file_episodes` (`episode_id`) WHERE "anime_file_episodes"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `anime_file_episodes_part` ON `anime_file_episodes` (`episode_id`,`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_file_extras_preferred` ON `anime_file_extras` (`extra_id`) WHERE "anime_file_extras"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `anime_file_extras_part` ON `anime_file_extras` (`extra_id`,`file_id`);--> statement-breakpoint
CREATE INDEX `anime_file_recognition_profiles_ordered` ON `anime_file_recognition_profiles` (`sort_order`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `anime_files_preferred` ON `anime_files` (`anime_id`) WHERE "anime_files"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `anime_records_status_order` ON `anime_records` (`status`,`anime_id`);--> statement-breakpoint
CREATE INDEX `anime_watch_activity_work_time` ON `anime_watch_activity` (`anime_id`,"started_at" desc,`id`,`duration_ms`,`ended_at`);--> statement-breakpoint
CREATE INDEX `anime_watch_activity_time` ON `anime_watch_activity` (`started_at`,`ended_at`,`anime_id`);--> statement-breakpoint
CREATE INDEX `anime_watch_activity_file` ON `anime_watch_activity` (`file_id`);--> statement-breakpoint
CREATE INDEX `anime_watch_activity_episode` ON `anime_watch_activity` (`episode_id`);--> statement-breakpoint
CREATE INDEX `anime_watch_activity_extra` ON `anime_watch_activity` (`extra_id`);--> statement-breakpoint
CREATE INDEX `animes_backdrop` ON `animes` (`backdrop_image_id`);--> statement-breakpoint
CREATE INDEX `animes_title_logo` ON `animes` (`title_logo_id`);--> statement-breakpoint
CREATE INDEX `collection_description_attachments_attachment` ON `collection_description_attachments` (`attachment_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `collection_members_ordered` ON `collection_members` (`collection_id`,`order_in_collection`,`entry_id`);--> statement-breakpoint
CREATE INDEX `collection_members_entry` ON `collection_members` (`entry_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `collections_ordered` ON `collections` (`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `collections_primary_image` ON `collections` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `comic_annotation_content_attachments_attachment` ON `comic_annotation_content_attachments` (`attachment_id`,`annotation_id`);--> statement-breakpoint
CREATE INDEX `comic_annotations_created` ON `comic_annotations` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `comic_annotations_work_created` ON `comic_annotations` (`comic_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `comic_annotations_image` ON `comic_annotations` (`image_id`);--> statement-breakpoint
CREATE INDEX `comic_annotations_file` ON `comic_annotations` (`file_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `comic_chapter_description_attachments_attachment` ON `comic_chapter_description_attachments` (`attachment_id`,`chapter_id`);--> statement-breakpoint
CREATE INDEX `comic_chapter_external_identities_owner` ON `comic_chapter_external_identities` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `comic_chapters_owner_order` ON `comic_chapters` (`comic_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `comic_chapters_primary_image` ON `comic_chapters` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `comic_directories_profile` ON `comic_directories` (`recognition_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_file_chapters_preferred` ON `comic_file_chapters` (`chapter_id`) WHERE "comic_file_chapters"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `comic_file_chapters_part` ON `comic_file_chapters` (`chapter_id`,`file_id`);--> statement-breakpoint
CREATE INDEX `comic_file_recognition_profiles_ordered` ON `comic_file_recognition_profiles` (`sort_order`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_file_volumes_preferred` ON `comic_file_volumes` (`volume_id`) WHERE "comic_file_volumes"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `comic_file_volumes_part` ON `comic_file_volumes` (`volume_id`,`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_files_preferred` ON `comic_files` (`comic_id`) WHERE "comic_files"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `comic_reading_activity_work_time` ON `comic_reading_activity` (`comic_id`,"started_at" desc,`id`,`duration_ms`,`ended_at`);--> statement-breakpoint
CREATE INDEX `comic_reading_activity_time` ON `comic_reading_activity` (`started_at`,`ended_at`,`comic_id`);--> statement-breakpoint
CREATE INDEX `comic_reading_activity_file` ON `comic_reading_activity` (`file_id`);--> statement-breakpoint
CREATE INDEX `comic_reading_activity_volume` ON `comic_reading_activity` (`volume_id`);--> statement-breakpoint
CREATE INDEX `comic_reading_activity_chapter` ON `comic_reading_activity` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `comic_records_status_order` ON `comic_records` (`status`,`comic_id`);--> statement-breakpoint
CREATE INDEX `comic_volume_chapters_ordered` ON `comic_volume_chapters` (`volume_id`,`sort_order`,`chapter_id`);--> statement-breakpoint
CREATE INDEX `comic_volume_chapters_reverse` ON `comic_volume_chapters` (`chapter_id`,`volume_id`);--> statement-breakpoint
CREATE INDEX `comic_volume_description_attachments_attachment` ON `comic_volume_description_attachments` (`attachment_id`,`volume_id`);--> statement-breakpoint
CREATE INDEX `comic_volume_external_identities_owner` ON `comic_volume_external_identities` (`volume_id`);--> statement-breakpoint
CREATE INDEX `comic_volumes_owner_order` ON `comic_volumes` (`comic_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `comic_volumes_primary_image` ON `comic_volumes` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `comics_backdrop` ON `comics` (`backdrop_image_id`);--> statement-breakpoint
CREATE INDEX `comics_title_logo` ON `comics` (`title_logo_id`);--> statement-breakpoint
CREATE INDEX `entries_type_sort` ON `entries` (`type`,`sort_name_key`,`id`);--> statement-breakpoint
CREATE INDEX `entries_sort` ON `entries` (`sort_name_key`,`id`);--> statement-breakpoint
CREATE INDEX `entries_name` ON `entries` (`name_key`,`id`);--> statement-breakpoint
CREATE INDEX `entries_original_name` ON `entries` (`original_name_key`,`id`);--> statement-breakpoint
CREATE INDEX `entries_created_order` ON `entries` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `entries_primary_image` ON `entries` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `entry_description_attachments_attachment` ON `entry_description_attachments` (`attachment_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `entry_evaluations_rated` ON `entry_evaluations` (`rating`,`entry_id`);--> statement-breakpoint
CREATE INDEX `entry_evaluations_favorites` ON `entry_evaluations` (`favorite`,`entry_id`);--> statement-breakpoint
CREATE INDEX `entry_external_identities_owner` ON `entry_external_identities` (`entry_id`);--> statement-breakpoint
CREATE INDEX `entry_tags_entry` ON `entry_tags` (`entry_id`,`order_in_entry`,`tag_id`);--> statement-breakpoint
CREATE INDEX `entry_tags_tag` ON `entry_tags` (`tag_id`,`order_in_tag`,`entry_id`);--> statement-breakpoint
CREATE INDEX `font_attachments_attachment` ON `font_attachments` (`attachment_id`,`font_id`);--> statement-breakpoint
CREATE INDEX `game_annotation_content_attachments_attachment` ON `game_annotation_content_attachments` (`attachment_id`,`annotation_id`);--> statement-breakpoint
CREATE INDEX `game_annotations_created` ON `game_annotations` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `game_annotations_work_created` ON `game_annotations` (`game_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `game_annotations_image` ON `game_annotations` (`image_id`);--> statement-breakpoint
CREATE INDEX `game_backup_recoveries_game` ON `game_backup_recoveries` (`game_id`,`resolution`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `game_backup_recoveries_resolution_order` ON `game_backup_recoveries` (`resolution`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `game_backup_recoveries_backup` ON `game_backup_recoveries` (`backup_id`);--> statement-breakpoint
CREATE INDEX `game_backup_recoveries_protection` ON `game_backup_recoveries` (`protection_backup_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_launch_configs_preferred` ON `game_launch_configs` (`game_id`) WHERE "game_launch_configs"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `game_launch_configs_ordered` ON `game_launch_configs` (`game_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `game_play_activity_work_time` ON `game_play_activity` (`game_id`,"started_at" desc,`id`,`duration_ms`,`ended_at`);--> statement-breakpoint
CREATE INDEX `game_play_activity_time` ON `game_play_activity` (`started_at`,`ended_at`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_play_activity_config` ON `game_play_activity` (`launch_config_id`);--> statement-breakpoint
CREATE INDEX `game_records_status_order` ON `game_records` (`status`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_save_backups_game` ON `game_save_backups` (`game_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `game_save_backups_source` ON `game_save_backups` (`source_config_id`,`source_path`,`is_locked`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `game_save_backups_attachment` ON `game_save_backups` (`archive_attachment_id`);--> statement-breakpoint
CREATE INDEX `games_backdrop` ON `games` (`backdrop_image_id`);--> statement-breakpoint
CREATE INDEX `games_title_logo` ON `games` (`title_logo_id`);--> statement-breakpoint
CREATE INDEX `games_icon` ON `games` (`icon_image_id`);--> statement-breakpoint
CREATE INDEX `installed_extensions_repository` ON `installed_extensions` (`update_repository_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `metadata_profiles_default` ON `metadata_profiles` (`entry_type`) WHERE "metadata_profiles"."is_default" = 1;--> statement-breakpoint
CREATE INDEX `metadata_profiles_ordered` ON `metadata_profiles` (`entry_type`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `note_content_attachments_attachment` ON `note_content_attachments` (`attachment_id`,`note_id`);--> statement-breakpoint
CREATE INDEX `note_entry_links_note` ON `note_entry_links` (`note_id`,`order_in_note`,`entry_id`);--> statement-breakpoint
CREATE INDEX `note_entry_links_entry` ON `note_entry_links` (`entry_id`,`order_in_entry`,`note_id`);--> statement-breakpoint
CREATE INDEX `notes_updated` ON `notes` ("updated_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `notes_primary_image` ON `notes` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `novel_annotation_content_attachments_attachment` ON `novel_annotation_content_attachments` (`attachment_id`,`annotation_id`);--> statement-breakpoint
CREATE INDEX `novel_annotations_created` ON `novel_annotations` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `novel_annotations_work_created` ON `novel_annotations` (`novel_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `novel_annotations_image` ON `novel_annotations` (`image_id`);--> statement-breakpoint
CREATE INDEX `novel_annotations_file` ON `novel_annotations` (`file_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `novel_directories_profile` ON `novel_directories` (`recognition_profile_id`);--> statement-breakpoint
CREATE INDEX `novel_file_recognition_profiles_ordered` ON `novel_file_recognition_profiles` (`sort_order`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_file_volumes_preferred` ON `novel_file_volumes` (`volume_id`) WHERE "novel_file_volumes"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `novel_file_volumes_part` ON `novel_file_volumes` (`volume_id`,`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `novel_files_preferred` ON `novel_files` (`novel_id`) WHERE "novel_files"."is_preferred" = 1;--> statement-breakpoint
CREATE INDEX `novel_reading_activity_work_time` ON `novel_reading_activity` (`novel_id`,"started_at" desc,`id`,`duration_ms`,`ended_at`);--> statement-breakpoint
CREATE INDEX `novel_reading_activity_time` ON `novel_reading_activity` (`started_at`,`ended_at`,`novel_id`);--> statement-breakpoint
CREATE INDEX `novel_reading_activity_file` ON `novel_reading_activity` (`file_id`);--> statement-breakpoint
CREATE INDEX `novel_reading_activity_volume` ON `novel_reading_activity` (`volume_id`);--> statement-breakpoint
CREATE INDEX `novel_records_status_order` ON `novel_records` (`status`,`novel_id`);--> statement-breakpoint
CREATE INDEX `novel_volume_description_attachments_attachment` ON `novel_volume_description_attachments` (`attachment_id`,`volume_id`);--> statement-breakpoint
CREATE INDEX `novel_volume_external_identities_owner` ON `novel_volume_external_identities` (`volume_id`);--> statement-breakpoint
CREATE INDEX `novel_volumes_owner_order` ON `novel_volumes` (`novel_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `novel_volumes_primary_image` ON `novel_volumes` (`primary_image_id`);--> statement-breakpoint
CREATE INDEX `novels_backdrop` ON `novels` (`backdrop_image_id`);--> statement-breakpoint
CREATE INDEX `novels_title_logo` ON `novels` (`title_logo_id`);--> statement-breakpoint
CREATE INDEX `scan_configs_ordered` ON `scan_configs` (`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `scan_configs_profile` ON `scan_configs` (`metadata_profile_id`);--> statement-breakpoint
CREATE INDEX `scan_runs_config_created` ON `scan_runs` (`scan_config_id`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `scan_runs_status_created` ON `scan_runs` (`status`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `scan_runs_created` ON `scan_runs` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `showcase_sections_ordered` ON `showcase_sections` (`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `tag_description_attachments_attachment` ON `tag_description_attachments` (`attachment_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `tags_name_order` ON `tags` (`name_order_key`,`id`);--> statement-breakpoint
CREATE INDEX `task_runs_status_created` ON `task_runs` (`status`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `task_runs_created` ON `task_runs` ("created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `task_runs_type_created` ON `task_runs` (`type`,"created_at" desc,`id`);--> statement-breakpoint
CREATE INDEX `work_character_links_work` ON `work_character_links` (`work_id`,`order_in_work`,`id`);--> statement-breakpoint
CREATE INDEX `work_character_links_character` ON `work_character_links` (`character_id`,`order_in_character`,`id`);--> statement-breakpoint
CREATE INDEX `work_completion_records_work_created` ON `work_completion_records` (`work_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `work_completion_records_date` ON `work_completion_records` (json_extract("completed_date", '$.year'),json_extract("completed_date", '$.month'),json_extract("completed_date", '$.day'),`work_id`);--> statement-breakpoint
CREATE INDEX `work_completion_records_work_date` ON `work_completion_records` (`work_id`,json_extract("completed_date", '$.year') desc,json_extract("completed_date", '$.month') desc,json_extract("completed_date", '$.day') desc,`id`);--> statement-breakpoint
CREATE INDEX `work_organization_links_work` ON `work_organization_links` (`work_id`,`order_in_work`,`id`);--> statement-breakpoint
CREATE INDEX `work_organization_links_organization` ON `work_organization_links` (`organization_id`,`role`,`work_id`);--> statement-breakpoint
CREATE INDEX `work_organization_links_organization_ordered` ON `work_organization_links` (`organization_id`,`order_in_organization`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_person_links_general_identity` ON `work_person_links` (`work_id`,`person_id`,`role`) WHERE "work_person_links"."character_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `work_person_links_character_identity` ON `work_person_links` (`work_id`,`person_id`,`role`,`character_id`) WHERE "work_person_links"."character_id" is not null;--> statement-breakpoint
CREATE INDEX `work_person_links_work` ON `work_person_links` (`work_id`,`order_in_work`,`id`);--> statement-breakpoint
CREATE INDEX `work_person_links_person` ON `work_person_links` (`person_id`,`role`,`work_id`);--> statement-breakpoint
CREATE INDEX `work_person_links_person_ordered` ON `work_person_links` (`person_id`,`order_in_person`,`id`);--> statement-breakpoint
CREATE INDEX `work_person_links_character` ON `work_person_links` (`character_id`,`order_in_character`,`id`);--> statement-breakpoint
CREATE INDEX `work_relations_from` ON `work_relations` (`from_id`,`order_in_from`,`id`);--> statement-breakpoint
CREATE INDEX `work_relations_to` ON `work_relations` (`to_id`,`order_in_to`,`id`);
--> statement-breakpoint
PRAGMA application_id = 0x4b534b33;
--> statement-breakpoint
INSERT INTO onboarding_state (id, state) VALUES (1, '{"firstPresentedAt":null,"firstCompletedAt":null,"lastPresentedVersion":null,"handled":{}}');
