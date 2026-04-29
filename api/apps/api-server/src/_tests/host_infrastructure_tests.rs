#[test]
fn local_infra_host_provides_required_defaults() {
    let registry = crate::host_infrastructure::build_local_host_infrastructure();

    assert_eq!(
        registry.default_provider("storage-ephemeral").unwrap(),
        "local"
    );
    assert_eq!(registry.default_provider("cache-store").unwrap(), "local");
    assert_eq!(registry.default_provider("event-bus").unwrap(), "local");
    assert!(registry.session_store().is_some());
}

#[test]
fn duplicate_default_provider_is_rejected() {
    let mut registry = crate::host_infrastructure::HostInfrastructureRegistry::default();
    registry
        .register_default_provider("storage-ephemeral", "local", "local-infra-host")
        .unwrap();
    let err = registry
        .register_default_provider("storage-ephemeral", "redis", "redis-infra-host")
        .unwrap_err();

    assert!(err.to_string().contains("default provider"));
}

#[tokio::test]
async fn local_infra_host_exposes_operation_contracts() {
    let registry = crate::host_infrastructure::build_local_host_infrastructure();

    let cache = registry.cache_store();
    cache
        .set_json(
            "provider-catalog",
            serde_json::json!({ "cached": true }),
            None,
        )
        .await
        .unwrap();
    assert_eq!(
        cache.get_json("provider-catalog").await.unwrap(),
        Some(serde_json::json!({ "cached": true }))
    );

    assert!(!registry
        .distributed_lock()
        .release("missing", "owner")
        .await
        .unwrap());

    let events = registry.event_bus();
    events
        .publish("runtime.debug", serde_json::json!({ "run": "1" }))
        .await
        .unwrap();
    assert_eq!(
        events.poll("runtime.debug").await.unwrap(),
        Some(serde_json::json!({ "run": "1" }))
    );

    assert!(
        registry
            .rate_limit_store()
            .consume("actor:1", 5, time::Duration::seconds(60))
            .await
            .unwrap()
            .allowed
    );

    let tasks = registry.task_queue();
    let first = tasks
        .enqueue(
            "preview",
            serde_json::json!({ "file": "a" }),
            Some("preview:file:a"),
        )
        .await
        .unwrap();
    let second = tasks
        .enqueue(
            "preview",
            serde_json::json!({ "file": "a" }),
            Some("preview:file:a"),
        )
        .await
        .unwrap();
    assert_eq!(first, second);
}
