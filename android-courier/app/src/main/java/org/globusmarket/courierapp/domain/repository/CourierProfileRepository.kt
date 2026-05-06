package org.globusmarket.courierapp.domain.repository

import org.globusmarket.courierapp.data.CourierProfileLocal

interface CourierProfileRepository {
    suspend fun getProfile(): Result<CourierProfileLocal>
    suspend fun saveProfile(profile: CourierProfileLocal): Result<CourierProfileLocal>
}
