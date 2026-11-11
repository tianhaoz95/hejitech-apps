ALTER TABLE "headway"."push_devices"
  ADD COLUMN "fcm_token" text;

ALTER TABLE "headway"."push_devices"
  ALTER COLUMN "apns_token" DROP NOT NULL;

ALTER TABLE "headway"."push_devices"
  ADD CONSTRAINT "push_devices_fcm_token_key" UNIQUE (fcm_token);

ALTER TABLE "headway"."push_devices"
  ADD CONSTRAINT "push_devices_one_token" CHECK (((apns_token IS NULL) <> (fcm_token IS NULL)));
