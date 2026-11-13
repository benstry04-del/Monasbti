DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role = 'supplier');
UPDATE auth_tokens SET consumed_at = now()
WHERE consumed_at IS NULL AND user_id IN (SELECT id FROM users WHERE role = 'supplier');
UPDATE users SET active = false, updated_at = now() WHERE role = 'supplier' AND active = true;
