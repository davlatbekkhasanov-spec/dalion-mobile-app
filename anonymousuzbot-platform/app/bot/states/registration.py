from aiogram.fsm.state import State, StatesGroup


class RegistrationStates(StatesGroup):
    choosing_gender = State()
    choosing_age = State()


class SettingsStates(StatesGroup):
    changing_gender = State()
    changing_age = State()
