-- Add password reset token fields for self-service forgot-password flow
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);
