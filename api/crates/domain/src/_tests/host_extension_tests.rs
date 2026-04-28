use domain::{HostExtensionActivationStatus, HostExtensionTrustLevel};

#[test]
fn host_extension_inventory_enum_strings_are_stable() {
    assert_eq!(
        HostExtensionActivationStatus::Discovered.as_str(),
        "discovered"
    );
    assert_eq!(HostExtensionActivationStatus::Active.as_str(), "active");
    assert_eq!(
        HostExtensionActivationStatus::Unhealthy.as_str(),
        "unhealthy"
    );
    assert_eq!(
        HostExtensionTrustLevel::TrustedHost.as_str(),
        "trusted_host"
    );
}
