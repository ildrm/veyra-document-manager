-- Executed only when the development volume is initialized for the first time.
-- Application schema changes remain the responsibility of versioned migrations.

SELECT format('CREATE DATABASE openfga OWNER %I', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'openfga')\gexec

SELECT format('CREATE DATABASE keycloak OWNER %I', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

SELECT format('CREATE DATABASE temporal OWNER %I', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal')\gexec

SELECT format('CREATE DATABASE temporal_visibility OWNER %I', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'temporal_visibility')\gexec

\connect veyra
CREATE EXTENSION IF NOT EXISTS vector;
