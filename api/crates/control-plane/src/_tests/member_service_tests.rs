use crate::_tests::support::MemoryMemberRepository;
use crate::member::{CreateMemberCommand, MemberService};

#[tokio::test]
async fn create_member_assigns_default_manager_role_and_records_audit() {
    let repository = MemoryMemberRepository::default();
    let service = MemberService::new(repository.clone());

    service
        .create_member(CreateMemberCommand {
            actor_user_id: repository.root_user_id(),
            account: "manager-1".into(),
            email: "manager-1@example.com".into(),
            phone: Some("13800000000".into()),
            password_hash: "hash".into(),
            name: "Manager 1".into(),
            nickname: "Manager 1".into(),
            introduction: String::new(),
            email_login_enabled: true,
            phone_login_enabled: false,
        })
        .await
        .unwrap();

    assert_eq!(repository.created_members().len(), 1);
    assert_eq!(repository.created_members()[0].role_codes, vec!["manager"]);
    assert_eq!(repository.audit_events(), vec!["member.created"]);
}
