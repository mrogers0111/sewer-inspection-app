CREATE TABLE IF NOT EXISTS BunSessions (
  TokenHash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  UserId UUID NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  PRIMARY KEY (TokenHash),
  KEY IX_BunSessions_ExpiresAt (ExpiresAt),
  KEY IX_BunSessions_UserId (UserId),
  CONSTRAINT FK_BunSessions_Users FOREIGN KEY (UserId) REFERENCES Users (Id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
