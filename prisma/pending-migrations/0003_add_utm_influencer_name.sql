-- Add optional influencer/partner attribution to saved UTM links.
ALTER TABLE "UtmLink"
ADD COLUMN IF NOT EXISTS "influencerName" TEXT;
