FROM node:22 AS builder

WORKDIR /directus

COPY docker/directus/extensions/ extensions/

RUN for ext in $(ls extensions); do \
    echo "Building extension: $ext"; \
    cd extensions/$ext && \
    npm install && \
    npm run build || exit 1; \
    cd -; \
done

FROM directus/directus:11.9.1 AS directus

COPY --from=builder --chown=node:node /directus/extensions /directus/extensions
