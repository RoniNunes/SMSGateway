package net.trices.smsgateway

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import net.trices.smsgateway.api.AuthFailureException
import net.trices.smsgateway.api.GatewayApi
import net.trices.smsgateway.api.GatewayClient
import net.trices.smsgateway.realtime.DeviceRealtimeManager

class SmsQueueService : Service() {

    private val tag = "SmsQueueService"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var api: GatewayApi
    private lateinit var realtime: DeviceRealtimeManager
    private var pollJob: Job? = null
    private var authRevoked = false

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        api = GatewayClient.createApi(this)
        realtime = DeviceRealtimeManager(
            context = this,
            onQueuePending = { scope.launch { processQueue() } },
            onAuthRevoked = { code, reason -> handleAuthRevoked(code, reason) },
        )
        startInForeground(getString(R.string.status_connecting))
        Log.i(tag, "Serviço iniciado → ${GatewayConfig.baseUrl(this)}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        authRevoked = false
        if (pollJob?.isActive != true) {
            realtime.start()
            startPolling()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        pollJob?.cancel()
        scope.cancel()
        realtime.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive && !authRevoked) {
                try {
                    heartbeat()
                    processQueue()
                } catch (e: AuthFailureException) {
                    handleAuthRevoked(e.authCode, e.message ?: "")
                    break
                } catch (e: Exception) {
                    Log.w(tag, "Poll falhou: ${e.message}")
                    broadcastStatus(false, getString(R.string.status_server_unreachable))
                    updateNotification(getString(R.string.status_server_unreachable))
                }
                delay(GatewayConfig.POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun heartbeat() {
        val token = GatewayClient.deviceToken(this)
        val phone = DevicePhone.syncToPrefs(this)
        val response = api.sendAction(
            deviceToken = token,
            action = "heartbeat",
            phone = phone.ifEmpty { null },
        )
        syncCanonicalServerUrl(response.serverUrl)
        syncDeviceProfile(response.deviceName, response.phoneNumber)
        val userId = response.userId ?: 0
        val deviceId = response.deviceId ?: 0
        if (userId > 0) {
            GatewayPrefs.saveSessionIds(this, userId, deviceId)
            realtime.updateUserId(userId)
        }
        broadcastStatus(true, getString(R.string.status_online))
    }

    private fun syncDeviceProfile(deviceName: String?, phoneNumber: String?) {
        deviceName?.trim()?.takeIf { it.isNotEmpty() }?.let { name ->
            if (name != GatewayPrefs.getDeviceName(this)) {
                GatewayPrefs.updateDeviceName(this, name)
            }
        }
        phoneNumber?.trim()?.takeIf { it.isNotEmpty() }?.let { phone ->
            val local = GatewayPrefs.getPhoneNumber(this)
            if (phone != local) {
                GatewayPrefs.updatePhoneNumber(this, phone, manual = GatewayPrefs.isPhoneManual(this))
            }
        }
    }

    private fun syncCanonicalServerUrl(serverUrl: String?) {
        val canonical = serverUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return
        val normalized = GatewayPrefs.normalizeServerUrl(canonical)
        if (normalized == GatewayPrefs.getServerUrl(this)) return
        GatewayPrefs.updateServerUrl(this, normalized)
        api = GatewayClient.createApi(this)
        realtime.stop()
        realtime.start()
        Log.i(tag, "URL do servidor actualizada → $normalized")
    }

    private suspend fun processQueue() {
        if (authRevoked) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            updateNotification(getString(R.string.status_missing_sms_permission))
            broadcastStatus(true, getString(R.string.status_missing_sms_permission))
            return
        }

        try {
            val token = GatewayClient.deviceToken(this)
            val queue = api.pendingQueue(deviceToken = token)
            val items = queue.data
            if (items.isEmpty()) {
                updateNotification(getString(R.string.status_queue_empty))
                broadcastStatus(true, getString(R.string.status_queue_empty))
                return
            }

            updateNotification(getString(R.string.status_sending, items.size))
            broadcastStatus(true, getString(R.string.status_sending, items.size))

            for (item in items) {
                sendSmsFromQueue(item.id, item.phone, item.message)
            }
        } catch (e: AuthFailureException) {
            handleAuthRevoked(e.authCode, e.message ?: "")
        } catch (e: Exception) {
            Log.e(tag, "Erro ao processar fila: ${e.message}")
            broadcastStatus(false, getString(R.string.status_server_unreachable))
            updateNotification(getString(R.string.status_server_unreachable))
        }
    }

    private suspend fun sendSmsFromQueue(id: Int, phone: String, msg: String) {
        val token = GatewayClient.deviceToken(this)
        try {
            val sm = SmsManager.getDefault()
            val parts = sm.divideMessage(msg)
            if (parts.size == 1) {
                sm.sendTextMessage(phone, null, msg, null, null)
            } else {
                sm.sendMultipartTextMessage(phone, null, parts, null, null)
            }
            api.sendAction(deviceToken = token, action = "sent", id = id)
            updateNotification(getString(R.string.status_sent_to, phone))
        } catch (e: Exception) {
            Log.e(tag, "Falha SMS #$id", e)
            api.sendAction(
                deviceToken = token,
                action = "failed",
                id = id,
                error = e.message ?: "Erro",
            )
            updateNotification(getString(R.string.status_send_failed))
        }
    }

    private fun handleAuthRevoked(code: String, reason: String) {
        if (authRevoked) return
        authRevoked = true
        pollJob?.cancel()
        realtime.stop()

        val message = when (code) {
            "DEVICE_INACTIVE" -> getString(R.string.auth_device_inactive)
            "INVALID_TOKEN", "TOKEN_REVOKED" -> getString(R.string.auth_token_revoked)
            else -> getString(R.string.auth_generic)
        }

        GatewayPrefs.clearToken(this)
        updateNotification(message)
        broadcastStatus(false, message)

        val intent = Intent(GatewayEvents.ACTION_AUTH_REVOKED).apply {
            setPackage(packageName)
            putExtra(GatewayEvents.EXTRA_AUTH_CODE, code)
            putExtra(GatewayEvents.EXTRA_AUTH_REASON, reason)
            putExtra(GatewayEvents.EXTRA_MESSAGE, message)
        }
        sendBroadcast(intent)
    }

    private fun broadcastStatus(online: Boolean, message: String) {
        val intent = Intent(GatewayEvents.ACTION_STATUS).apply {
            setPackage(packageName)
            putExtra(GatewayEvents.EXTRA_ONLINE, online)
            putExtra(GatewayEvents.EXTRA_MESSAGE, message)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = getString(R.string.notification_channel_desc)
        }
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
    }

    private fun startInForeground(text: String) {
        val notification = buildNotification(text)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(tag, "Falha ao iniciar Foreground Service com tipo: ${e.message}")
            try {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, notification)
            } catch (ex: Exception) {
                Log.e(tag, "Falha critica ao iniciar Foreground Service: ${ex.message}")
            }
        }
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "sms_queue_channel"
        private const val NOTIFICATION_ID = 1

        @Volatile
        var isRunning: Boolean = false
            private set
    }
}