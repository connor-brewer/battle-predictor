CREATE DATABASE IF NOT EXISTS `PokemonDB`;

USE `PokemonDB`;

CREATE TABLE IF NOT EXISTS `Pokemon` (
    `PokemonID` INT  PRIMARY KEY,
    `PokemonName` VARCHAR(255) NOT NULL,
    `height` INT NOT NULL,
    `weight` INT NOT NULL,
    `attack` INT NOT NULL,
    `defense` INT NOT NULL,
    `hp` INT NOT NULL,
    `special_attack` INT NOT NULL,
    `special_defense` INT NOT NULL,
    `speed` INT NOT NULL
);


CREATE TABLE IF NOT EXISTS `Type` (
    `TypeID` INT PRIMARY KEY,
    `TypeName` VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS `PokemonType` (
    `PokemonID` INT,
    `TypeID` INT,
    PRIMARY KEY (PokemonID, TypeID),
    FOREIGN KEY (PokemonID) REFERENCES Pokemon(PokemonID),
    FOREIGN KEY (TypeID) REFERENCES Type(TypeID)
);

CREATE TABLE IF NOT EXISTS `Move` (
    `MoveID` INT PRIMARY KEY,
    `MoveName` VARCHAR(255) NOT NULL,
    `TypeID` INT,
    `Power` FLOAT,
    `Accuracy` FLOAT,
    FOREIGN KEY (TypeID) REFERENCES Type(TypeID)
);

CREATE TABLE IF NOT EXISTS `LearnSet` (
    `PokemonID` INT,
    `MoveID` INT,
    PRIMARY KEY (PokemonID, MoveID),
    FOREIGN KEY (PokemonID) REFERENCES Pokemon(PokemonID),
    FOREIGN KEY (MoveID) REFERENCES Move(MoveID)
);

CREATE TABLE IF NOT EXISTS `TypeEffectiveness` (
    `AttackingTypeID` INT,
    `DefendingTypeID` INT,
    `Multiplier` FLOAT NOT NULL,
    PRIMARY KEY (AttackingTypeID, DefendingTypeID),
    FOREIGN KEY (AttackingTypeID) REFERENCES Type(TypeID),
    FOREIGN KEY (DefendingTypeID) REFERENCES Type(TypeID)
);

CREATE TABLE IF NOT EXISTS `UserInfo` (
    `UserID` INT PRIMARY KEY,
    `Username` VARCHAR(255) NOT NULL,
    `Password` VARCHAR(255) NOT NULL,
    `TotalPoints` INT NOT NULL,
    `CorrectPredictions` INT NOT NULL,
    `IncorrectPredictions` INT NOT NULL,
    UNIQUE KEY `uq_username` (`Username`),
);

CREATE TABLE IF NOT EXISTS `BattleHistory` (
    `BattleID` INT PRIMARY KEY AUTO_INCREMENT,
    `UserID` INT,
    `Pokemon1ID` INT,
    `Pokemon2ID` INT,
    `Odds` FLOAT NOT NULL,
    `PredictedWinnerID` INT,
    `WinnerPokemonID` INT,
    FOREIGN KEY (UserID) REFERENCES UserInfo(UserID),
    FOREIGN KEY (Pokemon1ID) REFERENCES Pokemon(PokemonID),
    FOREIGN KEY (Pokemon2ID) REFERENCES Pokemon(PokemonID),
    FOREIGN KEY (PredictedWinnerID) REFERENCES Pokemon(PokemonID),
    FOREIGN KEY (WinnerPokemonID) REFERENCES Pokemon(PokemonID)
);

CREATE TABLE IF NOT EXISTS `TournamentStandings` (
    `PokemonID` INT PRIMARY KEY,
    `Appearances` INT NOT NULL,
    FOREIGN KEY (PokemonID) REFERENCES Pokemon(PokemonID)
);
