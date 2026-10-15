#!/bin/sh
set -eu

# Runs only for an empty PostgreSQL volume. The app never connects as postgres.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$PGPASSWORD" --set=app_database="$POSTGRES_DB" <<'SQL'
CREATE ROLE learning_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  PASSWORD :'app_password';
ALTER DATABASE :"app_database" OWNER TO learning_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO learning_app;
SQL
