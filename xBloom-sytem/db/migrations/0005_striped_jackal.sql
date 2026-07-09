CREATE TABLE `shopee_orders` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`order_no` varchar(100) NOT NULL,
	`order_date` varchar(100),
	`buyer_name` varchar(191),
	`tracking_no` varchar(100),
	`courier` varchar(100),
	`product_name` text,
	`qty` int,
	`sale_price` decimal(12,2),
	`net_income` decimal(12,2),
	`address` text,
	`screenshot_url` varchar(512),
	`sheet_url` varchar(512),
	`page_url` varchar(512),
	`raw_json` text,
	`saved_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `shopee_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `shopee_orders_order_no_unique` UNIQUE(`order_no`)
);
--> statement-breakpoint
CREATE INDEX `shopee_order_date_idx` ON `shopee_orders` (`order_date`);--> statement-breakpoint
CREATE INDEX `shopee_saved_at_idx` ON `shopee_orders` (`saved_at`);--> statement-breakpoint
CREATE INDEX `shopee_tracking_idx` ON `shopee_orders` (`tracking_no`);