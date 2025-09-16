# Start from the official PostgreSQL 17 image
FROM postgres:17

# Install build dependencies and extension packages
RUN apt-get update \
    && apt install -y --no-install-recommends \
        # Build essentials for compiling extensions
        build-essential \
        postgresql-server-dev-17 \
        # For pgvector
        git \
        ca-certificates \
        # For monitoring utilities
        curl \
        # For PostgreSQL connectivity
        libpq-dev \
        # For PostGIS
        postgis \
        postgresql-17-postgis-3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector extension
RUN cd /tmp \
    && git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd .. \
    && rm -rf pgvector

# Install pg_wait_sampling extension
RUN cd /tmp \
    && git clone https://github.com/postgrespro/pg_wait_sampling.git \
    && cd pg_wait_sampling \
    && make USE_PGXS=1 \
    && make USE_PGXS=1 install \
    && cd .. \
    && rm -rf pg_wait_sampling

# Install auto_explain and other contrib modules
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-contrib-17 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy custom postgresql configuration file
COPY config/postgresql.conf /etc/postgresql/postgresql.conf

# Set the default command
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]