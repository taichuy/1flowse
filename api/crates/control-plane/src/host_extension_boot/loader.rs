use std::collections::{BTreeMap, BTreeSet};

use crate::errors::ControlPlaneError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionLoadPlanItem {
    pub extension_id: String,
    pub after: Vec<String>,
}

pub fn build_host_extension_load_plan(
    items: Vec<HostExtensionLoadPlanItem>,
) -> anyhow::Result<Vec<HostExtensionLoadPlanItem>> {
    let by_id = items
        .into_iter()
        .map(|item| (item.extension_id.clone(), item))
        .collect::<BTreeMap<_, _>>();
    let mut resolved = Vec::new();
    let mut visited = BTreeSet::new();
    let mut visiting = BTreeSet::new();

    for id in by_id.keys() {
        visit(id, &by_id, &mut visiting, &mut visited, &mut resolved)?;
    }

    Ok(resolved)
}

fn visit(
    id: &str,
    by_id: &BTreeMap<String, HostExtensionLoadPlanItem>,
    visiting: &mut BTreeSet<String>,
    visited: &mut BTreeSet<String>,
    resolved: &mut Vec<HostExtensionLoadPlanItem>,
) -> anyhow::Result<()> {
    if visited.contains(id) {
        return Ok(());
    }
    if !visiting.insert(id.to_string()) {
        return Err(ControlPlaneError::Conflict("host_extension_dependency_cycle").into());
    }
    let item = by_id
        .get(id)
        .ok_or(ControlPlaneError::NotFound("host_extension_dependency"))?;
    for dependency in &item.after {
        if !by_id.contains_key(dependency) {
            anyhow::bail!("host_extension_dependency not found: {dependency}");
        }
        visit(dependency, by_id, visiting, visited, resolved)?;
    }
    visiting.remove(id);
    visited.insert(id.to_string());
    resolved.push(item.clone());
    Ok(())
}
