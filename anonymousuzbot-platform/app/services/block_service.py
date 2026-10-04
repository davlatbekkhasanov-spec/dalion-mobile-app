from app.repositories.blocked_user_repository import BlockedUserRepository


class BlockService:
    def __init__(self, session) -> None:
        self.session = session
        self.block_repo = BlockedUserRepository(session)

    async def block_user(self, blocker_id, blocked_id) -> None:
        existing = await self.block_repo.get_pair(blocker_id, blocked_id)
        if existing is not None:
            return
        await self.block_repo.create(blocker_id=blocker_id, blocked_id=blocked_id)
