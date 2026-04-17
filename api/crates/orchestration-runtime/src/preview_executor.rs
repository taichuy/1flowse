use anyhow::{anyhow, Result};
use serde_json::{json, Map, Value};

use crate::{
    binding_runtime::{render_templated_bindings, resolve_node_inputs},
    compiled_plan::CompiledPlan,
};

pub struct NodePreviewOutcome {
    pub target_node_id: String,
    pub resolved_inputs: Map<String, Value>,
    pub rendered_templates: Map<String, Value>,
    pub output_contract: Vec<Value>,
}

impl NodePreviewOutcome {
    pub fn as_payload(&self) -> Value {
        json!({
            "target_node_id": self.target_node_id,
            "resolved_inputs": self.resolved_inputs,
            "rendered_templates": self.rendered_templates,
            "output_contract": self.output_contract,
        })
    }
}

pub fn run_node_preview(
    plan: &CompiledPlan,
    target_node_id: &str,
    input_payload: &Value,
) -> Result<NodePreviewOutcome> {
    let node = plan
        .nodes
        .get(target_node_id)
        .ok_or_else(|| anyhow!("target node not found: {target_node_id}"))?;
    let variable_pool = input_payload
        .as_object()
        .cloned()
        .ok_or_else(|| anyhow!("input payload must be an object"))?;
    let resolved_inputs = resolve_node_inputs(node, &variable_pool)?;
    let rendered_templates = render_templated_bindings(node, &resolved_inputs);
    let output_contract = node
        .outputs
        .iter()
        .map(|output| {
            json!({
                "key": output.key,
                "title": output.title,
                "value_type": output.value_type,
            })
        })
        .collect();

    Ok(NodePreviewOutcome {
        target_node_id: node.node_id.clone(),
        resolved_inputs,
        rendered_templates,
        output_contract,
    })
}
