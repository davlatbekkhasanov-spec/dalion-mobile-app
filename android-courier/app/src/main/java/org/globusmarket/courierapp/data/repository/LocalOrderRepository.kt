package org.globusmarket.courierapp.data.repository

import org.globusmarket.courierapp.data.LocalOrder
import org.globusmarket.courierapp.data.TokenStore
import org.globusmarket.courierapp.domain.model.OrderState
import org.globusmarket.courierapp.domain.repository.OrderRepository

class LocalOrderRepository(private val tokenStore: TokenStore) : OrderRepository {
    private var orders: MutableList<LocalOrder> = tokenStore.getOrders()

    override fun getActiveOrders(): List<LocalOrder> = orders.filter {
        it.state == OrderState.ASSIGNED_PENDING_ACCEPT || it.state == OrderState.OUT_FOR_DELIVERY
    }

    override fun getDeliveredOrders(): List<LocalOrder> = orders.filter { it.state == OrderState.DELIVERED }

    override fun getSettlementPendingOrders(): List<LocalOrder> = orders.filter { it.state == OrderState.SETTLEMENT_PENDING }

    override fun getSettledOrders(): List<LocalOrder> = orders.filter { it.state == OrderState.SETTLED }

    override fun addOrder(order: LocalOrder) {
        orders.removeAll { it.token == order.token }
        orders.add(order)
        persist()
    }

    override fun updateOrderState(token: String, state: OrderState, backendStatus: String?) {
        val idx = orders.indexOfFirst { it.token == token }
        if (idx < 0) return
        val current = orders[idx]
        orders[idx] = current.copy(state = state, statusBackend = backendStatus ?: current.statusBackend)
        persist()
    }

    override fun calculateTotalDeliveryFee(orders: List<LocalOrder>): Double = orders.sumOf { it.deliveryFee }

    override fun getMostRecentOrderForActions(): LocalOrder? = getActiveOrders().lastOrNull() ?: orders.lastOrNull()

    private fun persist() {
        tokenStore.saveOrders(orders)
        orders = tokenStore.getOrders()
    }
}
