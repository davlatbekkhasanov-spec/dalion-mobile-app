package org.globusmarket.courierapp.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import org.globusmarket.courierapp.domain.model.OrderState

class TokenStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "courier_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token.trim()).apply()
    }

    fun getToken(): String = prefs.getString(KEY_TOKEN, "") ?: ""

    fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    fun saveCourierProfile(profile: CourierProfileLocal) {
        prefs.edit()
            .putString(KEY_COURIER_NAME, profile.fullName.trim())
            .putString(KEY_COURIER_PHONE, profile.phone.trim())
            .putString(KEY_COURIER_VEHICLE_TYPE, profile.vehicleType.trim())
            .putString(KEY_COURIER_VEHICLE_PLATE, profile.vehiclePlate.trim())
            .apply()
    }

    fun getCourierProfile(): CourierProfileLocal = CourierProfileLocal(
        fullName = prefs.getString(KEY_COURIER_NAME, "") ?: "",
        phone = prefs.getString(KEY_COURIER_PHONE, "") ?: "",
        vehicleType = prefs.getString(KEY_COURIER_VEHICLE_TYPE, "") ?: "",
        vehiclePlate = prefs.getString(KEY_COURIER_VEHICLE_PLATE, "") ?: ""
    )

    fun getCourierName(): String = getCourierProfile().fullName

    fun getCourierPhone(): String = getCourierProfile().phone


    fun saveLanguage(language: String) {
        prefs.edit().putString(KEY_LANGUAGE, language).apply()
    }

    fun getLanguage(): String = prefs.getString(KEY_LANGUAGE, "") ?: ""

    fun saveOrders(orders: List<LocalOrder>) {
        val arr = JSONArray()
        orders.forEach { o ->
            val obj = JSONObject()
            obj.put("token", o.token)
            obj.put("orderNumber", o.orderNumber)
            obj.put("customerName", o.customerName)
            obj.put("customerPhone", o.customerPhone)
            obj.put("address", o.address)
            obj.put("statusBackend", o.statusBackend)
            obj.put("state", o.state.name)
            obj.put("deliveryFee", o.deliveryFee)
            obj.put("paid", o.paid)
            obj.put("lat", o.lat)
            obj.put("lng", o.lng)
            arr.put(obj)
        }
        prefs.edit().putString(KEY_ORDERS, arr.toString()).apply()
    }

    fun getOrders(): MutableList<LocalOrder> {
        val raw = prefs.getString(KEY_ORDERS, "[]") ?: "[]"
        val arr = JSONArray(raw)
        val list = mutableListOf<LocalOrder>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            list += LocalOrder(
                token = o.optString("token"),
                orderNumber = o.optString("orderNumber"),
                customerName = o.optString("customerName"),
                customerPhone = o.optString("customerPhone"),
                address = o.optString("address"),
                statusBackend = o.optString("statusBackend"),
                state = runCatching { OrderState.valueOf(o.optString("state")) }.getOrDefault(OrderState.ASSIGNED_PENDING_ACCEPT),
                deliveryFee = o.optDouble("deliveryFee", 0.0),
                paid = o.optBoolean("paid", false),
                lat = if (o.isNull("lat")) null else o.optDouble("lat"),
                lng = if (o.isNull("lng")) null else o.optDouble("lng")
            )
        }
        return list
    }

    fun setShiftOnline(value: Boolean) {
        prefs.edit().putBoolean(KEY_SHIFT_ONLINE, value).apply()
    }

    fun getShiftOnline(): Boolean = prefs.getBoolean(KEY_SHIFT_ONLINE, false)

    fun setTrackingActive(value: Boolean) {
        prefs.edit().putBoolean(KEY_TRACKING_ACTIVE, value).apply()
    }

    fun isTrackingActive(): Boolean = prefs.getBoolean(KEY_TRACKING_ACTIVE, false)

    companion object {
        private const val KEY_TOKEN = "courier_token"
        private const val KEY_COURIER_NAME = "courier_name"
        private const val KEY_COURIER_PHONE = "courier_phone"
        private const val KEY_COURIER_VEHICLE_TYPE = "courier_vehicle_type"
        private const val KEY_COURIER_VEHICLE_PLATE = "courier_vehicle_plate"
        private const val KEY_SHIFT_ONLINE = "shift_online"
        private const val KEY_TRACKING_ACTIVE = "tracking_active"
        private const val KEY_LANGUAGE = "language"
        private const val KEY_ORDERS = "orders"
    }
}
