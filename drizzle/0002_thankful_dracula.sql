CREATE TABLE `dnsProxyConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 0,
	`fastestProvider` varchar(255),
	`proxyIp` varchar(45),
	`proxyPort` int NOT NULL DEFAULT 53,
	`cacheTtl` int NOT NULL DEFAULT 3600,
	`lastBenchmark` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dnsProxyConfig_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dnsProxyStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalQueries` int NOT NULL DEFAULT 0,
	`cachedQueries` int NOT NULL DEFAULT 0,
	`failedQueries` int NOT NULL DEFAULT 0,
	`averageResolutionTime` int NOT NULL DEFAULT 0,
	`mostUsedProvider` varchar(255),
	`date` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dnsProxyStats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dnsQueryLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`domain` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`resolutionTime` int,
	`ipAddress` varchar(45),
	`status` enum('success','error','cached') NOT NULL,
	`cachedResult` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dnsQueryLog_id` PRIMARY KEY(`id`)
);
