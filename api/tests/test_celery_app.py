import importlib

from app.core import celery_app as celery_module
from app.core import config as config_module


def _reload_celery_module():
    config_module.get_settings.cache_clear()
    return importlib.reload(celery_module)


def test_celery_app_registers_callback_cleanup_beat_schedule(monkeypatch) -> None:
    monkeypatch.setenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_SCHEDULE_ENABLED", "true")
    monkeypatch.setenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_INTERVAL_SECONDS", "120")

    module = _reload_celery_module()
    schedule = module.celery_app.conf.beat_schedule

    assert "runtime.cleanup_callback_tickets" in schedule
    task_config = schedule["runtime.cleanup_callback_tickets"]
    assert task_config["task"] == "runtime.cleanup_callback_tickets"
    assert task_config["schedule"] == 120
    assert task_config["kwargs"] == {"source": "scheduler_cleanup"}

    monkeypatch.delenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_SCHEDULE_ENABLED")
    monkeypatch.delenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_INTERVAL_SECONDS")
    _reload_celery_module()


def test_celery_app_registers_approval_ticket_expiry_beat_schedule(monkeypatch) -> None:
    monkeypatch.setenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_SCHEDULE_ENABLED", "true")
    monkeypatch.setenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_INTERVAL_SECONDS", "90")

    module = _reload_celery_module()
    schedule = module.celery_app.conf.beat_schedule

    assert "sensitive_access.expire_approval_tickets" in schedule
    task_config = schedule["sensitive_access.expire_approval_tickets"]
    assert task_config["task"] == "sensitive_access.expire_approval_tickets"
    assert task_config["schedule"] == 90
    assert task_config["kwargs"] == {"source": "scheduler_expiry"}

    monkeypatch.delenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_SCHEDULE_ENABLED")
    monkeypatch.delenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_INTERVAL_SECONDS")
    _reload_celery_module()


def test_celery_app_skips_approval_ticket_expiry_schedule_when_disabled(monkeypatch) -> None:
    monkeypatch.setenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_SCHEDULE_ENABLED", "false")
    monkeypatch.setenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_INTERVAL_SECONDS", "90")

    module = _reload_celery_module()

    assert "sensitive_access.expire_approval_tickets" not in module.celery_app.conf.beat_schedule

    monkeypatch.delenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_SCHEDULE_ENABLED")
    monkeypatch.delenv("SEVENFLOWS_APPROVAL_TICKET_EXPIRY_INTERVAL_SECONDS")
    _reload_celery_module()


def test_celery_app_skips_callback_cleanup_schedule_when_disabled(monkeypatch) -> None:
    monkeypatch.setenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_SCHEDULE_ENABLED", "false")
    monkeypatch.setenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_INTERVAL_SECONDS", "120")

    module = _reload_celery_module()

    assert "runtime.cleanup_callback_tickets" not in module.celery_app.conf.beat_schedule

    monkeypatch.delenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_SCHEDULE_ENABLED")
    monkeypatch.delenv("SEVENFLOWS_CALLBACK_TICKET_CLEANUP_INTERVAL_SECONDS")
    _reload_celery_module()


def test_celery_app_includes_notification_tasks() -> None:
    module = _reload_celery_module()

    assert "app.tasks.notifications" in module.celery_app.conf.include
    assert "app.tasks.sensitive_access" in module.celery_app.conf.include
