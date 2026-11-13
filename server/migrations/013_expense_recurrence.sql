ALTER TABLE admin_expenses ADD COLUMN recurring_from uuid REFERENCES admin_expenses(id);
CREATE UNIQUE INDEX admin_expenses_recurrence_unique
  ON admin_expenses(recurring_from, expense_date) WHERE recurring_from IS NOT NULL;
