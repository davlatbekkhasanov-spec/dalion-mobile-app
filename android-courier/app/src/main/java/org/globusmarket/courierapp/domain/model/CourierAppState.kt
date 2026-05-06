package org.globusmarket.courierapp.domain.model

data class CourierAppState(
    val driverState: DriverState = DriverState.UNAUTHENTICATED,
    val orderState: OrderState = OrderState.NO_ACTIVE_ORDER,
    val trackingMode: TrackingMode = TrackingMode.OFF,
    val activeOrderId: String? = null,
    val hasLocationPermission: Boolean = false,
    val isOnline: Boolean = false,
    val lastErrorMessage: String? = null
)
