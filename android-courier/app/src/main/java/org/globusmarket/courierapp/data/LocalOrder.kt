package org.globusmarket.courierapp.data

import org.globusmarket.courierapp.api.OrderDto
import org.globusmarket.courierapp.domain.model.OrderState

data class LocalOrder(
    val token: String,
    val orderNumber: String,
    val customerName: String,
    val customerPhone: String,
    val address: String,
    val statusBackend: String,
    val state: OrderState,
    val deliveryFee: Double,
    val paid: Boolean,
    val lat: Double? = null,
    val lng: Double? = null
)

fun OrderDto.toLocalOrder(token: String, baseFee: Double = 15000.0): LocalOrder {
    val distance = distanceKm ?: 0.0
    val fee = if (distance > 0) baseFee + (distance * 3000.0) else baseFee
    return LocalOrder(
        token = token,
        orderNumber = orderNumber ?: token.take(8),
        customerName = customerName ?: "-",
        customerPhone = customerPhone ?: "-",
        address = addressText ?: customerAddress ?: "-",
        statusBackend = status ?: "new",
        state = OrderState.ASSIGNED_PENDING_ACCEPT,
        deliveryFee = fee,
        paid = false,
        lat = locationLat,
        lng = locationLng
    )
}
