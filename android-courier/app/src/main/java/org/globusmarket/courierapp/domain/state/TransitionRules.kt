package org.globusmarket.courierapp.domain.state

import org.globusmarket.courierapp.domain.model.CourierAppState
import org.globusmarket.courierapp.domain.model.DriverState
import org.globusmarket.courierapp.domain.model.OrderState

object TransitionRules {
    fun canStartShift(state: CourierAppState): Boolean {
        return state.driverState == DriverState.OFFLINE
    }

    fun canStopShift(state: CourierAppState): Boolean {
        return state.driverState == DriverState.ONLINE_IDLE || state.driverState == DriverState.ONLINE_BUSY
    }

    fun canAcceptOrder(state: CourierAppState): Boolean {
        return state.orderState == OrderState.ASSIGNED_PENDING_ACCEPT
    }

    fun canDeliverOrder(state: CourierAppState): Boolean {
        return state.orderState == OrderState.OUT_FOR_DELIVERY
    }
}
