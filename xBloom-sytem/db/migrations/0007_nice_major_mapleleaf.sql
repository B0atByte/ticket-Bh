CREATE TABLE `issues` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`description` text NOT NULL,
	`page` varchar(500),
	`reporter_name` varchar(100),
	`reporter_role` varchar(50),
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `issues_created_at_idx` ON `issues` (`created_at`);