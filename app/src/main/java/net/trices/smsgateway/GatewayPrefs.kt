package net.trices.smsgateway

import android.content.Context

object GatewayPrefs {
    private const val PREFS = "smsgateway_prefs"
    private const val KEY_SERVER = "server_url"
    private const val KEY_TOKEN = "device_token"
    private const val KEY_DEVICE = "device_name"
    private const val KEY_PHONE = "phone_number"
    private const val KEY_PHONE_MANUAL = "phone_manual"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_DEVICE_ID = "device_id"
    private val DEFAULT_SERVER = BuildConfig.DEFAULT_SERVER_URL

    private fun prefs(ctx: Context) =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun isConfigured(ctx: Context): Boolean = getDeviceToken(ctx).isNotEmpty()

    fun normalizeServerUrl(url: String): String = url.trim().trimEnd('/')

    fun getServerUrl(ctx: Context): String =
        normalizeServerUrl(prefs(ctx).getString(KEY_SERVER, DEFAULT_SERVER) ?: DEFAULT_SERVER)

    fun updateServerUrl(ctx: Context, url: String) {
        val normalized = normalizeServerUrl(url)
        if (normalized.isEmpty()) return
        prefs(ctx).edit().putString(KEY_SERVER, normalized).apply()
    }

    fun isPhoneManual(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_PHONE_MANUAL, false)

    fun setPhoneManual(ctx: Context, manual: Boolean) {
        prefs(ctx).edit().putBoolean(KEY_PHONE_MANUAL, manual).apply()
    }

    fun updatePhoneNumber(ctx: Context, phone: String, manual: Boolean = true) {
        val normalized = DevicePhone.normalize(phone) ?: phone.trim()
        if (normalized.isEmpty()) return
        prefs(ctx).edit()
            .putString(KEY_PHONE, normalized)
            .putBoolean(KEY_PHONE_MANUAL, manual)
            .apply()
    }

    fun updateDeviceName(ctx: Context, name: String) {
        val normalized = name.trim()
        if (normalized.isEmpty()) return
        prefs(ctx).edit().putString(KEY_DEVICE, normalized).apply()
    }

    fun getDeviceToken(ctx: Context): String =
        prefs(ctx).getString(KEY_TOKEN, "") ?: ""

    fun getDeviceName(ctx: Context): String =
        prefs(ctx).getString(KEY_DEVICE, "Android") ?: "Android"

    fun getPhoneNumber(ctx: Context): String =
        prefs(ctx).getString(KEY_PHONE, "") ?: ""

    fun getUserId(ctx: Context): Int = prefs(ctx).getInt(KEY_USER_ID, 0)

    fun getDeviceId(ctx: Context): Int = prefs(ctx).getInt(KEY_DEVICE_ID, 0)

    fun saveRegistration(
        ctx: Context,
        serverUrl: String,
        deviceToken: String,
        deviceName: String,
        userId: Int = 0,
        deviceId: Int = 0,
        phoneNumber: String = "",
        phoneManual: Boolean = phoneNumber.isNotBlank(),
    ) {
        prefs(ctx).edit()
            .putString(KEY_SERVER, normalizeServerUrl(serverUrl))
            .putString(KEY_TOKEN, deviceToken)
            .putString(KEY_DEVICE, deviceName)
            .putString(KEY_PHONE, phoneNumber.trim())
            .putBoolean(KEY_PHONE_MANUAL, phoneManual)
            .putInt(KEY_USER_ID, userId)
            .putInt(KEY_DEVICE_ID, deviceId)
            .apply()
    }

    fun saveSessionIds(ctx: Context, userId: Int, deviceId: Int) {
        prefs(ctx).edit()
            .putInt(KEY_USER_ID, userId)
            .putInt(KEY_DEVICE_ID, deviceId)
            .apply()
    }

    fun clearToken(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_DEVICE_ID)
            .apply()
    }

    fun clear(ctx: Context) {
        prefs(ctx).edit().clear().apply()
    }
}