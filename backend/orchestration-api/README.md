# Orchestration API

The Orchestration API is a Node.js/Express service that handles document processing workflows for the office automation system.

## Features

- **Document Processing**: Upload and process various document types (foundation documents, contract documents, etc.)
- **LLM Integration**: Uses Google's Gemini API for intelligent document analysis
- **Error Tracking**: Integrated with Sentry for comprehensive error monitoring and performance tracking
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Health Checks**: Built-in health monitoring endpoints

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Error Tracking**: Sentry
- **Logging**: Winston
- **API Documentation**: Swagger/OpenAPI

## Environment Variables

### Required

- `GEMINI_API_KEY`: Google Gemini API key for LLM processing

### Optional

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `CORS_ORIGIN`: Allowed CORS origins (comma-separated)

### Sentry Configuration

- `SENTRY_DSN`: Sentry Data Source Name (DSN) URL
- `SENTRY_ENABLED`: Enable/disable Sentry (default: true)
- `SENTRY_TRACES_SAMPLE_RATE`: Percentage of traces to send (0.0-1.0, default: 0.1)
- `SENTRY_PROFILES_SAMPLE_RATE`: Percentage of profiles to send (0.0-1.0, default: 0.1)
- `SENTRY_SEND_DEFAULT_PII`: Send personally identifiable information (default: false)

## Sentry Integration

The orchestration API includes comprehensive Sentry integration for error tracking and performance monitoring:

### Features

1. **Error Tracking**: All unhandled errors are automatically captured
2. **Performance Monitoring**: Request tracing with configurable sample rates
3. **Profiling**: CPU profiling for performance optimization
4. **Privacy**: Automatic redaction of sensitive data (passwords, auth headers, etc.)
5. **Context**: Rich error context including request details, user IP, and custom tags

### Setup

1. Create a project in [Sentry](https://sentry.io)
2. Copy your DSN from the project settings
3. Add the DSN to your `.env` file:

```bash
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENABLED=true
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of requests
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% of requests
```

### Configuration Options

- **Traces Sample Rate**: Controls what percentage of requests are traced for performance monitoring. Set to `1.0` for 100% (useful in development) or lower values like `0.1` for production (10%).
- **Profiles Sample Rate**: Controls what percentage of requests are profiled for performance analysis. Similar to traces, use higher values in development and lower in production.
- **Send Default PII**: When enabled, Sentry will capture user IP addresses and request headers. Disable in production if you have strict privacy requirements.

### Privacy & Security

The implementation includes automatic filtering of sensitive data:

- Authorization headers are removed from breadcrumbs
- Cookie headers are removed from breadcrumbs
- Password fields are redacted from request data
- Sensitive data can be further customized in `src/lib/sentry.ts`

## Development

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Documentation

When the server is running, you can access:

- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/openapi.json`

## Health Checks

- `GET /health`: Basic health check endpoint

## Project Structure

```
orchestration-api/
├── src/
│   ├── config.ts              # Environment configuration
│   ├── index.ts               # Application entry point
│   ├── lib/
│   │   ├── sentry.ts          # Sentry initialization
│   │   ├── swagger.ts         # Swagger configuration
│   │   ├── directus/          # Directus SDK utilities
│   │   └── excel/             # Excel processing utilities
│   ├── middleware/
│   │   ├── errorHandler.ts   # Global error handler (with Sentry)
│   │   └── validation.ts     # Request validation
│   ├── routes/
│   │   ├── health.ts          # Health check routes
│   │   └── documents/         # Document processing routes
│   ├── services/              # Business logic services
│   └── utils/
│       ├── logger.ts          # Winston logger
│       └── dataTransformers.ts
├── dist/                      # Compiled JavaScript
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Docker

The API is containerized and can be run using Docker Compose:

```bash
# From the backend directory
docker-compose up orchestration-api
```

## Error Handling

The API uses a comprehensive error handling strategy:

1. **Express Error Middleware**: Catches all unhandled errors
2. **Sentry Integration**: Automatically captures and reports errors with context
3. **Winston Logging**: Structured logging for debugging
4. **Environment-aware Responses**: Detailed errors in development, sanitized in production

## Best Practices

1. **Environment Variables**: Never commit `.env` files. Use the provided `env.template` as a reference.
2. **Sentry Sample Rates**: Keep trace and profile sample rates low in production (0.1 or 10%) to avoid overwhelming Sentry and impacting performance.
3. **Logging**: Use appropriate log levels (error, warn, info, debug) for different scenarios.
4. **Error Context**: When throwing errors, include relevant context that will help with debugging.

## Troubleshooting

### Sentry Not Capturing Errors

1. Verify `SENTRY_DSN` is set correctly
2. Check `SENTRY_ENABLED=true`
3. Ensure errors are being thrown (not just logged)
4. Check Sentry dashboard for rate limiting or quota issues

### Build Errors

1. Ensure Node.js version is 18 or higher
2. Delete `node_modules` and `package-lock.json`, then run `npm install`
3. Clear the `dist` folder and rebuild

## License

See the root LICENSE file for details.






