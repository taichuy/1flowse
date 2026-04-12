use domain::AuditLogRecord;
use time::OffsetDateTime;
use uuid::Uuid;

pub fn audit_log(
    actor_user_id: Option<Uuid>,
    target_type: &str,
    target_id: Option<Uuid>,
    event_code: &str,
    payload: serde_json::Value,
) -> AuditLogRecord {
    AuditLogRecord {
        id: Uuid::now_v7(),
        team_id: None,
        actor_user_id,
        target_type: target_type.to_string(),
        target_id,
        event_code: event_code.to_string(),
        payload,
        created_at: OffsetDateTime::now_utc(),
    }
}
