package org.globusmarket.courierapp.domain.repository

import org.globusmarket.courierapp.api.OrderDto

interface OrderRepository {
    suspend fun loadActiveOrder(): Result<OrderDto?>
    suspend fun loadQueue(): Result<List<OrderDto>>
    suspend fun acceptOrder(orderId: String): Result<OrderDto>
    suspend fun declineOrder(orderId: String): Result<Unit>
    suspend fun deliverOrder(orderId: String): Result<OrderDto>
}
