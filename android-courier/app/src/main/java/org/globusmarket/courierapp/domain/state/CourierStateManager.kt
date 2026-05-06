package org.globusmarket.courierapp.domain.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.globusmarket.courierapp.domain.model.CourierAppState

class CourierStateManager(
    private val reducer: CourierStateReducer = CourierStateReducer()
) {
    private val mutableState = MutableStateFlow(CourierAppState())
    val state: StateFlow<CourierAppState> = mutableState.asStateFlow()

    fun dispatch(action: CourierAction) {
        mutableState.update { previous -> reducer.reduce(previous, action) }
    }

    fun currentState(): CourierAppState = mutableState.value
}
