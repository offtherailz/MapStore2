FROM postgis/postgis:17-3.5
WORKDIR /code
COPY ./01-init-user.sh /docker-entrypoint-initdb.d/
ADD --chmod=644 https://raw.githubusercontent.com/geosolutions-it/geostore/master/doc/sql/002_create_schema_postgres.sql /code/
USER postgres