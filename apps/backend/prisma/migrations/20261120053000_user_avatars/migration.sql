/*
  Warnings:

  - A unique constraint covering the columns `[avatarKey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarKey" TEXT;

-- CreateTable
CREATE TABLE "user_avatars" (
    "userId" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_avatarKey_key" ON "users"("avatarKey");

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
