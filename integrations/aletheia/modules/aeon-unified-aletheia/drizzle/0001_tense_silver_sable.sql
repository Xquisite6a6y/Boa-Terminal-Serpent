CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`model` varchar(64),
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) DEFAULT 'New Conversation',
	`model` varchar(64) NOT NULL DEFAULT 'ionos',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quarantine_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userMessage` text NOT NULL,
	`attemptedModel` varchar(64) NOT NULL,
	`errorMessage` text,
	`responseContent` text,
	`reason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quarantine_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_sessionId_chat_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `chat_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_sessions` ADD CONSTRAINT `chat_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quarantine_log` ADD CONSTRAINT `quarantine_log_sessionId_chat_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `chat_sessions`(`id`) ON DELETE no action ON UPDATE no action;