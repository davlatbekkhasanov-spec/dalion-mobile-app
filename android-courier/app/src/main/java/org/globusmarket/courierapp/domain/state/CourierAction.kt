package org.globusmarket.courierapp.domain.state

sealed interface CourierAction {
    data object SessionAuthenticated : CourierAction
    data object SessionCleared : CourierAction
    data object ShiftStarted : CourierAction
    data object ShiftStopped : CourierAction
    data class ActiveOrderLoaded(val orderId: String?, val status: String?) : CourierAction
    data object OrderAccepted : CourierAction
    data object OrderOutForDelivery : CourierAction
    data object OrderDelivered : CourierAction
    data object OrderCanceled : CourierAction
    data class TrackingRetryScheduled(val hasRetry: Boolean) : CourierAction
    data class LocationPermissionUpdated(val granted: Boolean) : CourierAction
    data class ErrorOccurred(val message: String?) : CourierAction
}
