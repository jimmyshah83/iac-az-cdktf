import { Construct } from 'constructs';
import { App, TerraformStack } from 'cdktf';
import { AzurermProvider } from '@cdktf/provider-azurerm/lib/provider';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group';
import { CognitiveAccount } from '@cdktf/provider-azurerm/lib/cognitive-account';
import { KeyVault } from '@cdktf/provider-azurerm/lib/key-vault';
import { KeyVaultKey } from '@cdktf/provider-azurerm/lib/key-vault-key';
import { CognitiveAccountCustomerManagedKeyA as CognitiveAccountCustomerManagedKey } from '@cdktf/provider-azurerm/lib/cognitive-account-customer-managed-key';
import { DataAzurermClientConfig } from '@cdktf/provider-azurerm/lib/data-azurerm-client-config';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Define the Azure provider
    new AzurermProvider(this, "AzureRm", {
        features: [{}], 
        subscriptionId: "1d8a3971-973e-4b52-841b-16614e79c84f",
      })

    // Get the current client configuration
    const current = new DataAzurermClientConfig(this, 'current');

    // Define the Resource Group
    const resourceGroup = new ResourceGroup(this, 'rg', {
      name: 'js-eus-cdktf-aoai-03',
      location: 'eastus' 
    });

    // Define the Cognitive Account
    const cognitiveAccount = new CognitiveAccount(this, 'cdktf-cs', {
        name: 'aoai-cdktf-03',
        location: resourceGroup.location,
        resourceGroupName: resourceGroup.name,
        kind: 'OpenAI',
        skuName: 'S0',
        identity: {
            type: 'SystemAssigned'
        },
        publicNetworkAccessEnabled: false,
        customSubdomainName: 'aoai-cdktf-03', 
    });

    // Define the Key Vault
    const keyVault = new KeyVault(this, 'cdktf-kv', {
      name: 'js-eus-cdktf-kv',
      location: resourceGroup.location,
      resourceGroupName: resourceGroup.name,
      tenantId: current.tenantId,
      skuName: 'standard',
      purgeProtectionEnabled: true,
      accessPolicy: [
        {
          tenantId: cognitiveAccount.identity.tenantId,
          objectId: cognitiveAccount.identity.principalId,
          keyPermissions: [
            'Get', 'Create', 'List', 'Restore', 'Recover', 'UnwrapKey', 'WrapKey', 'Purge', 'Encrypt', 'Decrypt', 'Sign', 'Verify'
          ],
          secretPermissions: ['Get']
        },
        {
          tenantId: current.tenantId,
          objectId: current.objectId,
          keyPermissions: [
            'Get', 'Create', 'Delete', 'List', 'Restore', 'Recover', 'UnwrapKey', 'WrapKey', 'Purge', 'Encrypt', 'Decrypt', 'Sign', 'Verify', 'GetRotationPolicy'
          ],
          secretPermissions: ['Get']
        }
      ]
    });

    // Define the Key Vault Key
    const keyVaultKey = new KeyVaultKey(this, 'cdktf-kv-key', {
      name: 'cdktf-key-03',
      keyVaultId: keyVault.id,
      keyType: 'RSA',
      keySize: 2048,
      keyOpts: ['decrypt', 'encrypt', 'sign', 'unwrapKey', 'verify', 'wrapKey']
    });

    // Define the Cognitive Account Customer Managed Key
    new CognitiveAccountCustomerManagedKey(this, 'cdktf-cmk', {
      cognitiveAccountId: cognitiveAccount.id,
      keyVaultKeyId: keyVaultKey.id,
      timeouts: {
        create: '500m',
        update: '500m'
      }
    });
  }
}

const app = new App();
new MyStack(app, 'cdktf-azure');
app.synth();