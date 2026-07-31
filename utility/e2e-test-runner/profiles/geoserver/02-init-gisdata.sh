#!/usr/bin/env bash
# Creates the PostGIS database published by seed-geoserver.sh as an E2E WFS layer.
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
EOSQL
