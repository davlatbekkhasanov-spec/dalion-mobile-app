package org.globusmarket.courierapp.api

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface CourierApi {
    @GET("/api/v1/courier/{token}")
    suspend fun getCourierOrder(@Path("token") token: String): CourierOrderResponse

    @POST("/api/v1/courier/{token}/accept")
    suspend fun acceptOrder(@Path("token") token: String, @Body body: AcceptRequest): CourierOrderResponse

    @POST("/api/v1/courier/{token}/location")
    suspend fun updateLocation(@Path("token") token: String, @Body body: LocationRequest): CourierOrderResponse

    @POST("/api/v1/courier/{token}/deliver")
    suspend fun deliverOrder(@Path("token") token: String): CourierOrderResponse
}
