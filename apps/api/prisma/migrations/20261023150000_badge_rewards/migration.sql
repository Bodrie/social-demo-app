-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "achievement_key" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "featured_badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ring" TEXT;


-- Collector badges already earned give their ring at once; the badges and the settings keep it
-- from here on (users/ring.ts).
UPDATE "users" AS u SET "ring" = best.ring
FROM (
  SELECT ua.user_id,
    CASE MAX(CASE ua.key
        WHEN 'collected-75' THEN 4
        WHEN 'collected-50' THEN 3
        WHEN 'collected-25' THEN 2
        WHEN 'collected-10' THEN 1
      END)
      WHEN 4 THEN 'platinum'
      WHEN 3 THEN 'gold'
      WHEN 2 THEN 'silver'
      WHEN 1 THEN 'bronze'
    END AS ring
  FROM "user_achievements" AS ua
  WHERE ua.key IN ('collected-10', 'collected-25', 'collected-50', 'collected-75')
  GROUP BY ua.user_id
) AS best
WHERE best.user_id = u.id
  AND COALESCE(u.settings ->> 'showAchievements', 'true') <> 'false'
  AND COALESCE(u.settings ->> 'showRing', 'true') <> 'false';
