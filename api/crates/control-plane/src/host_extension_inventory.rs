use anyhow::Result;

use crate::ports::HostExtensionInventoryRepository;

pub struct HostExtensionInventoryService<R> {
    repository: R,
}

impl<R> HostExtensionInventoryService<R>
where
    R: HostExtensionInventoryRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_inventory(&self) -> Result<Vec<domain::HostExtensionInventoryRecord>> {
        let mut records = self.repository.list_host_extension_inventory().await?;
        records.sort_by(|left, right| left.extension_id.cmp(&right.extension_id));
        Ok(records)
    }
}
