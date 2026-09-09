-- Run once as a PostgreSQL superuser; replace placeholders outside Git.
CREATE ROLE gridex_data LOGIN PASSWORD 'CHANGE_ME';
CREATE DATABASE gridex_data OWNER gridex_data;
\connect gridex_data
CREATE EXTENSION IF NOT EXISTS timescaledb;
