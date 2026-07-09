CREATE TABLE `interactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`serial` varchar(100) NOT NULL,
	`staff_name` varchar(100),
	`channel` enum('line','phone','store','other') NOT NULL DEFAULT 'phone',
	`topic` text,
	`status` enum('ok','wait','open') NOT NULL DEFAULT 'wait',
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_serial_machines_serial_fk` FOREIGN KEY (`serial`) REFERENCES `machines`(`serial`) ON DELETE no action ON UPDATE no action;