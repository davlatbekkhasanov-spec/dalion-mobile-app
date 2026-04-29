package org.globusmarket.courierapp.domain.model

enum class OrderState {
    NO_ACTIVE_ORDER,
    ASSIGNED_PENDING_ACCEPT,
    ACCEPTED_EN_ROUTE_PICKUP,
    OUT_FOR_DELIVERY,
    DELIVERED,
    SETTLEMENT_PENDING,
    SETTLED,
    CANCELED
}
