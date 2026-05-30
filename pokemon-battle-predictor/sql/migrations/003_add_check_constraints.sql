-- Adds CHECK constraints to existing tables. Re-running is safe — MySQL
-- errors on duplicate constraint names; that's intentional so partial
-- runs don't silently no-op.

USE `PokemonDB`;

ALTER TABLE `UserInfo`
    ADD CONSTRAINT `chk_userinfo_points_nonneg`     CHECK (`TotalPoints` >= 0),
    ADD CONSTRAINT `chk_userinfo_correct_nonneg`    CHECK (`CorrectPredictions` >= 0),
    ADD CONSTRAINT `chk_userinfo_incorrect_nonneg`  CHECK (`IncorrectPredictions` >= 0);

ALTER TABLE `BattleHistory`
    ADD CONSTRAINT `chk_battle_distinct_pokemon` CHECK (`Pokemon1ID` <> `Pokemon2ID`);

ALTER TABLE `TournamentStandings`
    ADD CONSTRAINT `chk_tournament_appearances_nonneg` CHECK (`Appearances` >= 0);

ALTER TABLE `Donation`
    ADD CONSTRAINT `chk_donation_amount_positive` CHECK (`Amount` > 0);
