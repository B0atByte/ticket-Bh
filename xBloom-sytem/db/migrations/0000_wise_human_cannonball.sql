CREATE TABLE `activity_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
	`user_name` varchar(100),
	`user_role` varchar(50),
	`action` varchar(100),
	`target` varchar(191),
	`detail` text,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`serial` varchar(100) NOT NULL,
	`new_serial` varchar(100),
	`product` varchar(191),
	`customer_name` varchar(191),
	`status` varchar(50),
	`notes` text,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`source` varchar(100),
	`global_status` varchar(50),
	`asset_type` enum('store','claim_fixed','subscription'),
	`subscription_source` varchar(191),
	`warranty_start` date,
	`warranty_end` date,
	`location` varchar(191),
	`no_warranty` tinyint NOT NULL DEFAULT 0,
	CONSTRAINT `machines_id` PRIMARY KEY(`id`),
	CONSTRAINT `machines_serial_unique` UNIQUE(`serial`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`ticket_id` varchar(50) NOT NULL,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`serial` varchar(100) NOT NULL,
	`name` varchar(191),
	`phone` varchar(30),
	`email` varchar(191),
	`line_id` varchar(100),
	`issue_type` varchar(100),
	`description` text,
	`log_url` varchar(512),
	`video_filename` varchar(255),
	`video_url` varchar(512),
	`repair_type` enum('warranty','standard','repair_claim'),
	`status` varchar(50),
	`assigned_to` varchar(100),
	`staff_note` text,
	`tech_note` text,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`approved_by` varchar(100),
	`tracking_link` varchar(512),
	`warranty_case` tinyint NOT NULL DEFAULT 0,
	`global_claim_status` varchar(50),
	`gc_old_machine` varchar(100),
	`gc_new_machine` varchar(100),
	`gc_lot` varchar(100),
	`global_claim_note` text,
	`video_proof` varchar(512),
	CONSTRAINT `tickets_ticket_id` PRIMARY KEY(`ticket_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`name` varchar(100) NOT NULL,
	`pin` varchar(20) NOT NULL,
	`role` enum('admin','staff','tech','customer') NOT NULL,
	CONSTRAINT `users_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` char(36) NOT NULL,
	`registered_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`serial` varchar(100) NOT NULL,
	`product` varchar(191),
	`company` varchar(191),
	`purchase_date` date,
	`expiry_date` date,
	`name` varchar(191),
	`phone` varchar(30),
	`email` varchar(191),
	`postal` varchar(10),
	`house_no` varchar(100),
	`building` varchar(191),
	`subdistrict` varchar(191),
	`district` varchar(191),
	`province` varchar(191),
	`address` text,
	`receipt_name` varchar(191),
	`status` varchar(50),
	`receipt_drive_url` varchar(512),
	`type` enum('normal','replacement') NOT NULL DEFAULT 'normal',
	`replacement_of` varchar(100),
	CONSTRAINT `warranties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_serial_machines_serial_fk` FOREIGN KEY (`serial`) REFERENCES `machines`(`serial`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_to_users_name_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`name`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warranties` ADD CONSTRAINT `warranties_serial_machines_serial_fk` FOREIGN KEY (`serial`) REFERENCES `machines`(`serial`) ON DELETE no action ON UPDATE no action;