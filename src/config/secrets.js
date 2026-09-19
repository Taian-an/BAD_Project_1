// Resolves every production secret from Azure Key Vault at startup (proposal
// §7) instead of a committed/production .env. Local dev (no KEY_VAULT_URL
// set) reads the same values straight from process.env / .env.local instead.
async function loadSecrets() {
  if (!process.env.KEY_VAULT_URL) {
    return {
      databaseUrl: process.env.DATABASE_URL,
      jwtSecret: process.env.JWT_SECRET,
      adClientSecret: process.env.AD_CLIENT_SECRET,
      aiApiKey: process.env.AI_API_KEY,
      peerKeyOutHash: process.env.PEER_KEY_OUT_HASH,
      peerKeyIn: process.env.PEER_KEY_IN,
    };
  }

  // stderr, not stdout — deploy.sh captures this function's return value via
  // `node -e "...loadSecrets().then(s => process.stdout.write(s.xyz))"`, and
  // a stray console.log here would corrupt that captured value.
  console.error('Connecting to Azure Key Vault...');
  const { DefaultAzureCredential } = require('@azure/identity');
  const { SecretClient } = require('@azure/keyvault-secrets');

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(process.env.KEY_VAULT_URL, credential);

  const secretNames = {
    databaseUrl: 'campus-store-db-url',
    jwtSecret: 'campus-store-jwt-secret',
    adClientSecret: 'campus-store-ad-client-secret',
    aiApiKey: 'campus-store-ai-api-key',
    peerKeyOutHash: 'campus-store-peer-key-out-hash',
    peerKeyIn: 'campus-store-peer-key-in',
  };

  const entries = await Promise.all(
    Object.entries(secretNames).map(async ([key, secretName]) => {
      try {
        const secret = await client.getSecret(secretName);
        return [key, secret.value];
      } catch (error) {
        console.warn(`Key Vault secret "${secretName}" not available yet: ${error.message}`);
        return [key, undefined];
      }
    })
  );

  console.error('Secrets fetched from Key Vault.');
  return Object.fromEntries(entries);
}

module.exports = { loadSecrets };
