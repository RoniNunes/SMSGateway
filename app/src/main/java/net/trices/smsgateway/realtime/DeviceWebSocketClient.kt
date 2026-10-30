package net.trices.smsgateway.realtime

import android.util.Log
import okhttp3.OkHttpClient
import org.json.JSONObject
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class DeviceWebSocketClient(
    private val wsUrl: String,
    private val onEvent: (String, JSONObject?) -> Unit,
    private val onConnected: (ConnectedPayload) -> Unit,
    private val onDisconnected: () -> Unit,
) {
    private val tag = "DeviceWebSocket"
    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    fun start() {
        stop()
        val request = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(tag, "WebSocket ligado")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(tag, "WebSocket fechado: $code $reason")
                onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w(tag, "WebSocket falhou: ${t.message}")
                onDisconnected()
            }
        })
    }

    fun stop() {
        webSocket?.close(1000, "stop")
        webSocket = null
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.optString("type", "")
            if (type == "connected") {
                onConnected(
                    ConnectedPayload(
                        type = type,
                        user_id = json.optInt("user_id"),
                        device_id = json.optInt("device_id"),
                        device_name = json.optString("device_name"),
                    ),
                )
                return
            }
            if (type.isNotEmpty()) onEvent(type, json.optJSONObject("payload"))
        } catch (e: Exception) {
            Log.w(tag, "Mensagem WS inválida: ${e.message}")
        }
    }
}

data class ConnectedPayload(
    val type: String? = null,
    val user_id: Int? = null,
    val device_id: Int? = null,
    val device_name: String? = null,
    val topics: List<String>? = null,
)