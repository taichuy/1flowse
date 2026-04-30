use crate::{
    ApiExposureReadiness, ApiExposureStatus, DataModelOwnerKind, DataModelStatus,
    ExposureCompatibility, ExternalSourceValidation, RuntimeAvailability,
};

#[test]
fn modeling_status_values_are_stable_db_strings() {
    assert_eq!(DataModelStatus::Draft.as_str(), "draft");
    assert_eq!(DataModelStatus::Published.as_str(), "published");
    assert_eq!(DataModelStatus::Disabled.as_str(), "disabled");
    assert_eq!(DataModelStatus::Broken.as_str(), "broken");

    assert_eq!(DataModelStatus::from_db("draft"), DataModelStatus::Draft);
    assert_eq!(
        DataModelStatus::from_db("published"),
        DataModelStatus::Published
    );
    assert_eq!(
        DataModelStatus::from_db("disabled"),
        DataModelStatus::Disabled
    );
    assert_eq!(DataModelStatus::from_db("broken"), DataModelStatus::Broken);
}

#[test]
fn api_exposure_status_values_are_stable_db_strings() {
    assert_eq!(ApiExposureStatus::Draft.as_str(), "draft");
    assert_eq!(
        ApiExposureStatus::PublishedNotExposed.as_str(),
        "published_not_exposed"
    );
    assert_eq!(
        ApiExposureStatus::ApiExposedNoPermission.as_str(),
        "api_exposed_no_permission"
    );
    assert_eq!(
        ApiExposureStatus::ApiExposedReady.as_str(),
        "api_exposed_ready"
    );
    assert_eq!(
        ApiExposureStatus::UnsafeExternalSource.as_str(),
        "unsafe_external_source"
    );

    assert_eq!(
        ApiExposureStatus::from_db("draft"),
        ApiExposureStatus::Draft
    );
    assert_eq!(
        ApiExposureStatus::from_db("published_not_exposed"),
        ApiExposureStatus::PublishedNotExposed
    );
    assert_eq!(
        ApiExposureStatus::from_db("api_exposed_no_permission"),
        ApiExposureStatus::ApiExposedNoPermission
    );
    assert_eq!(
        ApiExposureStatus::from_db("api_exposed_ready"),
        ApiExposureStatus::ApiExposedReady
    );
    assert_eq!(
        ApiExposureStatus::from_db("unsafe_external_source"),
        ApiExposureStatus::UnsafeExternalSource
    );
}

#[test]
fn owner_kind_values_are_stable_db_strings() {
    assert_eq!(DataModelOwnerKind::Core.as_str(), "core");
    assert_eq!(DataModelOwnerKind::HostExtension.as_str(), "host_extension");
    assert_eq!(
        DataModelOwnerKind::RuntimeExtension.as_str(),
        "runtime_extension"
    );

    assert_eq!(
        DataModelOwnerKind::from_db("core"),
        DataModelOwnerKind::Core
    );
    assert_eq!(
        DataModelOwnerKind::from_db("host_extension"),
        DataModelOwnerKind::HostExtension
    );
    assert_eq!(
        DataModelOwnerKind::from_db("runtime_extension"),
        DataModelOwnerKind::RuntimeExtension
    );
    assert_eq!(
        DataModelOwnerKind::from_db("unknown_owner"),
        DataModelOwnerKind::Core
    );
}

#[test]
fn default_exposure_follows_model_status() {
    assert_eq!(
        ApiExposureStatus::default_for_status(DataModelStatus::Published),
        ApiExposureStatus::PublishedNotExposed
    );
    assert_eq!(
        ApiExposureStatus::default_for_status(DataModelStatus::Draft),
        ApiExposureStatus::Draft
    );
}

#[test]
fn draft_model_accepts_draft_exposure_only() {
    assert!(matches!(
        ApiExposureStatus::validate_for_status(
            DataModelStatus::Draft,
            ApiExposureStatus::Draft,
            ApiExposureReadiness::default(),
        ),
        ExposureCompatibility::Compatible {
            runtime: RuntimeAvailability::Unavailable
        }
    ));

    assert!(ApiExposureStatus::validate_for_status(
        DataModelStatus::Draft,
        ApiExposureStatus::PublishedNotExposed,
        ApiExposureReadiness::default(),
    )
    .is_rejected());
}

#[test]
fn api_exposed_ready_requires_readiness_proof() {
    assert!(ApiExposureStatus::validate_for_status(
        DataModelStatus::Published,
        ApiExposureStatus::ApiExposedReady,
        ApiExposureReadiness::default(),
    )
    .is_rejected());

    assert!(matches!(
        ApiExposureStatus::validate_for_status(
            DataModelStatus::Published,
            ApiExposureStatus::ApiExposedReady,
            ApiExposureReadiness {
                has_api_permission: true,
                has_runtime_binding: true,
                external_source_validation: ExternalSourceValidation::NotExternal,
            },
        ),
        ExposureCompatibility::Compatible {
            runtime: RuntimeAvailability::Available
        }
    ));
}

#[test]
fn published_model_accepts_no_permission_and_external_safety_output() {
    assert!(matches!(
        ApiExposureStatus::validate_for_status(
            DataModelStatus::Published,
            ApiExposureStatus::ApiExposedNoPermission,
            ApiExposureReadiness::default(),
        ),
        ExposureCompatibility::Compatible {
            runtime: RuntimeAvailability::Unavailable
        }
    ));

    assert!(ApiExposureStatus::validate_for_status(
        DataModelStatus::Published,
        ApiExposureStatus::UnsafeExternalSource,
        ApiExposureReadiness::default(),
    )
    .is_rejected());

    assert!(matches!(
        ApiExposureStatus::validate_for_status(
            DataModelStatus::Published,
            ApiExposureStatus::UnsafeExternalSource,
            ApiExposureReadiness {
                external_source_validation: ExternalSourceValidation::UnsafeExternalSource,
                ..Default::default()
            },
        ),
        ExposureCompatibility::Compatible {
            runtime: RuntimeAvailability::Unavailable
        }
    ));
}

#[test]
fn disabled_and_broken_models_remain_runtime_unavailable() {
    for status in [DataModelStatus::Disabled, DataModelStatus::Broken] {
        assert!(matches!(
            ApiExposureStatus::validate_for_status(
                status,
                ApiExposureStatus::ApiExposedReady,
                ApiExposureReadiness {
                    has_api_permission: true,
                    has_runtime_binding: true,
                    external_source_validation: ExternalSourceValidation::NotExternal,
                },
            ),
            ExposureCompatibility::Compatible {
                runtime: RuntimeAvailability::Unavailable
            }
        ));
    }
}
