#!/usr/bin/env bash
# Creates the PostGIS database whose tables seed-geoserver.sh publishes as E2E layers.
# Runs only once, when the postgres data volume is empty.
set -e

psql -v ON_ERROR_STOP=1 --username postgres <<-EOSQL
    CREATE DATABASE gisdata;
EOSQL

psql -v ON_ERROR_STOP=1 --username postgres --dbname gisdata <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;

    CREATE TABLE e2e_points (
        id serial PRIMARY KEY,
        name varchar(64) NOT NULL,
        category varchar(32) NOT NULL,
        population integer NOT NULL,
        geom geometry(Point, 4326) NOT NULL
    );

    INSERT INTO e2e_points (name, category, population, geom) VALUES
        ('Roma',    'capital', 2748000, ST_SetSRID(ST_MakePoint(12.4964, 41.9028), 4326)),
        ('Milano',  'city',    1352000, ST_SetSRID(ST_MakePoint(9.1900, 45.4642), 4326)),
        ('Napoli',  'city',     913000, ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)),
        ('Firenze', 'city',     361000, ST_SetSRID(ST_MakePoint(11.2558, 43.7696), 4326)),
        ('Genova',  'city',     561000, ST_SetSRID(ST_MakePoint(8.9463, 44.4056), 4326));

    CREATE INDEX e2e_points_geom_idx ON e2e_points USING GIST (geom);

    -- Same schema as e2e_points, open to WFS-T: editing suites add and remove their own rows.
    CREATE TABLE e2e_edit (
        id serial PRIMARY KEY,
        name varchar(64),
        category varchar(32),
        population integer,
        geom geometry(Point, 4326)
    );
    INSERT INTO e2e_edit (name, category, population, geom) VALUES
        ('Torino', 'city', 848000, ST_SetSRID(ST_MakePoint(7.6869, 45.0703), 4326));

    -- Time enabled layer: one event a day, for the timeline and time filters.
    CREATE TABLE e2e_events (
        id serial PRIMARY KEY,
        name varchar(64) NOT NULL,
        event_time timestamp NOT NULL,
        geom geometry(Point, 4326) NOT NULL
    );
    INSERT INTO e2e_events (name, event_time, geom) VALUES
        ('Event 1', '2024-01-01T10:00:00', ST_SetSRID(ST_MakePoint(12.4964, 41.9028), 4326)),
        ('Event 2', '2024-01-02T10:00:00', ST_SetSRID(ST_MakePoint(9.1900, 45.4642), 4326)),
        ('Event 3', '2024-01-03T10:00:00', ST_SetSRID(ST_MakePoint(14.2681, 40.8518), 4326)),
        ('Event 4', '2024-01-04T10:00:00', ST_SetSRID(ST_MakePoint(11.2558, 43.7696), 4326)),
        ('Event 5', '2024-01-05T10:00:00', ST_SetSRID(ST_MakePoint(8.9463, 44.4056), 4326));

    -- Table without geometry, published as a non spatial WFS feature type. One value is NULL.
    CREATE TABLE e2e_stats (
        id serial PRIMARY KEY,
        region varchar(64) NOT NULL,
        visitors integer
    );
    INSERT INTO e2e_stats (region, visitors) VALUES
        ('Lazio', 1200), ('Lombardia', 1500), ('Campania', 900), ('Toscana', 1100), ('Liguria', NULL);
EOSQL
