-- Retire previously issued authenticator challenges; never permit their reuse.
UPDATE auth_tokens SET consumed_at=now()
WHERE purpose IN ('MFA_ENROLL','MFA_CHALLENGE') AND consumed_at IS NULL;
