-- Create Authentik database and user
CREATE DATABASE authentik;
CREATE USER authentik WITH ENCRYPTED PASSWORD 'changeme_authentik_db_password';
GRANT ALL PRIVILEGES ON DATABASE authentik TO authentik;

-- Connect to authentik database and grant schema privileges
\c authentik
GRANT ALL ON SCHEMA public TO authentik;

