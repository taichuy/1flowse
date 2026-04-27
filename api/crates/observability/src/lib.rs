pub mod delta_coalescer;
pub mod event_bus;

pub use delta_coalescer::DeltaCoalescer;
pub use event_bus::{RuntimeBusEvent, RuntimeEventBus};

pub fn crate_name() -> &'static str {
    "observability"
}

#[cfg(test)]
mod _tests;
