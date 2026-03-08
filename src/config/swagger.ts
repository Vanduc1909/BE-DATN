import swaggerJSDoc from 'swagger-jsdoc';

import { env } from '@config/env';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Poly2026 Backend API',
      version: '1.0.0',
      description: 'Base backend procedural MVC with TypeScript + Express.'
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}${env.API_PREFIX}`
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Check service health',
          responses: {
            '200': {
              description: 'OK'
            }
          }
        }
      },
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register account'
        }
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login account'
        }
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Send reset password token'
        }
      },
      '/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token'
        }
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token'
        }
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          security: [{ bearerAuth: [] }]
        }
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current profile',
          security: [{ bearerAuth: [] }]
        }
      },
      '/products/top-selling': {
        get: {
          tags: ['Products'],
          summary: 'Get top selling products'
        }
      },
      '/products/newest': {
        get: {
          tags: ['Products'],
          summary: 'Get newest products'
        }
      },
      '/products/filters': {
        get: {
          tags: ['Products'],
          summary: 'Get storefront category and brand filters'
        }
      },
      '/colors': {
        get: {
          tags: ['Colors'],
          summary: 'List colors'
        },
        post: {
          tags: ['Colors'],
          summary: 'Create color',
          security: [{ bearerAuth: [] }]
        }
      },
      '/colors/{colorId}': {
        get: {
          tags: ['Colors'],
          summary: 'Get color by id'
        },
        patch: {
          tags: ['Colors'],
          summary: 'Update color',
          security: [{ bearerAuth: [] }]
        },
        delete: {
          tags: ['Colors'],
          summary: 'Delete color',
          security: [{ bearerAuth: [] }]
        }
      },
      '/sizes': {
        get: {
          tags: ['Sizes'],
          summary: 'List sizes'
        },
        post: {
          tags: ['Sizes'],
          summary: 'Create size',
          security: [{ bearerAuth: [] }]
        }
      },
      '/sizes/{sizeId}': {
        get: {
          tags: ['Sizes'],
          summary: 'Get size by id'
        },
        patch: {
          tags: ['Sizes'],
          summary: 'Update size',
          security: [{ bearerAuth: [] }]
        },
        delete: {
          tags: ['Sizes'],
          summary: 'Delete size',
          security: [{ bearerAuth: [] }]
        }
      },
      '/reviews/product/{productId}': {
        get: {
          tags: ['Reviews'],
          summary: 'List reviews by product'
        }
      },
      '/comments': {
        get: {
          tags: ['Comments'],
          summary: 'List comments by target'
        },
        post: {
          tags: ['Comments'],
          summary: 'Create comment',
          security: [{ bearerAuth: [] }]
        }
      },
      '/upload/image': {
        post: {
          tags: ['Upload'],
          summary: 'Upload image',
          security: [{ bearerAuth: [] }]
        }
      },
      '/mail/test': {
        post: {
          tags: ['Mail'],
          summary: 'Send test email',
          security: [{ bearerAuth: [] }]
        }
      }
    }
  },
  apis: []
});
