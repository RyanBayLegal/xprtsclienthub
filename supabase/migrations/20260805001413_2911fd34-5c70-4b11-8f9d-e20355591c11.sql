ALTER TABLE public.inbound_emails ADD COLUMN IF NOT EXISTS provider_fingerprint text;

WITH ranked_uid AS (
  SELECT id, row_number() OVER (PARTITION BY message_uid ORDER BY received_at ASC, id ASC) AS rn
  FROM public.inbound_emails
  WHERE message_uid IS NOT NULL AND btrim(message_uid) <> ''
)
DELETE FROM public.inbound_emails i
USING ranked_uid r
WHERE i.id = r.id AND r.rn > 1;

WITH ranked_mid AS (
  SELECT id, row_number() OVER (PARTITION BY lower(btrim(message_id)) ORDER BY received_at ASC, id ASC) AS rn
  FROM public.inbound_emails
  WHERE message_id IS NOT NULL AND btrim(message_id) <> ''
)
DELETE FROM public.inbound_emails i
USING ranked_mid r
WHERE i.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS inbound_emails_message_uid_unique
  ON public.inbound_emails (message_uid)
  WHERE message_uid IS NOT NULL AND btrim(message_uid) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS inbound_emails_message_id_unique
  ON public.inbound_emails (lower(btrim(message_id)))
  WHERE message_id IS NOT NULL AND btrim(message_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS inbound_emails_provider_fingerprint_unique
  ON public.inbound_emails (provider_fingerprint)
  WHERE provider_fingerprint IS NOT NULL AND btrim(provider_fingerprint) <> '';