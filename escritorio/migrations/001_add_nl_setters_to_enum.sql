-- Migration 001: add nl_setters to bl_subscriptions.plan_slug ENUM
--
-- Context: nl_setters is a bypass role for internal users (no payment required).
-- The billing system must be able to store nl_setters subscriptions created
-- via the admin panel without triggering an ENUM constraint error.
--
-- Applied automatically via db-billing.ts CREATE TABLE IF NOT EXISTS on first boot.
-- For existing installations, run this ALTER manually:
--
-- ALTER TABLE bl_subscriptions
--   MODIFY COLUMN plan_slug
--   ENUM('nl360_free','nl360_basic','nl360_pro','nl360_elite','nl_setters') NOT NULL;

ALTER TABLE bl_subscriptions
  MODIFY COLUMN plan_slug
  ENUM('nl360_free','nl360_basic','nl360_pro','nl360_elite','nl_setters') NOT NULL;
