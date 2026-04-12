use api_server::config::ApiConfig;

#[test]
fn api_config_uses_expected_cookie_defaults() {
    let config = ApiConfig::from_env_map(&[
        (
            "API_DATABASE_URL",
            "postgres://postgres:sevenflows@127.0.0.1:35432/sevenflows",
        ),
        ("API_REDIS_URL", "redis://:sevenflows@127.0.0.1:36379"),
        ("BOOTSTRAP_ROOT_ACCOUNT", "root"),
        ("BOOTSTRAP_ROOT_EMAIL", "root@example.com"),
        ("BOOTSTRAP_ROOT_PASSWORD", "secret"),
        ("BOOTSTRAP_TEAM_NAME", "1Flowse"),
    ])
    .unwrap();

    assert_eq!(config.cookie_name, "flowse_console_session");
    assert_eq!(config.session_ttl_days, 7);
}
