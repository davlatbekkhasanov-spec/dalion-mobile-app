package org.globusmarket.courierapp.domain.repository

import org.globusmarket.courierapp.data.LocalOrder
import org.globusmarket.courierapp.domain.model.OrderState

interface OrderRepository {
    fun getActiveOrders(): List<LocalOrder>
    fun getDeliveredOrders(): List<LocalOrder>
    fun getSettlementPendingOrders(): List<LocalOrder>
    fun getSettledOrders(): List<LocalOrder>
    fun addOrder(order: LocalOrder)
    fun updateOrderState(token: String, state: OrderState, backendStatus: String? = null)
    fun calculateTotalDeliveryFee(orders: List<LocalOrder>): Double
    fun getMostRecentOrderForActions(): LocalOrder?
}
