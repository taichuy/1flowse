use async_trait::async_trait;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    host_extension_inventory::HostExtensionInventoryService,
    ports::{HostExtensionInventoryRepository, UpsertHostExtensionInventoryInput},
};

struct FakeHostExtensionInventoryRepository {
    records: Vec<domain::HostExtensionInventoryRecord>,
}

#[async_trait]
impl HostExtensionInventoryRepository for FakeHostExtensionInventoryRepository {
    async fn upsert_host_extension_inventory(
        &self,
        _input: &UpsertHostExtensionInventoryInput,
    ) -> anyhow::Result<domain::HostExtensionInventoryRecord> {
        anyhow::bail!("upsert should not be called by list_inventory")
    }

    async fn list_host_extension_inventory(
        &self,
    ) -> anyhow::Result<Vec<domain::HostExtensionInventoryRecord>> {
        Ok(self.records.clone())
    }
}

#[tokio::test]
async fn host_extension_inventory_list_is_sorted_by_extension_id() {
    let service = HostExtensionInventoryService::new(FakeHostExtensionInventoryRepository {
        records: vec![
            inventory_record("official.storage-host"),
            inventory_record("official.auth-host"),
            inventory_record("official.data-access-host"),
        ],
    });

    let records = service.list_inventory().await.expect("list succeeds");
    let extension_ids = records
        .into_iter()
        .map(|record| record.extension_id)
        .collect::<Vec<_>>();

    assert_eq!(
        extension_ids,
        vec![
            "official.auth-host",
            "official.data-access-host",
            "official.storage-host"
        ]
    );
}

fn inventory_record(extension_id: &str) -> domain::HostExtensionInventoryRecord {
    domain::HostExtensionInventoryRecord {
        id: Uuid::nil(),
        extension_id: extension_id.to_string(),
        version: "0.1.0".to_string(),
        display_name: extension_id.to_string(),
        source_kind: "builtin".to_string(),
        trust_level: domain::HostExtensionTrustLevel::TrustedHost,
        activation_status: domain::HostExtensionActivationStatus::Active,
        provides_contracts: Vec::new(),
        overrides_contracts: Vec::new(),
        registers_slots: Vec::new(),
        registers_storage: Vec::new(),
        last_error: None,
        created_at: OffsetDateTime::UNIX_EPOCH,
        updated_at: OffsetDateTime::UNIX_EPOCH,
    }
}
