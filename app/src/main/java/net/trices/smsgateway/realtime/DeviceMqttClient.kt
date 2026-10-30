package net.trices.smsgateway.realtime

import android.util.Log
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.json.JSONObject
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallback
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence

class DeviceMqttClient(
    private val brokerUrl: String,
    private val deviceToken: String,
    private val userId: Int,
    private val onEvent: (String, JSONObject?) -> Unit,
    private val onDisconnected: () -> Unit,
) {
    private val tag = "DeviceMqtt"
    private var client: MqttAsyncClient? = null

    fun start() {
        stop()
        if (userId <= 0) return

        Thread {
            try {
                val clientId = "smsgw-${deviceToken.take(12)}"
                val memoryPersistence = MemoryPersistence()
                val mqtt = MqttAsyncClient(brokerUrl, clientId, memoryPersistence)
                client = mqtt

                mqtt.setCallback(object : MqttCallback {
                    override fun connectionLost(cause: Throwable?) {
                        Log.w(tag, "MQTT desligado: ${cause?.message}")
                        onDisconnected()
                    }

                    override fun messageArrived(topic: String?, message: MqttMessage?) {
                        val text = message?.payload?.toString(Charsets.UTF_8) ?: return
                        handleMessage(text)
                    }

                    override fun deliveryComplete(token: IMqttDeliveryToken?) = Unit
                })

                val options = MqttConnectOptions().apply {
                    isCleanSession = true
                    isAutomaticReconnect = true
                    connectionTimeout = 15
                    keepAliveInterval = 30
                    userName = deviceToken
                }

                mqtt.connect(options).waitForCompletion(10_000)
                mqtt.subscribe("smsgw/u$userId/queue", 1)
                mqtt.subscribe("smsgw/u$userId/auth", 1)
                Log.i(tag, "MQTT ligado em $brokerUrl")
            } catch (e: Exception) {
                Log.w(tag, "MQTT indisponível: ${e.message}")
                onDisconnected()
            }
        }.start()
    }

    fun stop() {
        try {
            client?.disconnectForcibly(500, 500)
        } catch (_: Exception) {
            /* ignore */
        }
        client = null
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val type = json.optString("type", "")
            if (type.isNotEmpty()) onEvent(type, json.optJSONObject("payload"))
        } catch (e: Exception) {
            Log.w(tag, "Mensagem MQTT inválida: ${e.message}")
        }
    }
}