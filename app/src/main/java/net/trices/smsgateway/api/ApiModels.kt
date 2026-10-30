package net.trices.smsgateway.api

import com.squareup.moshi.Json

data class ApiResponse(
    val status: String? = null,
    val message: String? = null,
    val code: String? = null,
    @Json(name = "user_id") val userId: Int? = null,
    @Json(name = "device_id") val deviceId: Int? = null,
    @Json(name = "device_name") val deviceName: String? = null,
    @Json(name = "phone_number") val phoneNumber: String? = null,
    @Json(name = "server_url") val serverUrl: String? = null,
    val time: String? = null,
)

data class QueueItem(
    val id: Int,
    val phone: String,
    val message: String,
)

data class QueueResponse(
    val status: String? = null,
    val data: List<QueueItem> = emptyList(),
    val count: Int = 0,
)

data class RegisterResponse(
    val status: String? = null,
    val message: String? = null,
    @Json(name = "device_token") val deviceToken: String? = null,
    @Json(name = "device_id") val deviceId: Int? = null,
    @Json(name = "device_name") val deviceName: String? = null,
    @Json(name = "phone_number") val phoneNumber: String? = null,
    @Json(name = "device_hash") val deviceHash: String? = null,
    @Json(name = "server_url") val serverUrl: String? = null,
)

data class ErrorBody(
    val status: String? = null,
    val message: String? = null,
    val code: String? = null,
)

class AuthFailureException(
    val authCode: String,
    override val message: String,
) : Exception(message)