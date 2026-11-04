CREATE FUNCTION signed_contract_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   IF OLD.signed_at IS NOT NULL THEN RAISE EXCEPTION 'signed contract is immutable'; END IF;
   RETURN OLD;
 END IF;
 IF OLD.signed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'signed contract is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER contracts_signed_immutable BEFORE UPDATE OR DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION signed_contract_immutable();
CREATE INDEX bookings_updated_idx ON bookings(updated_at DESC,id);
CREATE INDEX payments_created_idx ON payments(created_at DESC,id);
