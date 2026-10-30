package net.trices.smsgateway

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.util.Locale

object DeviceName {

    private const val MAX_LEN = 64

    fun detect(ctx: Context): String {
        readGlobalDeviceName(ctx)?.let { normalize(it) }?.let { return it }
        readBluetoothName(ctx)?.let { normalize(it) }?.let { return it }
        return normalize(buildFromHardware()) ?: "Android"
    }

    private fun readGlobalDeviceName(ctx: Context): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return null
        return try {
            Settings.Global.getString(ctx.contentResolver, Settings.Global.DEVICE_NAME)
        } catch (_: Exception) {
            null
        }
    }

    private fun readBluetoothName(ctx: Context): String? {
        return try {
            Settings.Secure.getString(ctx.contentResolver, "bluetooth_name")
        } catch (_: Exception) {
            null
        }
    }

    private fun buildFromHardware(): String {
        val manufacturer = Build.MANUFACTURER.trim()
            .replaceFirstChar { ch ->
                if (ch.isLowerCase()) ch.titlecase(Locale.getDefault()) else ch.toString()
            }
        val model = Build.MODEL.trim()
        if (model.isEmpty()) return manufacturer.ifEmpty { "Android" }
        return if (model.contains(manufacturer, ignoreCase = true)) {
            model
        } else {
            "$manufacturer $model"
        }
    }

    fun normalize(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val cleaned = raw.trim().replace(Regex("\\s+"), " ")
        if (cleaned.length < 2) return null
        if (cleaned.equals("unknown", ignoreCase = true)) return null
        return cleaned.take(MAX_LEN)
    }

    /** Prioridade: campo manual → detecção automática → parâmetro QR/deep link. */
    fun resolveForRegistration(manual: String?, deepLink: String?, ctx: Context): String {
        normalize(manual)?.let { return it }
        val detected = detect(ctx)
        if (detected.isNotEmpty()) return detected
        normalize(deepLink)?.let { return it }
        return "Android"
    }
}