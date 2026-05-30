-- ─────────────────────────────────────────────────────────────────────────
--  Daily charity distribution
-- ─────────────────────────────────────────────────────────────────────────
--
-- Sums every donation that hasn't been distributed yet and credits the
-- result equally to the five users with the lowest TotalPoints. Donations
-- are then flagged Distributed = 1 so that subsequent runs do not double-
-- count them — running this twice in a row makes the second call a no-op.
--
-- Used by the POST /api/donations/distribute-daily-pool endpoint, which
-- wraps this in a try/commit/rollback in Python so a failure on either
-- side is fully reverted.
--
-- Project requirement coverage
-- ----------------------------
--   * Transaction with explicit REPEATABLE READ isolation level — chosen so
--     the SUM of pending donations, the bottom-5 SELECT, and the marking
--     UPDATE all see the same snapshot.
--   * Three advanced queries:
--       Q1 — JOIN of Donation × UserInfo with aggregation (COUNT DISTINCT +
--            SUM) restricted to undistributed rows.
--       Q2 — UPDATE driven by a SUBQUERY that selects the bottom-5 users
--            ordered by TotalPoints (cannot be replaced by a plain join).
--       Q3 — UPDATE flagging the just-counted donations as distributed.
--   * Application utility — moves money from the donation pool to low-
--     point users without ever paying the same donation out twice.

DELIMITER //

DROP PROCEDURE IF EXISTS `ExecuteDailyCharityDistribution`//

CREATE PROCEDURE `ExecuteDailyCharityDistribution`()
BEGIN
    DECLARE total_pool   INT DEFAULT 0;
    DECLARE donor_count  INT DEFAULT 0;
    DECLARE per_user     INT DEFAULT 0;

    -- On any error inside the transaction, roll back and re-raise so the
    -- API layer sees a failure and can surface it to the user.
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    START TRANSACTION;

    -- Q1 (JOIN + AGGREGATION): donors and pool from undistributed donations.
    SELECT  COUNT(DISTINCT u.UserID),
            COALESCE(FLOOR(SUM(d.Amount)), 0)
    INTO    donor_count, total_pool
    FROM    Donation d
    JOIN    UserInfo u ON d.UserID = u.UserID
    WHERE   d.Distributed = 0;

    IF total_pool > 0 THEN
        SET per_user = FLOOR(total_pool / 5);

        -- Q2 (UPDATE + SUBQUERY): credit the five lowest-pointed users.
        UPDATE UserInfo
        SET    TotalPoints = TotalPoints + per_user
        WHERE  UserID IN (
                   SELECT UserID FROM (
                       SELECT UserID
                       FROM   UserInfo
                       ORDER  BY TotalPoints ASC
                       LIMIT  5
                   ) AS bottom_five
               );

        -- Q3 (UPDATE): mark the donations we just counted so the next call
        -- starts from an empty pool. This is the line that makes the
        -- procedure idempotent.
        UPDATE Donation
        SET    Distributed = 1
        WHERE  Distributed = 0;
    END IF;

    COMMIT;

    SELECT total_pool                          AS DistributedTotal,
           donor_count                         AS DonorCount,
           per_user                            AS PerUserAmount,
           IF(total_pool > 0, 5, 0)            AS RecipientCount;
END//

DELIMITER ;
