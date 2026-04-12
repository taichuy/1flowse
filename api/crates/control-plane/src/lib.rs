pub mod audit;
pub mod auth;
pub mod bootstrap;
pub mod errors;
pub mod member;
pub mod ports;
pub mod profile;
pub mod role;
pub mod team;

pub fn crate_name() -> &'static str {
    "control-plane"
}

#[cfg(test)]
pub mod _tests;
