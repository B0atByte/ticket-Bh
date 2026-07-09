-- CreateTable
CREATE TABLE `practical_evaluation_criteria` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `course_id` BIGINT NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `practical_evaluation_criteria_course_id_order_index_idx`(`course_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practical_evaluations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `enrollment_id` BIGINT NOT NULL,
    `result` ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `star_rating` INTEGER NULL,
    `comment` TEXT NULL,
    `evaluated_by_id` BIGINT NULL,
    `evaluated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `practical_evaluations_enrollment_id_key`(`enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practical_evaluation_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `evaluation_id` BIGINT NOT NULL,
    `criterion_id` BIGINT NOT NULL,
    `checked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `practical_evaluation_items_evaluation_id_criterion_id_key`(`evaluation_id`, `criterion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practical_evaluation_criteria` ADD CONSTRAINT `practical_evaluation_criteria_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practical_evaluations` ADD CONSTRAINT `practical_evaluations_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practical_evaluation_items` ADD CONSTRAINT `practical_evaluation_items_evaluation_id_fkey` FOREIGN KEY (`evaluation_id`) REFERENCES `practical_evaluations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practical_evaluation_items` ADD CONSTRAINT `practical_evaluation_items_criterion_id_fkey` FOREIGN KEY (`criterion_id`) REFERENCES `practical_evaluation_criteria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
