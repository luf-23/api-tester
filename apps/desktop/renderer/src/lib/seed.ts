import type { Collection, RequestWithTests } from '@api-tester/shared'
import { uid } from './ids'

function req(
  name: string,
  method: RequestWithTests['method'],
  url: string,
  partial: Partial<RequestWithTests> = {}
): RequestWithTests {
  return {
    id: uid('req'),
    name,
    method,
    url,
    params: [],
    headers: [],
    bodyMode: 'none',
    bodyText: '',
    bodyFields: [],
    tests: [],
    ...partial,
  }
}

const getUsers: RequestWithTests = req('Get Users', 'GET', 'https://api.acme.dev/v1/users?limit=20&role=admin', {
  params: [
    { id: uid('kv'), key: 'limit', value: '20', enabled: true },
    { id: uid('kv'), key: 'role', value: 'admin', enabled: true },
    { id: uid('kv'), key: 'page', value: '1', enabled: false },
    { id: uid('kv'), key: 'sort', value: 'created_at:desc', enabled: false },
  ],
  headers: [
    { id: uid('kv'), key: 'Accept', value: 'application/json', enabled: true },
    { id: uid('kv'), key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
    { id: uid('kv'), key: 'X-Workspace', value: '{{workspaceId}}', enabled: true },
    { id: uid('kv'), key: 'X-Request-Id', value: '{{requestId}}', enabled: true },
    { id: uid('kv'), key: 'Accept-Encoding', value: 'gzip', enabled: true },
    { id: uid('kv'), key: 'Cache-Control', value: 'no-cache', enabled: true },
    { id: uid('kv'), key: 'User-Agent', value: 'JadeAPI/1.0', enabled: true },
    { id: uid('kv'), key: 'X-Env', value: '{{env}}', enabled: true },
  ],
  tests: [
    { id: uid('a'), type: 'status', expected: 200, operator: 'eq' },
    { id: uid('a'), type: 'header', target: 'content-type', operator: 'contains', expected: 'application/json' },
    { id: uid('a'), type: 'json_path', target: '$.success', operator: 'eq', expected: 'true' },
  ],
})

export const sampleCollection: Collection = {
  id: 'col_acme',
  name: 'Acme API',
  root: {
    id: 'root_acme',
    name: 'Acme API',
    children: [
      {
        id: 'fld_users',
        name: 'Users',
        children: [
          getUsers,
          req('Create User', 'POST', 'https://api.acme.dev/v1/users', {
            bodyMode: 'json',
            bodyText: JSON.stringify(
              { name: 'Jane Cooper', email: 'jane@acme.dev', role: 'admin' },
              null,
              2
            ),
          }),
          req('Update User', 'PUT', 'https://api.acme.dev/v1/users/{{userId}}'),
          req('Delete User', 'DELETE', 'https://api.acme.dev/v1/users/{{userId}}'),
          req('Get User by ID', 'GET', 'https://api.acme.dev/v1/users/{{userId}}'),
          req('Search Users', 'GET', 'https://api.acme.dev/v1/users:search?q=jane'),
        ],
      },
      {
        id: 'fld_orders',
        name: 'Orders',
        children: [
          req('List Orders', 'GET', 'https://api.acme.dev/v1/orders'),
          req('Get Order', 'GET', 'https://api.acme.dev/v1/orders/{{orderId}}'),
          req('Create Order', 'POST', 'https://api.acme.dev/v1/orders'),
          req('Update Order', 'PUT', 'https://api.acme.dev/v1/orders/{{orderId}}'),
          req('Cancel Order', 'POST', 'https://api.acme.dev/v1/orders/{{orderId}}:cancel'),
          req('Refund Order', 'POST', 'https://api.acme.dev/v1/orders/{{orderId}}:refund'),
          req('Order Events', 'GET', 'https://api.acme.dev/v1/orders/{{orderId}}/events'),
        ],
      },
      {
        id: 'fld_products',
        name: 'Products',
        children: [
          req('List Products', 'GET', 'https://api.acme.dev/v1/products'),
          req('Get Product', 'GET', 'https://api.acme.dev/v1/products/{{productId}}'),
          req('Create Product', 'POST', 'https://api.acme.dev/v1/products'),
          req('Update Product', 'PUT', 'https://api.acme.dev/v1/products/{{productId}}'),
          req('Delete Product', 'DELETE', 'https://api.acme.dev/v1/products/{{productId}}'),
        ],
      },
      {
        id: 'fld_auth',
        name: 'Auth',
        children: [
          req('Login', 'POST', 'https://api.acme.dev/v1/auth/login'),
          req('Refresh Token', 'POST', 'https://api.acme.dev/v1/auth/refresh'),
          req('Logout', 'POST', 'https://api.acme.dev/v1/auth/logout'),
          req('Whoami', 'GET', 'https://api.acme.dev/v1/auth/whoami'),
        ],
      },
      {
        id: 'fld_billing',
        name: 'Billing',
        children: [
          req('List Invoices', 'GET', 'https://api.acme.dev/v1/billing/invoices'),
          req('Pay Invoice', 'POST', 'https://api.acme.dev/v1/billing/invoices/{{invoiceId}}:pay'),
        ],
      },
    ],
  },
}

export const sampleResponseBody = JSON.stringify(
  {
    success: true,
    data: [
      {
        id: 'usr_01H7X3K8QZ7P8ZJ9Y3MZ8A1B2C',
        name: 'Jane Cooper',
        email: 'jane.cooper@acme.dev',
        role: 'admin',
        created_at: '2024-05-18T14:23:11Z',
      },
      {
        id: 'usr_01H7X3K8QZ7P8ZJ9Y3MZ8A1B2D',
        name: 'Wade Warren',
        email: 'wade.warren@acme.dev',
        role: 'admin',
        created_at: '2024-05-12T09:11:02Z',
      },
    ],
    meta: { page: 1, limit: 20, total: 26 },
  },
  null,
  2
)

export function getInitialRequestId(): string {
  return getUsers.id
}
