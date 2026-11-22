-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveTeamId" UUID,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" UUID,
    "dueDate" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorId" UUID,
    "teamId" UUID,
    "projectId" UUID,
    "taskId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "actorId" UUID,
    "projectId" UUID,
    "taskId" UUID,
    "commentId" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "team_ownerId_idx" ON "team"("ownerId");

-- CreateIndex
CREATE INDEX "team_member_userId_idx" ON "team_member"("userId");

-- CreateIndex
CREATE INDEX "team_member_teamId_role_idx" ON "team_member"("teamId", "role");

-- CreateIndex
CREATE INDEX "project_teamId_status_idx" ON "project"("teamId", "status");

-- CreateIndex
CREATE INDEX "project_createdById_idx" ON "project"("createdById");

-- CreateIndex
CREATE INDEX "project_updatedById_idx" ON "project"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "project_id_teamId_key" ON "project"("id", "teamId");

-- CreateIndex
CREATE INDEX "task_teamId_status_idx" ON "task"("teamId", "status");

-- CreateIndex
CREATE INDEX "task_teamId_priority_idx" ON "task"("teamId", "priority");

-- CreateIndex
CREATE INDEX "task_teamId_assignedToId_idx" ON "task"("teamId", "assignedToId");

-- CreateIndex
CREATE INDEX "task_projectId_teamId_idx" ON "task"("projectId", "teamId");

-- CreateIndex
CREATE INDEX "task_dueDate_idx" ON "task"("dueDate");

-- CreateIndex
CREATE INDEX "task_createdById_idx" ON "task"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "task_id_teamId_key" ON "task"("id", "teamId");

-- CreateIndex
CREATE INDEX "comment_taskId_teamId_idx" ON "comment"("taskId", "teamId");

-- CreateIndex
CREATE INDEX "comment_userId_idx" ON "comment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_id_teamId_key" ON "comment"("id", "teamId");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_teamId_idx" ON "notification"("teamId");

-- CreateIndex
CREATE INDEX "activity_log_teamId_createdAt_idx" ON "activity_log"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_log_actorId_idx" ON "activity_log"("actorId");

-- CreateIndex
CREATE INDEX "activity_log_projectId_teamId_idx" ON "activity_log"("projectId", "teamId");

-- CreateIndex
CREATE INDEX "activity_log_taskId_teamId_idx" ON "activity_log"("taskId", "teamId");

-- CreateIndex
CREATE INDEX "activity_log_commentId_teamId_idx" ON "activity_log"("commentId", "teamId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_lastActiveTeamId_fkey" FOREIGN KEY ("lastActiveTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_teamId_fkey" FOREIGN KEY ("projectId", "teamId") REFERENCES "project"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_teamId_assignedToId_fkey" FOREIGN KEY ("teamId", "assignedToId") REFERENCES "team_member"("teamId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_taskId_teamId_fkey" FOREIGN KEY ("taskId", "teamId") REFERENCES "task"("id", "teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_projectId_teamId_fkey" FOREIGN KEY ("projectId", "teamId") REFERENCES "project"("id", "teamId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_taskId_teamId_fkey" FOREIGN KEY ("taskId", "teamId") REFERENCES "task"("id", "teamId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_projectId_teamId_fkey" FOREIGN KEY ("projectId", "teamId") REFERENCES "project"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_taskId_teamId_fkey" FOREIGN KEY ("taskId", "teamId") REFERENCES "task"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_commentId_teamId_fkey" FOREIGN KEY ("commentId", "teamId") REFERENCES "comment"("id", "teamId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- CUSTOM POSTGRESQL INTEGRITY STRATEGIES (DATABASE_DESIGN.md §6)
-- ============================================================================

-- A. Project Date Ordering Constraint (DATABASE_DESIGN.md §6.C)
ALTER TABLE "project"
ADD CONSTRAINT chk_project_dates
CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate");

-- B. Single Team Owner Integrity (DATABASE_DESIGN.md §6.A)

-- 1. Database-Level Single Owner Guarantee (Partial Unique Index)
-- Enforces at most one OWNER per team at the PostgreSQL storage engine level.
CREATE UNIQUE INDEX "idx_team_single_owner"
ON "team_member" ("teamId")
WHERE ("role" = 'OWNER');

-- 2. Single Team Owner Invariant Trigger Function & Triggers
-- Enforces at least one OWNER per team, and matches team.ownerId to team_member OWNER.
CREATE OR REPLACE FUNCTION verify_team_owner_invariant() RETURNS TRIGGER AS $$
DECLARE
  teams_to_check UUID[];
  target_team_id UUID;
  owner_count INT;
  actual_owner UUID;
  team_exists BOOLEAN;
BEGIN
  -- Collect team IDs that require invariant validation
  IF TG_TABLE_NAME = 'team' THEN
    IF TG_OP = 'INSERT' THEN
      teams_to_check := ARRAY[NEW."id"];
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW."id" IS DISTINCT FROM OLD."id" THEN
        teams_to_check := ARRAY[OLD."id", NEW."id"];
      ELSE
        teams_to_check := ARRAY[NEW."id"];
      END IF;
    END IF;
  ELSE -- TG_TABLE_NAME = 'team_member'
    IF TG_OP = 'INSERT' THEN
      teams_to_check := ARRAY[NEW."teamId"];
    ELSIF TG_OP = 'DELETE' THEN
      teams_to_check := ARRAY[OLD."teamId"];
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW."teamId" IS DISTINCT FROM OLD."teamId" THEN
        teams_to_check := ARRAY[OLD."teamId", NEW."teamId"];
      ELSE
        teams_to_check := ARRAY[NEW."teamId"];
      END IF;
    END IF;
  END IF;

  -- Validate each affected team
  FOREACH target_team_id IN ARRAY teams_to_check
  LOOP
    -- Skip validation if target team ID is NULL
    IF target_team_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Check if team still exists (handles team deletion cascade)
    SELECT EXISTS(SELECT 1 FROM "team" WHERE "id" = target_team_id) INTO team_exists;
    IF NOT team_exists THEN
      CONTINUE;
    END IF;

    -- Validate exact owner count on team_member
    SELECT COUNT(*), MIN("userId") INTO owner_count, actual_owner
    FROM "team_member"
    WHERE "teamId" = target_team_id AND "role" = 'OWNER';

    IF owner_count != 1 THEN
      RAISE EXCEPTION 'Team % must have exactly 1 OWNER (found %)', target_team_id, owner_count;
    END IF;

    -- Validate team.ownerId matches team_member OWNER
    IF NOT EXISTS (
      SELECT 1 FROM "team"
      WHERE "id" = target_team_id AND "ownerId" = actual_owner
    ) THEN
      RAISE EXCEPTION 'Team % ownerId does not match OWNER membership', target_team_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Constraint Trigger on "team"
CREATE CONSTRAINT TRIGGER trg_verify_team_owner_team
AFTER INSERT OR UPDATE ON "team"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_team_owner_invariant();

-- Constraint Trigger on "team_member"
CREATE CONSTRAINT TRIGGER trg_verify_team_owner_member
AFTER INSERT OR UPDATE OR DELETE ON "team_member"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verify_team_owner_invariant();

-- C. Clean Active Team Context on Member Removal (DATABASE_DESIGN.md §6.B)
CREATE OR REPLACE FUNCTION clean_last_active_team() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "user"
  SET "lastActiveTeamId" = NULL
  WHERE "id" = OLD."userId" AND "lastActiveTeamId" = OLD."teamId";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clean_last_active_team
AFTER DELETE ON "team_member"
FOR EACH ROW EXECUTE FUNCTION clean_last_active_team();


