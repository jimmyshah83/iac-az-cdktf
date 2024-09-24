data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "rg" {
  name     = "js-eus-cdktf-aoai-01"
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
}

resource "azurerm_key_vault" "example" {
  name                     = "js-cdktf-example-vault"
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
    update = "30m"
    delete = "30m"
  }
}