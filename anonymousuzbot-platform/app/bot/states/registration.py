from aiogram.fsm.state import State, StatesGroup


class RegistrationState(StatesGroup):
    gender = State()
    age = State()
