package net.trices.smsgateway

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

object DevicePhone {

    enum class DetectionStatus {
        NO_TELEPHONY,
        PERMISSION_NEEDED,
        NO_SIM_NUMBER,
        DETECTED,
    }

    /** READ_PHONE_STATE + READ_PHONE_NUMBERS (API 26+) para máxima compatibilidade com operadoras. */
    fun requiredPermissions(): Array<String> {
        val list = mutableListOf(Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            list.add(Manifest.permission.READ_PHONE_NUMBERS)
        }
        return list.toTypedArray()
    }

    fun hasPermission(ctx: Context): Boolean =
        requiredPermissions().all {
            ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED
        }

    fun hasTelephony(ctx: Context): Boolean {
        val pm = ctx.packageManager
        if (!pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) return false
        val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return false
        return try {
            @Suppress("DEPRECATION")
            tm.phoneType != TelephonyManager.PHONE_TYPE_NONE
        } catch (_: Exception) {
            pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
        }
    }

    fun hasSmsCapability(ctx: Context): Boolean =
        ctx.packageManager.hasSystemFeature("android.hardware.telephony.sms")

    fun detectionStatus(ctx: Context, resolved: String = ""): DetectionStatus {
        if (!hasTelephony(ctx)) return DetectionStatus.NO_TELEPHONY
        if (!hasPermission(ctx)) return DetectionStatus.PERMISSION_NEEDED
        if (resolved.isNotEmpty()) return DetectionStatus.DETECTED
        return DetectionStatus.NO_SIM_NUMBER
    }

    fun detect(ctx: Context): String? {
        if (!hasTelephony(ctx)) return null
        if (!hasPermission(ctx)) return null
        return detectFromSubscriptions(ctx)
            ?: detectFromTelephonySlots(ctx)
            ?: detectFromDefaultTelephony(ctx)
    }

    private fun detectFromSubscriptions(ctx: Context): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP_MR1) return null
        val sm = ctx.getSystemService(SubscriptionManager::class.java) ?: return null

        return try {
            val list = sm.activeSubscriptionInfoList ?: return null
            for (info in list) {
                val raw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    sm.getPhoneNumber(info.subscriptionId)
                } else {
                    @Suppress("DEPRECATION")
                    info.number
                }
                normalize(raw)?.let { return it }
            }
            null
        } catch (_: SecurityException) {
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun detectFromTelephonySlots(ctx: Context): String? {
        val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return null
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val sm = ctx.getSystemService(SubscriptionManager::class.java) ?: return null
                val subs = sm.activeSubscriptionInfoList ?: return null
                for (info in subs) {
                    val subTm = tm.createForSubscriptionId(info.subscriptionId)
                    normalize(subTm.line1Number)?.let { return it }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        normalize(sm.getPhoneNumber(info.subscriptionId))?.let { return it }
                    } else {
                        normalize(info.number)?.let { return it }
                    }
                }
            }
            null
        } catch (_: SecurityException) {
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun detectFromDefaultTelephony(ctx: Context): String? {
        val tm = ctx.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager ?: return null
        return try {
            normalize(tm.line1Number)
        } catch (_: SecurityException) {
            null
        }
    }

    fun normalize(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        if (trimmed.equals("unknown", ignoreCase = true)) return null
        val digits = trimmed.replace(Regex("[^+0-9]"), "")
        if (digits.length < 8) return null
        return digits
    }

    /**
     * Prioridade: chip/SIM → campo manual → parâmetro QR/deep link.
     */
    fun resolveForRegistration(manual: String?, deepLink: String?, ctx: Context): String {
        detect(ctx)?.let { return it }
        normalize(manual)?.let { return it }
        normalize(deepLink)?.let { return it }
        return ""
    }

    fun syncToPrefs(ctx: Context): String {
        val stored = GatewayPrefs.getPhoneNumber(ctx)
        if (GatewayPrefs.isPhoneManual(ctx)) return stored
        val detected = detect(ctx).orEmpty()
        if (detected.isNotEmpty() && detected != stored) {
            GatewayPrefs.updatePhoneNumber(ctx, detected, manual = false)
        }
        return detected.ifEmpty { stored }
    }
}