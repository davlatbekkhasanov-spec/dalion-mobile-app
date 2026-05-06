package org.globusmarket.courierapp.domain.repository

interface ShiftRepository {
    suspend fun startShift(): Result<Unit>
    suspend fun stopShift(): Result<Unit>
    suspend fun getShiftStatus(): Result<Boolean>
}
