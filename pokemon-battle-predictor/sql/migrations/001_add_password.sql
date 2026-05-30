-- Run this against an existing PokemonDB to add the Password column and
-- unique-username constraint that the auth flow requires.
--
-- Safe to re-run: ALTER TABLE on a column that already exists will error;
-- wrap in IF NOT EXISTS checks in your migration tool of choice.

USE `PokemonDB`;

ALTER TABLE `UserInfo`
    ADD COLUMN `Password` VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE `UserInfo`
    ADD UNIQUE KEY `uq_username` (`Username`);
