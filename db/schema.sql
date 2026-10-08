-- Control Diario: PostgreSQL schema (apply only after backup and review)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS managements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, UNIQUE(company_id,name), UNIQUE(id,company_id));
CREATE TABLE IF NOT EXISTS teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, management_id uuid NOT NULL, name text NOT NULL, FOREIGN KEY(management_id,company_id) REFERENCES managements(id,company_id), UNIQUE(company_id,management_id,name), UNIQUE(id,company_id));
CREATE TABLE IF NOT EXISTS sellers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, team_id uuid NOT NULL, name text NOT NULL, external_key text, active boolean NOT NULL DEFAULT true, FOREIGN KEY(team_id,company_id) REFERENCES teams(id,company_id), UNIQUE(id,company_id));
CREATE UNIQUE INDEX IF NOT EXISTS sellers_external_unique ON sellers(company_id,external_key) WHERE external_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','manager','supervisor','seller','analyst')), seller_id uuid REFERENCES sellers(id), disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS user_scopes (user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, company_id uuid NOT NULL REFERENCES companies(id), management_id uuid, team_id uuid, PRIMARY KEY(user_id,company_id), FOREIGN KEY(management_id,company_id) REFERENCES managements(id,company_id), FOREIGN KEY(team_id,company_id) REFERENCES teams(id,company_id));
CREATE TABLE IF NOT EXISTS imports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), filename text NOT NULL, file_sha256 text NOT NULL UNIQUE, created_by uuid REFERENCES app_users(id), imported_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','completed','failed')), report jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE IF NOT EXISTS daily_counts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, seller_id uuid NOT NULL, sale_date date NOT NULL, quantity integer NOT NULL CHECK(quantity >= 0), import_id uuid REFERENCES imports(id), created_by uuid REFERENCES app_users(id), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(seller_id,company_id) REFERENCES sellers(id,company_id), UNIQUE(seller_id,sale_date));
CREATE TABLE IF NOT EXISTS individual_sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL, seller_id uuid NOT NULL, sale_date date NOT NULL, external_key text, included_in_daily_count boolean NOT NULL DEFAULT false, import_id uuid REFERENCES imports(id), created_by uuid REFERENCES app_users(id), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(seller_id,company_id) REFERENCES sellers(id,company_id));
CREATE UNIQUE INDEX IF NOT EXISTS sales_external_unique ON individual_sales(company_id,external_key) WHERE external_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES app_users(id), action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, old_data jsonb, new_data jsonb, created_at timestamptz NOT NULL DEFAULT now());
-- Do not infer overlap: only explicitly marked individual sales are included in daily counts.
-- A daily count smaller than its included individual records is an inconsistency, not a valid total.
CREATE OR REPLACE VIEW daily_sales_totals AS
WITH d AS (SELECT seller_id,sale_date,MAX(quantity) AS declared FROM daily_counts GROUP BY seller_id,sale_date),
i AS (SELECT seller_id,sale_date,COUNT(*) FILTER (WHERE included_in_daily_count)::integer AS included,COUNT(*) FILTER (WHERE NOT included_in_daily_count)::integer AS additional FROM individual_sales GROUP BY seller_id,sale_date)
SELECT s2.company_id,s2.team_id,s2.id AS seller_id,COALESCE(d.sale_date,i.sale_date) AS sale_date,
COALESCE(d.declared,0) AS declared,COALESCE(i.included,0) AS included,COALESCE(i.additional,0) AS additional,
CASE WHEN COALESCE(i.included,0)>COALESCE(d.declared,0) THEN NULL ELSE COALESCE(d.declared,0)+COALESCE(i.additional,0) END AS consolidated,
(COALESCE(i.included,0)>COALESCE(d.declared,0)) AS needs_review
FROM d FULL JOIN i ON i.seller_id=d.seller_id AND i.sale_date=d.sale_date
JOIN sellers s2 ON s2.id=COALESCE(d.seller_id,i.seller_id)
-- select s2 instead of s when a date has individual sales only
;
