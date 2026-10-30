package net.trices.smsgateway.api

import retrofit2.http.GET
import retrofit2.http.Query

interface GatewayApi {
    @GET("send_sms.php")
    suspend fun sendAction(
        @Query("device_token") deviceToken: String,
        @Query("action") action: String,
        @Query("name") name: String? = null,
        @Query("phone") phone: String? = null,
        @Query("id") id: Int? = null,
        @Query("error") error: String? = null,
        @Query("limit") limit: Int? = null,
    ): ApiResponse

    @GET("send_sms.php")
    suspend fun pendingQueue(
        @Query("device_token") deviceToken: String,
        @Query("action") action: String = "pending",
        @Query("limit") limit: Int = 20,
    ): QueueResponse

    @GET("save_sms.php")
    suspend fun saveSms(
        @Query("device_token") deviceToken: String,
        @Query("phone") phone: String,
        @Query("msg") msg: String,
        @Query("date") date: String? = null,
        @Query("date_sent") dateSent: String? = null,
    ): ApiResponse

    @GET("register.php")
    suspend fun registerDevice(
        @Query("code") code: String,
        @Query("name") name: String,
        @Query("phone") phone: String? = null,
        @Query("sig") sig: String? = null,
    ): RegisterResponse
}