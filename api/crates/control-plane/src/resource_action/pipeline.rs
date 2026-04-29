#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ActionHookStage {
    BeforeValidate,
    BeforeAuthorize,
    BeforeExecute,
    AfterExecute,
    AfterCommit,
    OnFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionHookResult {
    Continue,
    Deny { code: String, message: String },
    Warning { code: String, message: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionHookDefinition {
    pub stage: ActionHookStage,
    pub priority: i32,
    pub extension_id: String,
    pub hook_code: String,
    pub result: ActionHookResult,
}

impl ActionHookDefinition {
    pub fn new(
        stage: ActionHookStage,
        priority: i32,
        extension_id: impl Into<String>,
        hook_code: impl Into<String>,
        result: ActionHookResult,
    ) -> Self {
        Self {
            stage,
            priority,
            extension_id: extension_id.into(),
            hook_code: hook_code.into(),
            result,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionHookDeny {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionHookWarning {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionPipelineOutcome<T> {
    pub output: Option<T>,
    pub denied: Option<ActionHookDeny>,
    pub warnings: Vec<ActionHookWarning>,
}

#[derive(Debug, Clone, Default)]
pub struct ActionPipeline {
    hooks: Vec<ActionHookDefinition>,
}

impl ActionPipeline {
    pub fn new(mut hooks: Vec<ActionHookDefinition>) -> Self {
        hooks.sort_by(|left, right| {
            left.stage
                .cmp(&right.stage)
                .then_with(|| left.priority.cmp(&right.priority))
                .then_with(|| left.extension_id.cmp(&right.extension_id))
                .then_with(|| left.hook_code.cmp(&right.hook_code))
        });
        Self { hooks }
    }

    pub fn ordered_hooks(&self) -> &[ActionHookDefinition] {
        &self.hooks
    }

    pub fn execute<T>(&self, execute: impl FnOnce() -> T) -> ActionPipelineOutcome<T> {
        let mut warnings = Vec::new();

        for hook in self.hooks.iter().filter(|hook| hook.stage <= ActionHookStage::BeforeExecute) {
            match &hook.result {
                ActionHookResult::Continue => {}
                ActionHookResult::Deny { code, message } => {
                    return ActionPipelineOutcome {
                        output: None,
                        denied: Some(ActionHookDeny {
                            code: code.clone(),
                            message: message.clone(),
                        }),
                        warnings,
                    };
                }
                ActionHookResult::Warning { code, message } => {
                    warnings.push(ActionHookWarning {
                        code: code.clone(),
                        message: message.clone(),
                    });
                }
            }
        }

        let output = execute();

        for hook in self.hooks.iter().filter(|hook| hook.stage > ActionHookStage::BeforeExecute) {
            match &hook.result {
                ActionHookResult::Continue => {}
                ActionHookResult::Deny { code, message }
                | ActionHookResult::Warning { code, message } => {
                    warnings.push(ActionHookWarning {
                        code: code.clone(),
                        message: message.clone(),
                    });
                }
            }
        }

        ActionPipelineOutcome {
            output: Some(output),
            denied: None,
            warnings,
        }
    }
}
