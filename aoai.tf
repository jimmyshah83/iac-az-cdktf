data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "rg" {
  name     = "js-eus-cdktf-aoai-02"
  location = var.location
}

resource "azurerm_cognitive_account" "example" {
  name                = "aoai-cdktf"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "OpenAI"
  sku_name            = "S0"  
  identity {
    type = "SystemAssigned" 
  }
  public_network_access_enabled = false
  custom_subdomain_name = var.custom_subdomain_name
}

resource "azurerm_key_vault" "example" {
  name                     = "js-cdktf-example-kv"
  location                 = azurerm_resource_group.rg.location
  resource_group_name      = azurerm_resource_group.rg.name
  tenant_id                = data.azurerm_client_config.current.tenant_id
  sku_name                 = "standard"
  purge_protection_enabled = true

  access_policy {
    tenant_id = azurerm_cognitive_account.example.identity[0].tenant_id
    object_id = azurerm_cognitive_account.example.identity[0].principal_id
    key_permissions = [
      "Get", "Create", "List", "Restore", "Recover", "UnwrapKey", "WrapKey", "Purge", "Encrypt", "Decrypt", "Sign", "Verify"
    ]
    secret_permissions = [
      "Get",
    ]
  }

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id
    key_permissions = [
      "Get", "Create", "Delete", "List", "Restore", "Recover", "UnwrapKey", "WrapKey", "Purge", "Encrypt", "Decrypt", "Sign", "Verify", "GetRotationPolicy"
    ]
    secret_permissions = [
      "Get",
    ]
  }
}

resource "azurerm_key_vault_key" "example" {
  name         = "example-key"
  key_vault_id = azurerm_key_vault.example.id
  key_type     = "RSA"
  key_size     = 2048
  key_opts     = ["decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"]
}

resource "azurerm_cognitive_account_customer_managed_key" "example" {
  cognitive_account_id = azurerm_cognitive_account.example.id
  key_vault_key_id     = azurerm_key_vault_key.example.id
  timeouts {
    create = "500m"
    update = "500m"
    delete = "500m"
  }
}

resource "azurerm_virtual_network" "example" {
  name                = "example-vnet"
  address_space       = ["10.0.0.0/27"]
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "example" {
  name                 = "example-subnet"
  resource_group_name  = azurerm_virtual_network.example.resource_group_name
  virtual_network_name = azurerm_virtual_network.example.name
address_prefixes     = ["10.0.0.0/28"]
}

resource "azurerm_private_dns_zone" "example" {
  name                = "privatelink.cognitiveservices.azure.com"
  resource_group_name = azurerm_cognitive_account.example.resource_group_name
}

resource "azurerm_private_dns_zone_virtual_network_link" "example" {
  name                  = "example-link"
  resource_group_name   = azurerm_cognitive_account.example.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.example.name
  virtual_network_id    = azurerm_virtual_network.example.id
}

resource "azurerm_private_endpoint" "example" {
  name                = "example-private-endpoint"
  location            = azurerm_cognitive_account.example.location
  resource_group_name = azurerm_cognitive_account.example.resource_group_name
  subnet_id           = azurerm_subnet.example.id

  private_service_connection {
    name                           = "example-privateserviceconnection"
    private_connection_resource_id = azurerm_cognitive_account.example.id
    subresource_names              = ["account"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name            = "example-dnszonegroup"
    private_dns_zone_ids = [
        azurerm_private_dns_zone.example.id
    ]
  }

   depends_on = [ azurerm_private_dns_zone.example ]
}