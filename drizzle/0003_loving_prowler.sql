CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailNotifications` int NOT NULL DEFAULT 1,
	`pushNotifications` int NOT NULL DEFAULT 1,
	`soundEnabled` int NOT NULL DEFAULT 1,
	`dnsTestAlerts` int NOT NULL DEFAULT 1,
	`proxyStatusAlerts` int NOT NULL DEFAULT 1,
	`benchmarkAlerts` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('DNS_TEST_COMPLETE','DNS_TEST_FAILED','PROXY_STATUS_CHANGED','PROXY_ERROR','BENCHMARK_COMPLETE','ALERT','INFO') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`isRead` int NOT NULL DEFAULT 0,
	`isDismissed` int NOT NULL DEFAULT 0,
	`actionUrl` varchar(512),
	`actionLabel` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
