-- Adds the Distributed flag to existing Donation rows. Once
-- ExecuteDailyCharityDistribution credits a donation it sets this to 1
-- so subsequent runs skip the row.
--
-- Existing rows default to 0 (undistributed). If you've already done
-- distributions before this migration ran and don't want those donations
-- counted again, follow up with:
--     UPDATE Donation SET Distributed = 1 WHERE DonationDate < CURDATE();

USE `PokemonDB`;

ALTER TABLE `Donation`
    ADD COLUMN `Distributed` TINYINT(1) NOT NULL DEFAULT 0;
