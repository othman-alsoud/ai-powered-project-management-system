-- Fix PostgreSQL trigger function verify_team_owner_invariant
-- Replaces unsupported aggregate on UUID column with COUNT(*) and separate SELECT ... LIMIT 1

CREATE OR REPLACE FUNCTION public.verify_team_owner_invariant() RETURNS TRIGGER AS $$
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
    SELECT COUNT(*) INTO owner_count
    FROM "team_member"
    WHERE "teamId" = target_team_id AND "role" = 'OWNER';

    IF owner_count != 1 THEN
      RAISE EXCEPTION 'Team % must have exactly 1 OWNER (found %)', target_team_id, owner_count;
    END IF;

    -- Retrieve the single OWNER UUID (guaranteed exactly 1 row when owner_count = 1)
    SELECT "userId" INTO actual_owner
    FROM "team_member"
    WHERE "teamId" = target_team_id AND "role" = 'OWNER'
    LIMIT 1;

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
