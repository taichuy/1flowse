use api_server::host_worker_registry::{HostWorkerDefinition, HostWorkerRegistry};

#[test]
fn registry_rejects_duplicate_worker_id() {
    let mut registry = HostWorkerRegistry::default();
    registry
        .register(test_worker("file-security.scan-worker"))
        .unwrap();

    let err = registry
        .register(test_worker("file-security.scan-worker"))
        .unwrap_err();

    assert!(err.to_string().contains("duplicate worker"));
}

#[test]
fn registry_requires_worker_queue() {
    let mut registry = HostWorkerRegistry::default();

    let err = registry
        .register(HostWorkerDefinition {
            queue: String::new(),
            ..test_worker("file-security.scan-worker")
        })
        .unwrap_err();

    assert!(err.to_string().contains("queue"));
}

#[test]
fn registry_rejects_registration_after_freeze() {
    let mut registry = HostWorkerRegistry::default();
    registry.freeze();

    let err = registry
        .register(test_worker("file-security.scan-worker"))
        .unwrap_err();

    assert!(err.to_string().contains("frozen"));
}

#[test]
fn registry_returns_registered_workers_after_freeze() {
    let mut registry = HostWorkerRegistry::default();
    registry
        .register(test_worker("file-security.scan-worker"))
        .unwrap();
    registry.freeze();

    let workers = registry.workers();

    assert_eq!(workers.len(), 1);
    assert_eq!(workers[0].worker_id, "file-security.scan-worker");
}

fn test_worker(worker_id: &str) -> HostWorkerDefinition {
    HostWorkerDefinition {
        extension_id: "file-security".into(),
        worker_id: worker_id.into(),
        queue: "file-security.scan".into(),
        handler: "scan_file".into(),
    }
}
