use std::collections::{BTreeMap, BTreeSet};

use crate::errors::ControlPlaneError;
use plugin_framework::HostExtensionBootstrapPhase;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionLoadPlanItem {
    pub extension_id: String,
    pub bootstrap_phase: HostExtensionBootstrapPhase,
    pub after: Vec<String>,
}

pub fn build_host_extension_load_plan(
    items: Vec<HostExtensionLoadPlanItem>,
) -> anyhow::Result<Vec<HostExtensionLoadPlanItem>> {
    let mut by_id = BTreeMap::new();
    for item in items {
        if by_id.insert(item.extension_id.clone(), item).is_some() {
            return Err(ControlPlaneError::Conflict("duplicate_host_extension").into());
        }
    }

    let mut indegree = BTreeMap::new();
    let mut dependents = BTreeMap::<String, Vec<String>>::new();
    for (id, item) in &by_id {
        indegree.insert(id.clone(), item.after.len());
        for dependency in &item.after {
            if !by_id.contains_key(dependency) {
                anyhow::bail!("host_extension_dependency not found: {dependency}");
            }
            dependents
                .entry(dependency.clone())
                .or_default()
                .push(id.clone());
        }
    }

    let mut ready = by_id
        .iter()
        .filter_map(|(id, item)| {
            item.after
                .is_empty()
                .then_some((phase_rank(item.bootstrap_phase), id.clone()))
        })
        .collect::<BTreeSet<_>>();
    let mut resolved = Vec::new();

    while let Some((_, id)) = ready.pop_first() {
        let item = by_id
            .get(&id)
            .ok_or(ControlPlaneError::NotFound("host_extension_dependency"))?;
        resolved.push(item.clone());

        for dependent in dependents.remove(&id).unwrap_or_default() {
            let dependency_count = indegree
                .get_mut(&dependent)
                .ok_or(ControlPlaneError::NotFound("host_extension_dependency"))?;
            *dependency_count -= 1;
            if *dependency_count == 0 {
                let dependent_item = by_id
                    .get(&dependent)
                    .ok_or(ControlPlaneError::NotFound("host_extension_dependency"))?;
                ready.insert((
                    phase_rank(dependent_item.bootstrap_phase),
                    dependent.clone(),
                ));
            }
        }
    }

    if resolved.len() != by_id.len() {
        return Err(ControlPlaneError::Conflict("host_extension_dependency_cycle").into());
    }

    Ok(resolved)
}

fn phase_rank(phase: HostExtensionBootstrapPhase) -> u8 {
    match phase {
        HostExtensionBootstrapPhase::PreState => 0,
        HostExtensionBootstrapPhase::Boot => 1,
    }
}
