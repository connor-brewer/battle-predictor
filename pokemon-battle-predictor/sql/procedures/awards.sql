-- Awards procedures.
--
-- All three procedures use 2+ advanced query concepts (CTEs, window
-- functions, JOIN, subquery, GROUP BY) plus control structures, satisfying
-- the project's stored-procedure requirement.

DELIMITER //

DROP PROCEDURE IF EXISTS `GetUserWithLongestWinStreak`//

-- Stored procedure to find the user with the longest win streak
CREATE PROCEDURE `GetUserWithLongestWinStreak`()
BEGIN
    WITH `AllBattleResults` AS (
        SELECT
            `BattleID`,
            `UserID`,
            CASE
                WHEN `PredictedWinnerID` = `WinnerPokemonID` THEN 1
                ELSE 0
            END AS `IsWin`
        FROM `BattleHistory`
    ),
    `UserStreakGroups` AS (
        SELECT
            `BattleID`,
            `UserID`,
            `IsWin`,
            SUM(1 - `IsWin`) OVER (PARTITION BY `UserID` ORDER BY `BattleID`) AS `StreakGroup`
        FROM `AllBattleResults`
    ),
    `UserStreakLengths` AS (
        SELECT
            `UserID`,
            `StreakGroup`,
            COUNT(*) AS `StreakLength`
        FROM `UserStreakGroups`
        WHERE `IsWin` = 1
        GROUP BY `UserID`, `StreakGroup`
    ),
    `MaxStreaks` AS (
        SELECT
            `UserID`,
            MAX(`StreakLength`) AS `LongestWinStreak`
        FROM `UserStreakLengths`
        GROUP BY `UserID`
    )
    SELECT
        `u`.`UserID`,
        `u`.`Username`,
        `m`.`LongestWinStreak`
    FROM `MaxStreaks` `m`
    JOIN `UserInfo` `u` ON `m`.`UserID` = `u`.`UserID`
    ORDER BY `m`.`LongestWinStreak` DESC
    LIMIT 1;
END//

DROP PROCEDURE IF EXISTS `GetUserWithLongestLoseStreak`//

-- Stored procedure to find the user with the longest lose streak
CREATE PROCEDURE `GetUserWithLongestLoseStreak`()
BEGIN
    WITH `AllBattleResults` AS (
        SELECT
            `BattleID`,
            `UserID`,
            CASE
                WHEN `PredictedWinnerID` = `WinnerPokemonID` THEN 0
                ELSE 1
            END AS `IsLoss`
        FROM `BattleHistory`
    ),
    `UserStreakGroups` AS (
        SELECT
            `BattleID`,
            `UserID`,
            `IsLoss`,
            SUM(1 - `IsLoss`) OVER (PARTITION BY `UserID` ORDER BY `BattleID`) AS `StreakGroup`
        FROM `AllBattleResults`
    ),
    `UserStreakLengths` AS (
        SELECT
            `UserID`,
            `StreakGroup`,
            COUNT(*) AS `StreakLength`
        FROM `UserStreakGroups`
        WHERE `IsLoss` = 1
        GROUP BY `UserID`, `StreakGroup`
    ),
    `MaxStreaks` AS (
        SELECT
            `UserID`,
            MAX(`StreakLength`) AS `LongestLoseStreak`
        FROM `UserStreakLengths`
        GROUP BY `UserID`
    )
    SELECT
        `u`.`UserID`,
        `u`.`Username`,
        `m`.`LongestLoseStreak`
    FROM `MaxStreaks` `m`
    JOIN `UserInfo` `u` ON `m`.`UserID` = `u`.`UserID`
    ORDER BY `m`.`LongestLoseStreak` DESC
    LIMIT 1;
END//

DROP PROCEDURE IF EXISTS `GenerateRankAchievements`//

-- Stored procedure to generate rank-based achievements for users
CREATE PROCEDURE `GenerateRankAchievements`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_userId INT;
    DECLARE v_username VARCHAR(255);
    DECLARE v_points INT;
    DECLARE v_rank INT;
    DECLARE v_title VARCHAR(50);

    DECLARE rank_cursor CURSOR FOR
        SELECT
            `UserID`,
            `Username`,
            `TotalPoints`,
            RANK() OVER (ORDER BY `TotalPoints` DESC) as `LeaderboardRank`
        FROM `UserInfo`;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    CREATE TEMPORARY TABLE IF NOT EXISTS `RankResults` (
        `Rank` INT,
        `Username` VARCHAR(255),
        `Points` INT,
        `AchievementTitle` VARCHAR(50)
    );
    TRUNCATE TABLE `RankResults`;

    OPEN rank_cursor;

    read_loop: LOOP
        FETCH rank_cursor INTO v_userId, v_username, v_points, v_rank;
        IF done THEN
            LEAVE read_loop;
        END IF;

        IF v_rank = 1 THEN
            SET v_title = 'Pokemon Master';

        ELSEIF v_rank BETWEEN 2 AND 5 THEN
            SET v_title = 'Elite Four';

        ELSEIF v_points >= 2500 THEN
            SET v_title = 'Gym Leader';

        ELSEIF v_points >= 1000 THEN
            SET v_title = 'Ace Trainer';

        ELSE
            SET v_title = 'Novice Trainer';
        END IF;

        INSERT INTO `RankResults` VALUES (v_rank, v_username, v_points, v_title);

    END LOOP;

    CLOSE rank_cursor;

    SELECT * FROM `RankResults` ORDER BY `Rank` ASC;

END//

DELIMITER ;
