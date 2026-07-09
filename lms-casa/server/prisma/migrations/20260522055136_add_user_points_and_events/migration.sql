-- CreateTable
CREATE TABLE `user_points` (
    `user_id` BIGINT NOT NULL,
    `total_xp` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_points_total_xp_idx`(`total_xp`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` ENUM('LESSON_COMPLETED', 'COURSE_COMPLETED', 'EXAM_PASSED', 'EXAM_PERFECT_SCORE', 'ADJUSTMENT') NOT NULL,
    `amount` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(120) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `point_events_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `point_events_created_at_idx`(`created_at`),
    UNIQUE INDEX `point_events_user_id_type_idempotency_key_key`(`user_id`, `type`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_points` ADD CONSTRAINT `user_points_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_events` ADD CONSTRAINT `point_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
