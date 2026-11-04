export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Molty Foam Multi-Branch ERP — REST API',
    version: '1.0.0',
    description:
      'Production backend REST API for Molty Foam Retail, Wholesale & Distributor Operations in Pakistan. Provides multi-branch authentication, shared catalogue, branch-wise stock, and sales/receivables reconciliation.',
    contact: {
      name: 'Molty Foam ERP Engineering Team',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base URL',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'molty_session_id',
        description: 'HTTP-only session cookie set upon successful authentication',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Session ID supplied as Bearer token in Authorization header',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid request input' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['loginId', 'password'],
        properties: {
          loginId: { type: 'string', example: 'mainbranch' },
          password: { type: 'string', example: 'password123' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
          service: { type: 'string', example: 'molty-foam-erp-backend' },
          version: { type: 'string', example: '1.0.0' },
          timestamp: { type: 'string', format: 'date-time' },
          uptimeSeconds: { type: 'number', example: 120.45 },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean', example: true },
              readyState: { type: 'number', example: 1 },
              isReplicaSet: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Service Health & Database Connectivity',
        description: 'Returns operational readiness and real-time MongoDB connection status.',
        responses: {
          '200': {
            description: 'Backend service and database are operational',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate Super Admin or Branch Account',
        description:
          'Validates credentials, establishes a server-side session, and sets an HTTP-only cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials or inactive account',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current Authenticated Account Profile',
        description: 'Returns authenticated identity, role, and branch permissions.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Active session profile',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - invalid or expired session',
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Terminate Session & Logout',
        description: 'Invalidates server session and clears the session cookie.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logged out successfully',
          },
        },
      },
    },
    '/brands': {
      get: {
        summary: 'List Brands',
        description: 'Returns active mattress brands.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Brand list' } },
      },
      post: {
        summary: 'Create Brand',
        description: 'Registers a new master brand (Super Admin only).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Brand created' } },
      },
    },
    '/categories': {
      get: {
        summary: 'List Categories',
        description: 'Returns categories with optional brandId filter.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Category list' } },
      },
      post: {
        summary: 'Create Category',
        description: 'Creates a brand-specific category (Super Admin only).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Category created' } },
      },
    },
    '/sizes': {
      get: {
        summary: 'List Sizes',
        description: 'Returns all mattress dimension specs.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Size list' } },
      },
      post: {
        summary: 'Create Size',
        description: 'Creates a new size dimension (Super Admin only).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Size created' } },
      },
    },
    '/thicknesses': {
      get: {
        summary: 'List Thicknesses',
        description: 'Returns all mattress depth options.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Thickness list' } },
      },
      post: {
        summary: 'Create Thickness',
        description: 'Creates a new depth spec (Super Admin only).',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Thickness created' } },
      },
    },
    '/products': {
      get: {
        summary: 'List Products with SKUs',
        description: 'Paginated product catalogue with populated variants and 3-tier pricing.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Products catalogue' } },
      },
      post: {
        summary: 'Create Product & Variant (Simplified Flow)',
        description: 'Generates product name, unique SKU, stores integer-paisa 3-tier pricing, and opening stock balance.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Product & SKU created successfully' } },
      },
    },
    '/skus': {
      get: {
        summary: 'List All Saleable Variant SKUs',
        description: 'Returns active variants with specifications and pricing.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'SKU list' } },
      },
    },
    '/skus/{id}/prices': {
      get: {
        summary: 'Get SKU Price History',
        description: 'Returns complete price change audit history.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Price audit history' } },
      },
      patch: {
        summary: 'Update SKU Prices',
        description: 'Updates 3-tier pricing and records immutable price history.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Prices updated' } },
      },
    },
    '/inventory/stock': {
      get: {
        summary: 'Get Branch-Wise Stock Balances',
        tags: ['Inventory'],
        description: 'Returns branch-specific on-hand, reserved, and available stock levels.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Stock balances list' } },
      },
    },
    '/inventory/opening-stock': {
      post: {
        summary: 'Record Opening Stock Balance',
        tags: ['Inventory'],
        description: 'Records initial stock balance and creates immutable audit movement.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Opening stock recorded' } },
      },
    },
    '/inventory/receipts': {
      get: {
        summary: 'List Stock Receipts',
        tags: ['Inventory'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Stock receipts list' } },
      },
      post: {
        summary: 'Receive Stock into Location',
        tags: ['Inventory'],
        description: 'Increments stock on-hand atomically and records ledger movement.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Stock received' } },
      },
    },
    '/inventory/adjustments': {
      post: {
        summary: 'Reconcile Physical Stock (Manage Stock)',
        tags: ['Inventory'],
        description: 'Calculates delta from counted physical stock and posts adjustment movements.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Stock reconciled' } },
      },
    },
    '/inventory/transfers': {
      get: {
        summary: 'List Stock Transfers',
        tags: ['Inventory'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Transfers list' } },
      },
      post: {
        summary: 'Initiate Stock Transfer',
        tags: ['Inventory'],
        description: 'Creates branch-to-branch transfer request in PENDING_APPROVAL state.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Transfer created' } },
      },
    },
    '/inventory/transfers/{id}/approve': {
      post: {
        summary: 'Approve Stock Transfer',
        tags: ['Inventory'],
        description: 'Reserves source stock atomically.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Transfer approved' } },
      },
    },
    '/inventory/transfers/{id}/dispatch': {
      post: {
        summary: 'Dispatch Stock Transfer',
        tags: ['Inventory'],
        description: 'Deducts stock from source location; items become in-transit.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Transfer dispatched' } },
      },
    },
    '/inventory/transfers/{id}/receive': {
      post: {
        summary: 'Receive Stock Transfer',
        tags: ['Inventory'],
        description: 'Increases destination stock upon verified arrival.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Transfer received' } },
      },
    },
    '/inventory/movements': {
      get: {
        summary: 'Stock Movement Audit Ledger',
        tags: ['Inventory'],
        description: 'Returns immutable historical stock movements with before/after balances.',
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Movements ledger' } },
      },
    },
    '/inventory/alerts': {
      get: {
        summary: 'Stock Alerts (Low Stock & Out of Stock)',
        tags: ['Inventory'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Alerts list' } },
      },
    },
    '/inventory/summary': {
      get: {
        summary: 'Inventory High-Level Summary',
        tags: ['Inventory'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Summary metrics' } },
      },
    },
    '/pos/catalogue': {
      get: {
        summary: 'POS Product Catalogue & Three-Tier Prices',
        tags: ['POS'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'POS catalogue with sanitized prices' } },
      },
    },
    '/pos/products/{skuId}/availability': {
      get: {
        summary: 'POS SKU Stock Availability',
        tags: ['POS'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Available branch stock' } },
      },
    },
    '/pos/checkout': {
      post: {
        summary: 'Authoritative POS Checkout & Inventory Deduction',
        tags: ['POS'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: {
          '201': { description: 'Sale completed & stock deducted' },
          '400': { description: 'Insufficient stock or credit limit exceeded' },
        },
      },
    },
    '/pos/held-sales': {
      get: {
        summary: 'List Branch Held Sales',
        tags: ['POS'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Held carts' } },
      },
      post: {
        summary: 'Hold Sale Cart',
        tags: ['POS'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Cart held successfully' } },
      },
    },
    '/sales/invoices': {
      get: {
        summary: 'List Sales Invoices with Filters',
        tags: ['Sales'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Invoices list' } },
      },
    },
    '/sales/invoices/{id}': {
      get: {
        summary: 'Get Invoice Details',
        tags: ['Sales'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Invoice details' } },
      },
    },
    '/sales/invoices/{id}/receipt': {
      get: {
        summary: 'Get Printable Invoice Receipt',
        tags: ['Sales'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Printable receipt data' } },
      },
    },
    '/sales/summary': {
      get: {
        summary: 'Sales Summary Metrics (Separates Invoiced Revenue from Collections)',
        tags: ['Sales'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Sales metrics' } },
      },
    },
    '/customers': {
      get: {
        summary: 'List Customers',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Customers list' } },
      },
      post: {
        summary: 'Register New Customer',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Customer created' } },
      },
    },
    '/customers/{id}': {
      get: {
        summary: 'Get Customer Profile & Outstanding',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Customer profile' } },
      },
      patch: {
        summary: 'Update Customer Profile',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Customer updated' } },
      },
    },
    '/customers/{id}/ledger': {
      get: {
        summary: 'Customer Account Financial Ledger Statement',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Ledger entries' } },
      },
    },
    '/customers/{id}/outstanding': {
      get: {
        summary: 'Customer Outstanding Invoices',
        tags: ['Customers'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Unpaid / partial invoices' } },
      },
    },
    '/collections': {
      post: {
        summary: 'Post Customer Payment Collection & Invoice Allocation',
        tags: ['Collections'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '201': { description: 'Payment collected and allocated' } },
      },
      get: {
        summary: 'List Payment Collections',
        tags: ['Collections'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Collections list' } },
      },
    },
    '/collections/outstanding': {
      get: {
        summary: 'Outstanding Receivables Summary',
        tags: ['Collections'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Customer receivables' } },
      },
    },
    '/collections/overdue': {
      get: {
        summary: 'Overdue Receivables Summary',
        tags: ['Collections'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Overdue invoices' } },
      },
    },
    '/reports/dashboard/admin': {
      get: {
        summary: 'Consolidated Super Admin Business Dashboard',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Consolidated enterprise metrics' } },
      },
    },
    '/reports/dashboard/branch': {
      get: {
        summary: 'Branch Operational Dashboard',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Branch specific metrics' } },
      },
    },
    '/reports/sales/summary': {
      get: {
        summary: 'Sales Summary & Breakdown',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Sales summary metrics' } },
      },
    },
    '/reports/receivables/summary': {
      get: {
        summary: 'Customer Receivables Snapshot',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Receivables summary' } },
      },
    },
    '/reports/receivables/aging': {
      get: {
        summary: 'Customer Receivables Aging Schedule',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Aging schedule buckets' } },
      },
    },
    '/reports/inventory/summary': {
      get: {
        summary: 'Inventory Stock Summary',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Inventory stock metrics' } },
      },
    },
    '/reports/inventory/valuation': {
      get: {
        summary: 'Inventory Valuation Report (Cost Basis)',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Stock valuation metrics' } },
      },
    },
    '/reports/purchases/summary': {
      get: {
        summary: 'Purchasing & Procurement Summary',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Purchases summary metrics' } },
      },
    },
    '/reports/payables/summary': {
      get: {
        summary: 'Accounts Payable Summary',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Payables summary metrics' } },
      },
    },
    '/reports/reconciliation': {
      get: {
        summary: 'Cross-Module Financial Reconciliation Audit',
        tags: ['Reporting & Dashboards'],
        security: [{ cookieAuth: [] }, { bearerAuth: [] }],
        responses: { '200': { description: 'Audit result and discrepancy checks' } },
      },
    },
  },
};

