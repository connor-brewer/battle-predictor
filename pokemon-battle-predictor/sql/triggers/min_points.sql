-- Floors UserInfo.TotalPoints at 10 — no matter how badly someone busts a
-- wager they always retain enough points to keep playing.
--
-- Project requirement coverage
-- ----------------------------
--   * Event:     BEFORE UPDATE on UserInfo
--   * Condition: IF NEW.TotalPoints < 10
--   * Action:    SET NEW.TotalPoints = 10  (modifies the in-flight UPDATE)

DELIMITER //

DROP TRIGGER IF EXISTS `Before_UserInfo_Update_Points`//

CREATE TRIGGER `Before_UserInfo_Update_Points`
BEFORE UPDATE ON `UserInfo`
FOR EACH ROW
BEGIN
    IF NEW.`TotalPoints` < 10 THEN
        SET NEW.`TotalPoints` = 10;
    END IF;
END//

DELIMITER ;
