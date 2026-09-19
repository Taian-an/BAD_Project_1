-- Drop the ADMIN role: STAFF now covers everything ADMIN used to (user
-- management, peer API key issuance). Safe to run even if some row still
-- has role = 'ADMIN' — those rows are demoted to STAFF first so the enum
-- change itself can never fail on data it doesn't expect.
UPDATE `User` SET `role` = 'STAFF' WHERE `role` = 'ADMIN';

ALTER TABLE `User` MODIFY COLUMN `role` ENUM('STUDENT', 'STAFF') NOT NULL DEFAULT 'STUDENT';
