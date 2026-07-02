# Mega Admin Panel

This module exposes admin APIs via FastAPI and can be connected to a dedicated UI.

Recommended architecture for production:
- React/Next.js admin frontend
- FastAPI BFF with RBAC
- Signed media links for moderation evidence
- Audit and immutable moderation actions
