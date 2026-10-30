package net.trices.smsgateway

import android.content.Context
import android.net.Uri

object GatewayConfig {
    const val POLL_INTERVAL_MS = 10_000L

    fun baseUrl(ctx: Context): String = GatewayPrefs.getServerUrl(ctx)

    fun saveUrl(ctx: Context): String = appendToken(ctx, "${baseUrl(ctx)}/save_sms.php")

    fun queueUrl(ctx: Context): String = appendToken(ctx, "${baseUrl(ctx)}/send_sms.php")

    fun registerUrl(ctx: Context): String = "${baseUrl(ctx)}/register.php"

    fun wsUrl(ctx: Context): String {
        val base = baseUrl(ctx)
        val wsBase = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> "ws://$base"
        }
        val token = Uri.encode(GatewayPrefs.getDeviceToken(ctx))
        return "$wsBase/device/ws?device_token=$token"
    }

    fun mqttWsUrl(ctx: Context): String {
        val base = baseUrl(ctx)
        return when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://") + "/device/mqtt"
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://") + "/device/mqtt"
            else -> "ws://$base/device/mqtt"
        }
    }

    private fun appendToken(ctx: Context, url: String): String {
        val token = GatewayPrefs.getDeviceToken(ctx)
        if (token.isEmpty()) return url
        return "$url${if (url.contains("?")) "&" else "?"}device_token=${Uri.encode(token)}"
    }
}