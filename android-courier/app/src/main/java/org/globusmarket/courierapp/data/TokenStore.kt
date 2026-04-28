package org.globusmarket.courierapp.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

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

    companion object {
        private const val KEY_TOKEN = "courier_token"
        private const val KEY_COURIER_NAME = "courier_name"
        private const val KEY_COURIER_PHONE = "courier_phone"
        private const val KEY_COURIER_VEHICLE_TYPE = "courier_vehicle_type"
        private const val KEY_COURIER_VEHICLE_PLATE = "courier_vehicle_plate"
    }
}
