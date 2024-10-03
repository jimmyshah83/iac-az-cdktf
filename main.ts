import { Construct } from 'constructs';
import { App, TerraformStack } from 'cdktf';
import { AzurermProvider } from '@cdktf/provider-azurerm/lib/provider';
import { ResourceGroup } from '@cdktf/provider-azurerm/lib/resource-group';
import { CognitiveAccount } from '@cdktf/provider-azurerm/lib/cognitive-account';
import { KeyVault } from '@cdktf/provider-azurerm/lib/key-vault';
import { KeyVaultKey } from '@cdktf/provider-azurerm/lib/key-vault-key';
import { CognitiveAccountCustomerManagedKeyA as CognitiveAccountCustomerManagedKey } from '@cdktf/provider-azurerm/lib/cognitive-account-customer-managed-key';
import { DataAzurermClientConfig } from '@cdktf/provider-azurerm/lib/data-azurerm-client-config';
import { VirtualNetwork } from '@cdktf/provider-azurerm/lib/virtual-network';
import { Subnet } from './src/providers/azurerm/subnet';
import { PrivateEndpoint } from '@cdktf/provider-azurerm/lib/private-endpoint';
import { PrivateDnsZone } from './src/providers/azurerm/private-dns-zone';
import { PrivateDnsARecord } from './src/providers/azurerm/private-dns-a-record';
import { PrivateDnsZoneVirtualNetworkLink } from './src/providers/azurerm/private-dns-zone-virtual-network-link';
import { CognitiveDeployment } from './src/providers/azurerm/cognitive-deployment';

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
      name: 'js-cc-cdktf-aoai-01',
      location: 'canadacentral' 
    });

    // Define the Cognitive Account
    const cognitiveAccount = new CognitiveAccount(this, 'cdktf-cs', {
        name: 'cc-aoai-cdktf-01',
        location: resourceGroup.location,
        resourceGroupName: resourceGroup.name,
        kind: 'OpenAI',
        skuName: 'S0',
        identity: {
            type: 'SystemAssigned'
        },
        publicNetworkAccessEnabled: false,
        customSubdomainName: 'cc-aoai-cdktf-01', 
    });    

    const cognitiveDeployment = new CognitiveDeployment(this, 'cdktf-cd', {
      cognitiveAccountId: cognitiveAccount.id,
      name: 'gpt-4o',
      model: {
        name: 'gpt-4o',
        format: 'OpenAI',
      },
      sku: {
        name: 'S0'
      },
    });

    // Define the Key Vault
    const keyVault = new KeyVault(this, 'cdktf-kv', {
      name: 'js-cc-cdktf-kv',
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
      name: 'cdktf-key-01',
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
    
    // Define the Virtual Network
    const vnet = new VirtualNetwork(this, 'cdktf-vnet', {
      name: 'cdktf-vnet',
      location: resourceGroup.location,
      resourceGroupName: resourceGroup.name,
      addressSpace: ['10.0.0.0/27']
    });

    const subnet = new Subnet(this, 'cdktf-subnet', {
      name: 'cdktf-subnet',
      resourceGroupName: resourceGroup.name,
      virtualNetworkName: vnet.name,
      addressPrefixes: ['10.0.0.0/28']
    });

    // Define the Private DNS Zone
    const privateDnsZone = new PrivateDnsZone(this, 'cdktf-private-dns-zone', {
      name: 'privatelink.cognitiveservices.azure.com',
      resourceGroupName: resourceGroup.name
    });

    // Deine the DNZ zone virtual network link
    const dnsZoneVnetLink = new PrivateDnsZoneVirtualNetworkLink(this, 'cdktf-dns-zone-vnet-link', {
      name: 'cdktf-dns-zone-vnet-link',
      resourceGroupName: resourceGroup.name,
      privateDnsZoneName: privateDnsZone.name,
      virtualNetworkId: vnet.id
    });

    const privateEndpoint = new PrivateEndpoint(this, 'cdktf-private-endpoint', {
      name: 'cdktf-private-endpoint',
      location: resourceGroup.location,
      resourceGroupName: resourceGroup.name,
      subnetId: subnet.id,
      privateServiceConnection: {
          name: 'cdktf-private-endpoint-connection',
          privateConnectionResourceId: cognitiveAccount.id,
          subresourceNames: ['account'],
          isManualConnection: false,
        },
        privateDnsZoneGroup: {
          name: 'cdktf-private-endpoint-dns-zone-group',
          privateDnsZoneIds: [privateDnsZone.id]
        },
        dependsOn: [dnsZoneVnetLink]
    });
  }
}

const app = new App();
new MyStack(app, 'cdktf-azure');
app.synth();