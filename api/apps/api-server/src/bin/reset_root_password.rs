use anyhow::Result;
use api_server::config::ApiConfig;
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2,
};
use rand_core::OsRng;
use storage_pg::{connect, run_migrations, PgControlPlaneStore};

#[tokio::main]
async fn main() -> Result<()> {
    let config = ApiConfig::from_env()?;
    let pool = connect(&config.database_url).await?;
    run_migrations(&pool).await?;

    let store = PgControlPlaneStore::new(pool);
    let team = store.upsert_team(&config.bootstrap_team_name).await?;
    store
        .upsert_permission_catalog(&access_control::permission_catalog())
        .await?;
    store.upsert_builtin_roles(team.id).await?;

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(config.bootstrap_root_password.as_bytes(), &salt)
        .map_err(|err| anyhow::anyhow!("failed to hash root password: {err}"))?
        .to_string();

    let root = store
        .upsert_root_user(
            team.id,
            &config.bootstrap_root_account,
            &config.bootstrap_root_email,
            &password_hash,
            &config.bootstrap_root_name,
            &config.bootstrap_root_nickname,
        )
        .await?;
    store
        .update_password_hash(root.id, &password_hash, root.id)
        .await?;

    println!("reset root password for {}", root.account);
    Ok(())
}
