CREATE TABLE `dnsTestResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`domain` varchar(255) NOT NULL,
	`googleDns` int,
	`cloudflareDns` int,
	`openDns` int,
	`quad9Dns` int,
	`adguardDns` int,
	`status` enum('success','error') NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dnsTestResults_id` PRIMARY KEY(`id`)
);
