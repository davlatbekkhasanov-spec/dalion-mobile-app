package org.globusmarket.courierapp.api

data class CourierOrderResponse(
    val ok: Boolean? = null,
    val message: String? = null,
    val order: OrderDto? = null
)

data class AcceptRequest(
    val courierName: String = "Android Courier",
    val courierPhone: String = "-"
)

data class LocationRequest(
    val lat: Double,
    val lng: Double,
    val accuracy: Float?
)

data class OrderDto(
    val orderNumber: String? = null,
    val customerAddress: String? = null,
    val addressText: String? = null,
    val landmarkText: String? = null,
    val customerName: String? = null,
    val customerPhone: String? = null,
    val paymentNote: String? = null,
    val deliveryNote: String? = null,
    val distanceKm: Double? = null,
    val total: Double? = null,
    val items: List<OrderItemDto>? = null,
    val status: String? = null,
    val locationLat: Double? = null,
    val locationLng: Double? = null
)

data class OrderItemDto(
    val name: String? = null,
    val qty: Int? = null
)
