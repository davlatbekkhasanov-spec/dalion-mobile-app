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

    fun saveCourierProfile(name: String, phone: String) {
        prefs.edit()
            .putString(KEY_COURIER_NAME, name.trim())
            .putString(KEY_COURIER_PHONE, phone.trim())
            .apply()
    }

    fun getCourierName(): String = prefs.getString(KEY_COURIER_NAME, "") ?: ""

    fun getCourierPhone(): String = prefs.getString(KEY_COURIER_PHONE, "") ?: ""

    companion object {
        private const val KEY_TOKEN = "courier_token"
        private const val KEY_COURIER_NAME = "courier_name"
        private const val KEY_COURIER_PHONE = "courier_phone"
    }
}
