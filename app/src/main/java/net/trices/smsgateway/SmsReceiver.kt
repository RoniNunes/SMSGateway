package net.trices.smsgateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import net.trices.smsgateway.api.AuthFailureException
import net.trices.smsgateway.api.GatewayClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SmsReceiver : BroadcastReceiver() {

    private val tag = "SmsReceiver"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (!GatewayPrefs.isConfigured(context)) return

        val messages = extractMessages(intent)
        for ((phone, body) in messages) {
            Log.d(tag, "SMS recebido de: $phone")
            uploadSms(context, phone, body)
        }
    }

    private fun extractMessages(intent: Intent): List<Pair<String, String>> {
        val result = mutableListOf<Pair<String, String>>()
        val bundle = intent.extras ?: return result

        if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION == intent.action) {
            val pdus = bundle.get("pdus") as? Array<*> ?: return result
            val format = bundle.getString("format")
            for (pdu in pdus) {
                val bytes = pdu as? ByteArray ?: continue
                val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    SmsMessage.createFromPdu(bytes, format)
                } else {
                    @Suppress("DEPRECATION")
                    SmsMessage.createFromPdu(bytes)
                }
                val phone = sms.displayOriginatingAddress ?: continue
                val body = sms.displayMessageBody ?: continue
                result.add(phone to body)
            }
        }
        return result
    }

    private fun uploadSms(context: Context, phone: String, msg: String) {
        val pending = goAsync()
        scope.launch {
            try {
                val api = GatewayClient.createApi(context)
                val now = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
                api.saveSms(
                    deviceToken = GatewayClient.deviceToken(context),
                    phone = phone,
                    msg = msg,
                    date = now,
                    dateSent = now,
                )
            } catch (e: AuthFailureException) {
                Log.e(tag, "Token inválido: ${e.message}")
                val authIntent = Intent(GatewayEvents.ACTION_AUTH_REVOKED).apply {
                    setPackage(context.packageName)
                    putExtra(GatewayEvents.EXTRA_AUTH_CODE, e.authCode)
                    putExtra(GatewayEvents.EXTRA_MESSAGE, e.message)
                }
                context.sendBroadcast(authIntent)
            } catch (e: Exception) {
                Log.e(tag, "Erro ao enviar SMS ao servidor: ${e.message}")
            } finally {
                pending.finish()
            }
        }
    }
}