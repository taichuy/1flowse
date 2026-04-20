use crate::_tests::support::MemoryAuthRepository;
use crate::system_runtime::SystemRuntimeService;

#[tokio::test]
async fn authorize_view_requires_system_runtime_permission_for_non_root() {
    let store = MemoryAuthRepository::scoped_user(&["plugin_config.view.all"]);
    let service = SystemRuntimeService::new(store.clone());

    let error = service.authorize_view(store.user().id).await.unwrap_err();
    assert!(error.to_string().contains("system_runtime.view.all"));
}

#[tokio::test]
async fn authorize_view_returns_user_locale_for_root() {
    let store = MemoryAuthRepository::root_user(Some("en_US"));
    let service = SystemRuntimeService::new(store.clone());

    let access = service.authorize_view(store.user().id).await.unwrap();
    assert_eq!(access.preferred_locale.as_deref(), Some("en_US"));
}
