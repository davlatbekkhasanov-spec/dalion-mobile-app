from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MessageType
from app.models.message import Message


class ChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save_message(self, chat_id, sender_id, message_type: MessageType, text: str | None, file_id: str | None):
        msg = Message(
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=message_type,
            text_content=text,
            media_file_id=file_id,
        )
        self.session.add(msg)
        await self.session.commit()
