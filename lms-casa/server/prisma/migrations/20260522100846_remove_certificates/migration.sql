-- DropForeignKey
ALTER TABLE `certificates` DROP FOREIGN KEY `certificates_template_id_fkey`;

-- DropForeignKey
ALTER TABLE `certificates` DROP FOREIGN KEY `certificates_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `certificate_templates` DROP FOREIGN KEY `certificate_templates_course_id_fkey`;

-- DropTable
DROP TABLE `certificates`;

-- DropTable
DROP TABLE `certificate_templates`;
