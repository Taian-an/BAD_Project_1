#!/bin/bash
# deploy.sh — deploys CampusStore as a second, independent app on the same
# Azure VM used for the Lab. Never touches the Lab's PM2 process ("bad-vps-01"),
# Nginx blocks, or "store" database (proposal §10).

VM_USER="azureuser"
VM_HOST="20.205.26.198"
KEY_PATH="../bad-vps-01_key.pem"
TARGET_DIR="~/campus-store"
PM2_APP_NAME="campus-store-api"

echo "Step 1: Transferring CampusStore files to Azure VM..."
ssh -i "$KEY_PATH" "$VM_USER@$VM_HOST" "mkdir -p $TARGET_DIR"
scp -r -i "$KEY_PATH" src package.json package-lock.json prisma "$VM_USER@$VM_HOST:$TARGET_DIR/"

echo "Step 2: Installing deps, running migrations, restarting PM2..."
ssh -i "$KEY_PATH" "$VM_USER@$VM_HOST" << EOF
    cd $TARGET_DIR
    npm ci --omit=dev
    npx prisma generate

    # prisma migrate deploy needs DATABASE_URL directly (it doesn't run our
    # Key Vault loader) — pull it from Key Vault via the same secrets.js the
    # app uses, so no connection string ever lands in this script or a file.
    export DATABASE_URL=$(KEY_VAULT_URL=https://csx4110-kv.vault.azure.net/ node -e "require('./src/config/secrets').loadSecrets().then(s => process.stdout.write(s.databaseUrl))")
    npx prisma migrate deploy

    KEY_VAULT_URL=https://csx4110-kv.vault.azure.net/ PORT=4002 BASE_PATH=/campus-store pm2 restart $PM2_APP_NAME --update-env || \
    KEY_VAULT_URL=https://csx4110-kv.vault.azure.net/ PORT=4002 BASE_PATH=/campus-store pm2 start src/server.js --name $PM2_APP_NAME
EOF

echo "Deployment complete! CampusStore is live under /campus-store on the shared VM."
