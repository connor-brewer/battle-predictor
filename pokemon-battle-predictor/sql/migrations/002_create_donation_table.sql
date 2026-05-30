-- Creates a donation table to store user donations for the PokemonDB project
-- Each donation is linked to a user and includes the amount donated and the date of the donation.

USE `PokemonDB`;

CREATE TABLE IF NOT EXISTS `Donation` (
    `DonationID` INT PRIMARY KEY AUTO_INCREMENT,
    `UserID` INT,
    `Amount` INT NOT NULL,
    `DonationDate` DATETIME NOT NULL,
    FOREIGN KEY (UserID) REFERENCES UserInfo(UserID)
);