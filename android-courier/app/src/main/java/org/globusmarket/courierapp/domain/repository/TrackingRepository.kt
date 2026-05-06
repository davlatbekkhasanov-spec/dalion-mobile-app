package org.globusmarket.courierapp.domain.repository

import org.globusmarket.courierapp.api.LocationRequest

interface TrackingRepository {
    suspend fun sendLocation(payload: LocationRequest): Result<Unit>
    suspend fun enqueueLocation(payload: LocationRequest): Result<Unit>
    suspend fun flushLocationQueue(maxBatchSize: Int = 50): Result<Int>
}
