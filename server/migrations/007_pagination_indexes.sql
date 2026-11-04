CREATE INDEX bookings_created_id_idx ON bookings(created_at DESC,id);
CREATE INDEX bookings_status_created_id_idx ON bookings(status,created_at DESC,id);
CREATE INDEX payments_user_created_idx ON payments(user_id,created_at DESC,id);
CREATE INDEX payments_status_created_idx ON payments(status,created_at DESC,id);
CREATE INDEX users_role_created_idx ON users(role,created_at DESC,id);
CREATE INDEX tickets_created_idx ON tickets(created_at DESC,id);
CREATE INDEX audit_created_id_idx ON audit_log(created_at DESC,id);
