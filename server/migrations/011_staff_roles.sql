CREATE TABLE staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  permissions jsonb NOT NULL CHECK (jsonb_typeof(permissions) = 'array'),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_roles_name_unique ON staff_roles(lower(name));
ALTER TABLE users ADD COLUMN staff_role_id uuid REFERENCES staff_roles(id);
ALTER TABLE users ADD CONSTRAINT staff_role_staff_only CHECK (staff_role_id IS NULL OR role = 'staff');
CREATE INDEX users_staff_role_idx ON users(staff_role_id);
