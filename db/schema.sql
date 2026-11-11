CREATE TABLE IF NOT EXISTS `Organizations` (
	`Id` UUID NOT NULL DEFAULT UUID(),
	`Name` VARCHAR(255) NOT NULL,
	PRIMARY KEY (`Id`),
	UNIQUE KEY `UX_Organization_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Users` (
	`Id` UUID NOT NULL DEFAULT UUID(),
	`FirstName` VARCHAR(100) NOT NULL DEFAULT '',
	`LastName` VARCHAR(100) NOT NULL DEFAULT '',
	`Email` VARCHAR(255) NOT NULL,
	`Password` VARCHAR(255) NOT NULL,
	PRIMARY KEY (`Id`),
	UNIQUE KEY `UX_User_Email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Projects` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`Number` VARCHAR(100) NOT NULL,
	`Name` VARCHAR(255) NOT NULL,
	`OrganizationId` UUID NOT NULL,
	PRIMARY KEY (`Id`),
	KEY `IX_Project_OrganizationId` (`OrganizationId`),
	CONSTRAINT `FK_Project_Organization_OrganizationId`
		FOREIGN KEY (`OrganizationId`) REFERENCES `Organizations` (`Id`)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserOrganizations` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`UserId` UUID NOT NULL,
	`OrganizationId` UUID NOT NULL,
	PRIMARY KEY (`Id`),
	UNIQUE KEY `UX_UserOrganization_UserId_OrganizationId` (`UserId`, `OrganizationId`),
	KEY `IX_UserOrganization_OrganizationId` (`OrganizationId`),
	CONSTRAINT `FK_UserOrganization_User_UserId`
		FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE,
	CONSTRAINT `FK_UserOrganization_Organization_OrganizationId`
		FOREIGN KEY (`OrganizationId`) REFERENCES `Organizations` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Segments` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`ProjectId` INT NOT NULL,
	`InspectionStatusType` TINYINT UNSIGNED NOT NULL,
	`Number` VARCHAR(100) NOT NULL,
	`Notes` TEXT NOT NULL,
	`StartingLongitudeLatitude` VARCHAR(128) NOT NULL,
	`EndingLongitudeLatitude` VARCHAR(128) NOT NULL,
	PRIMARY KEY (`Id`),
	KEY `IX_Segment_ProjectId` (`ProjectId`),
	CONSTRAINT `CK_Segment_InspectionStatusType`
		CHECK (`InspectionStatusType` IN (0, 1, 2, 3)),
	CONSTRAINT `FK_Segment_Project_ProjectId`
		FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Manholes` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`ProjectId` INT NOT NULL,
	`InspectionStatusType` TINYINT UNSIGNED NOT NULL,
	`ManholeId` VARCHAR(100) NOT NULL,
	`InspectedDate` DATETIME NOT NULL,
	PRIMARY KEY (`Id`),
	UNIQUE KEY `UX_Manhole_ProjectId_ManholeId` (`ProjectId`, `ManholeId`),
	KEY `IX_Manhole_ProjectId` (`ProjectId`),
	CONSTRAINT `CK_Manhole_InspectionStatusType`
		CHECK (`InspectionStatusType` IN (0, 1, 2, 3)),
	CONSTRAINT `FK_Manhole_Project_ProjectId`
		FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SegmentRecords` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`SegmentId` INT NOT NULL,
	`DateTime` DATETIME NOT NULL,
	`InspectedLength` DECIMAL(10,2) NOT NULL,
	`Notes` TEXT NOT NULL,
	`DirectionType` TINYINT UNSIGNED NOT NULL,
	`UserId` UUID NOT NULL,
	PRIMARY KEY (`Id`),
	KEY `IX_SegmentRecord_SegmentId` (`SegmentId`),
	KEY `IX_SegmentRecord_UserId` (`UserId`),
	CONSTRAINT `CK_SegmentRecord_DirectionType`
		CHECK (`DirectionType` IN (0, 1)),
	CONSTRAINT `FK_SegmentRecord_Segment_SegmentId`
		FOREIGN KEY (`SegmentId`) REFERENCES `Segments` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE,
	CONSTRAINT `FK_SegmentRecord_User_UserId`
		FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Jettings` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`SegmentId` INT NOT NULL,
	`DateTime` DATETIME NOT NULL,
	`NumberOfTimesJetted` INT UNSIGNED NOT NULL,
	`LengthJetted` DECIMAL(10,2) NOT NULL,
	`Notes` TEXT NOT NULL,
	`UserId` UUID NOT NULL,
	PRIMARY KEY (`Id`),
	KEY `IX_Jetting_SegmentId` (`SegmentId`),
	KEY `IX_Jetting_UserId` (`UserId`),
	CONSTRAINT `FK_Jetting_Segment_SegmentId`
		FOREIGN KEY (`SegmentId`) REFERENCES `Segments` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE,
	CONSTRAINT `FK_Jetting_User_UserId`
		FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ManholeRecords` (
	`Id` INT NOT NULL AUTO_INCREMENT,
	`ManholeId` INT NOT NULL,
	`DateTime` DATETIME NOT NULL,
	`InspectionStatusType` TINYINT UNSIGNED NOT NULL,
	`Notes` TEXT NOT NULL,
	`UserId` UUID NOT NULL,
	PRIMARY KEY (`Id`),
	KEY `IX_ManholeRecord_ManholeId` (`ManholeId`),
	KEY `IX_ManholeRecord_UserId` (`UserId`),
	CONSTRAINT `CK_ManholeRecord_InspectionStatusType`
		CHECK (`InspectionStatusType` IN (0, 1, 2, 3)),
	CONSTRAINT `FK_ManholeRecord_Manhole_ManholeId`
		FOREIGN KEY (`ManholeId`) REFERENCES `Manholes` (`Id`)
		ON UPDATE CASCADE
		ON DELETE CASCADE,
	CONSTRAINT `FK_ManholeRecord_User_UserId`
		FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


