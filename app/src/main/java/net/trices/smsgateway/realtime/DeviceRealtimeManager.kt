package net.trices.smsgateway.realtime

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import net.trices.smsgateway.GatewayConfig
import net.trices.smsgateway.GatewayPrefs

class DeviceRealtimeManager(
    private val context: Context,
    private val onQueuePending: () -> Unit,
    private val onAuthRevoked: (String, String) -> Unit,
) {
    private val tag = "DeviceRealtime"
    private val handler = Handler(Looper.getMainLooper())
    private var wsClient: DeviceWebSocketClient? = null
    private var mqttClient: DeviceMqttClient? = null
    private var reconnectAttempts = 0

    fun start() {
        val token = GatewayPrefs.getDeviceToken(context)
        if (token.isEmpty()) return

        stop()

        wsClient = DeviceWebSocketClient(
            wsUrl = GatewayConfig.wsUrl(context),
            onEvent = ::handleEvent,
            onConnected = ::handleConnected,
            onDisconnected = { scheduleReconnect() },
        ).also { it.start() }

        val userId = GatewayPrefs.getUserId(context)
        if (userId > 0) startMqtt(userId)
    }

    fun stop() {
        handler.removeCallbacksAndMessages(null)
        wsClient?.stop()
        mqttClient?.stop()
        wsClient = null
        mqttClient = null
    }

    fun updateUserId(userId: Int) {
        if (userId > 0) startMqtt(userId)
    }

    private fun startMqtt(userId: Int) {
        mqttClient?.stop()
        mqttClient = DeviceMqttClient(
            brokerUrl = GatewayConfig.mqttWsUrl(context),
            deviceToken = GatewayPrefs.getDeviceToken(context),
            userId = userId,
            onEvent = ::handleEvent,
            onDisconnected = { scheduleReconnect() },
        ).also { it.start() }
    }

    private fun handleConnected(payload: ConnectedPayload) {
        reconnectAttempts = 0
        val userId = payload.user_id ?: 0
        val deviceId = payload.device_id ?: 0
        if (userId > 0) {
            GatewayPrefs.saveSessionIds(context, userId, deviceId)
            startMqtt(userId)
        }
        Log.i(tag, "Realtime ligado (user=$userId device=$deviceId)")
    }

    private fun handleEvent(type: String, payload: org.json.JSONObject?) {
        when (type) {
            "queue.pending" -> onQueuePending()
            "auth.revoked" -> {
                val reason = payload?.optString("reason") ?: "TOKEN_REVOKED"
                onAuthRevoked("INVALID_TOKEN", reason)
            }
        }
    }

    private fun scheduleReconnect() {
        if (!GatewayPrefs.isConfigured(context)) return
        reconnectAttempts++
        val delay = minOf(30_000L, 2_000L * reconnectAttempts)
        handler.postDelayed({
            if (GatewayPrefs.isConfigured(context)) start()
        }, delay)
    }
}