import swaggerJsdoc from "swagger-jsdoc";
import { config } from "@orchestration-api/config";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Orchestration API",
      description:
        "Document processing workflows orchestration API for waste management document validation and Excel generation",
      version: "1.0.0",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: "Development server",
      },
      {
        url: "http://localhost:3001",
        description: "Default development server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check endpoints",
      },
      {
        name: "Documents",
        description: "Document processing and validation endpoints",
      },
    ],
    components: {
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["healthy", "unhealthy"],
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            environment: {
              type: "string",
            },
            services: {
              type: "object",
              properties: {
                api: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
                directus: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
                postgres: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
                keydb: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
                minio: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
                gemini: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["healthy", "unhealthy", "not_configured"],
                    },
                    message: {
                      type: "string",
                    },
                    latency: {
                      type: "number",
                    },
                  },
                },
              },
            },
          },
          required: ["status", "timestamp", "environment", "services"],
        },
        ValidationResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            jobId: {
              type: "string",
            },
            provider: {
              type: "string",
              enum: ["gemini"],
            },
            directusSourceDocumentId: {
              type: "string",
            },
            status: {
              type: "string",
            },
            message: {
              type: "string",
            },
          },
          required: ["success", "jobId", "provider"],
        },
        JobStatusResponse: {
          type: "object",
          properties: {
            jobId: {
              type: "string",
            },
            status: {
              type: "string",
              enum: ["pending", "processing", "completed", "failed"],
            },
            fileName: {
              type: "string",
            },
            fileSize: {
              type: "number",
            },
            provider: {
              type: "string",
            },
            error: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
            validationResult: {
              $ref: "#/components/schemas/ValidationResult",
              nullable: true,
            },
          },
          required: ["jobId", "status", "fileName", "fileSize", "createdAt", "updatedAt"],
        },
        ValidationResult: {
          type: "object",
          properties: {
            present_fields: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Fields that were found in the document",
            },
            missing_fields: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Fields that were not found in the document",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence score of the validation",
            },
            extracted_data: {
              $ref: "#/components/schemas/ExtractedData",
            },
            provider: {
              type: "string",
            },
          },
          required: [
            "present_fields",
            "missing_fields",
            "confidence",
            "extracted_data",
            "provider",
          ],
        },
        ExtractedData: {
          type: "object",
          properties: {
            waste_code: {
              type: "string",
              nullable: true,
            },
            waste_name: {
              type: "string",
              nullable: true,
            },
            waste_category: {
              type: "string",
              nullable: true,
            },
            handling_code: {
              type: "string",
              nullable: true,
            },
            originator: {
              $ref: "#/components/schemas/WasteOriginator",
              nullable: true,
            },
            recipient: {
              $ref: "#/components/schemas/WasteRecipient",
              nullable: true,
            },
            records: {
              type: "array",
              items: {
                $ref: "#/components/schemas/WasteRecord",
              },
              nullable: true,
            },
          },
        },
        WasteOriginator: {
          type: "object",
          properties: {
            company_id: {
              type: "string",
              nullable: true,
            },
            name: {
              type: "string",
              nullable: true,
            },
            address: {
              type: "string",
              nullable: true,
            },
            responsible_person: {
              type: "string",
              nullable: true,
            },
            independent_establishment: {
              $ref: "#/components/schemas/IndependentEstablishment",
              nullable: true,
            },
          },
        },
        IndependentEstablishment: {
          type: "object",
          properties: {
            establishment_number: {
              type: "string",
              nullable: true,
            },
            name: {
              type: "string",
              nullable: true,
            },
            address: {
              type: "string",
              nullable: true,
            },
            responsible_person: {
              type: "string",
              nullable: true,
            },
          },
        },
        WasteRecipient: {
          type: "object",
          properties: {
            company_id: {
              type: "string",
              nullable: true,
            },
            name: {
              type: "string",
              nullable: true,
            },
            address: {
              type: "string",
              nullable: true,
            },
          },
        },
        WasteRecord: {
          type: "object",
          properties: {
            serial_number: {
              type: "number",
              nullable: true,
            },
            date: {
              type: "string",
              nullable: true,
            },
            waste_amount_generated: {
              type: "number",
              nullable: true,
            },
            waste_amount_transferred: {
              type: "string",
              nullable: true,
            },
          },
        },
        JobListResponse: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                $ref: "#/components/schemas/JobSummary",
              },
            },
            count: {
              type: "number",
            },
          },
          required: ["jobs", "count"],
        },
        JobSummary: {
          type: "object",
          properties: {
            jobId: {
              type: "string",
            },
            status: {
              type: "string",
              enum: ["pending", "processing", "completed", "failed"],
            },
            fileName: {
              type: "string",
            },
            fileSize: {
              type: "number",
            },
            provider: {
              type: "string",
            },
            error: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
            hasExcel: {
              type: "boolean",
            },
          },
          required: [
            "jobId",
            "status",
            "fileName",
            "fileSize",
            "createdAt",
            "updatedAt",
            "hasExcel",
          ],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
            },
            details: {
              type: "string",
            },
          },
          required: ["error"],
        },
      },
    },
  },
  // Paths to files containing OpenAPI definitions in JSDoc comments
  apis: ["./src/routes/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
