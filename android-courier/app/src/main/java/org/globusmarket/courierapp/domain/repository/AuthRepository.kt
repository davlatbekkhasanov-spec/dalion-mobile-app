package org.globusmarket.courierapp.domain.repository

interface AuthRepository {
    suspend fun requestOtp(phone: String): Result<Unit>
    suspend fun verifyOtp(phone: String, code: String): Result<Unit>
    suspend fun refreshSession(): Result<Unit>
    suspend fun logout(): Result<Unit>
}
