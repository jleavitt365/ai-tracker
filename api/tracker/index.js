const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT;
const ACCOUNT_KEY  = process.env.AZURE_STORAGE_KEY;
const TABLE_NAME   = 'AITracker';
const PARTITION    = 'tracker';
const ROW          = 'main';

function getClient() {
  const cred = new AzureNamedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
  return new TableClient(
    `https://${ACCOUNT_NAME}.table.core.windows.net`,
    TABLE_NAME,
    cred
  );
}

module.exports = async function(context, req) {
  const method = req.method.toUpperCase();

  // Validate token (Azure Static Web Apps injects /.auth/me automatically)
  const clientPrincipal = req.headers['x-ms-client-principal'];
  if (!clientPrincipal) {
    context.res = { status: 401, body: { error: 'Unauthorized' } };
    return;
  }

  try {
    const client = getClient();

    if (method === 'GET') {
      try {
        const entity = await client.getEntity(PARTITION, ROW);
        const depts = JSON.parse(entity.data || '[]');
        context.res = { status: 200, body: { depts } };
      } catch(e) {
        // Table or entity doesn't exist yet — return empty
        context.res = { status: 200, body: { depts: [] } };
      }

    } else if (method === 'POST') {
      const { depts, updatedBy, updatedAt } = req.body;
      await client.upsertEntity({
        partitionKey: PARTITION,
        rowKey: ROW,
        data: JSON.stringify(depts),
        updatedBy: updatedBy || 'unknown',
        updatedAt: updatedAt || new Date().toISOString()
      }, 'Replace');
      context.res = { status: 200, body: { ok: true } };

    } else {
      context.res = { status: 405, body: { error: 'Method not allowed' } };
    }

  } catch(e) {
    console.error('API error:', e);
    context.res = { status: 500, body: { error: e.message } };
  }
};
