package org.globusmarket.courierapp.domain.state

import org.globusmarket.courierapp.domain.model.CourierAppState
import org.globusmarket.courierapp.domain.model.DriverState
import org.globusmarket.courierapp.domain.model.OrderState
import org.globusmarket.courierapp.domain.model.TrackingMode

class CourierStateReducer {
    fun reduce(previous: CourierAppState, action: CourierAction): CourierAppState {
        val next = when (action) {
            CourierAction.SessionAuthenticated -> previous.copy(
                driverState = DriverState.OFFLINE,
                isOnline = false,
                lastErrorMessage = null
            )

            CourierAction.SessionCleared -> CourierAppState()

            CourierAction.ShiftStarted -> previous.copy(
                driverState = DriverState.ONLINE_IDLE,
                isOnline = true,
                lastErrorMessage = null
            )

            CourierAction.ShiftStopped -> previous.copy(
                driverState = DriverState.OFFLINE,
                orderState = OrderState.NO_ACTIVE_ORDER,
                activeOrderId = null,
                isOnline = false,
                lastErrorMessage = null
            )

            is CourierAction.ActiveOrderLoaded -> {
                val orderState = mapOrderState(action.status)
                previous.copy(
                    orderState = orderState,
                    activeOrderId = action.orderId,
                    driverState = resolveDriverState(orderState),
                    lastErrorMessage = null
                )
            }

            CourierAction.OrderAccepted -> previous.copy(
                orderState = OrderState.ACCEPTED_EN_ROUTE_PICKUP,
                driverState = DriverState.ONLINE_BUSY,
                lastErrorMessage = null
            )

            CourierAction.OrderOutForDelivery -> previous.copy(
                orderState = OrderState.OUT_FOR_DELIVERY,
                driverState = DriverState.ONLINE_BUSY,
                lastErrorMessage = null
            )

            CourierAction.OrderDelivered -> previous.copy(
                orderState = OrderState.DELIVERED,
                driverState = DriverState.ONLINE_IDLE,
                activeOrderId = null,
                lastErrorMessage = null
            )

            CourierAction.OrderCanceled -> previous.copy(
                orderState = OrderState.CANCELED,
                driverState = DriverState.ONLINE_IDLE,
                activeOrderId = null,
                lastErrorMessage = null
            )

            is CourierAction.TrackingRetryScheduled -> previous.copy(
                trackingMode = if (action.hasRetry) TrackingMode.RETRY_BACKOFF else previous.trackingMode
            )

            is CourierAction.LocationPermissionUpdated -> previous.copy(hasLocationPermission = action.granted)

            is CourierAction.ErrorOccurred -> previous.copy(lastErrorMessage = action.message)
        }

        return next.copy(trackingMode = resolveTrackingMode(next))
    }

    private fun resolveTrackingMode(state: CourierAppState): TrackingMode {
        if (!state.isOnline || !state.hasLocationPermission) return TrackingMode.OFF
        return when (state.orderState) {
            OrderState.ACCEPTED_EN_ROUTE_PICKUP,
            OrderState.OUT_FOR_DELIVERY -> TrackingMode.ACTIVE
            OrderState.NO_ACTIVE_ORDER,
            OrderState.ASSIGNED_PENDING_ACCEPT,
            OrderState.DELIVERED,
            OrderState.SETTLEMENT_PENDING,
            OrderState.SETTLED,
            OrderState.CANCELED -> TrackingMode.IDLE
        }
    }

    private fun mapOrderState(status: String?): OrderState {
        return when (status) {
            "waiting_courier" -> OrderState.ASSIGNED_PENDING_ACCEPT
            "accepted" -> OrderState.ACCEPTED_EN_ROUTE_PICKUP
            "out_for_delivery" -> OrderState.OUT_FOR_DELIVERY
            "delivered" -> OrderState.DELIVERED
            "settlement_pending" -> OrderState.SETTLEMENT_PENDING
            "settled" -> OrderState.SETTLED
            "cancelled" -> OrderState.CANCELED
            else -> OrderState.NO_ACTIVE_ORDER
        }
    }

    private fun resolveDriverState(orderState: OrderState): DriverState {
        return when (orderState) {
            OrderState.ACCEPTED_EN_ROUTE_PICKUP,
            OrderState.OUT_FOR_DELIVERY -> DriverState.ONLINE_BUSY
            OrderState.ASSIGNED_PENDING_ACCEPT,
            OrderState.NO_ACTIVE_ORDER,
            OrderState.DELIVERED,
            OrderState.SETTLEMENT_PENDING,
            OrderState.SETTLED,
            OrderState.CANCELED -> DriverState.ONLINE_IDLE
        }
    }
}
