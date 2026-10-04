from app.database.session import get_db_session

# Re-export dependency to keep API layer isolated from infrastructure details.
__all__ = ["get_db_session"]
