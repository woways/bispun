-- Add isSystem flag to ChatMessage for system-generated messages
-- (e.g. "X was added", "X was removed")
ALTER TABLE "ChatMessage" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
