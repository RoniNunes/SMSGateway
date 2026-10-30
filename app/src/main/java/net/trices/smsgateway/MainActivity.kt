package net.trices.smsgateway

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.telephony.SmsManager
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.trices.smsgateway.api.GatewayClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private val tag = "SMSGateway"
    private val reqCodeAllPermissions = 100

    private lateinit var etPhone: TextInputEditText
    private lateinit var etMsg: TextInputEditText
    private lateinit var btnSendSMS: MaterialButton
    private lateinit var btnReadSMS: MaterialButton
    private lateinit var lvSMS: ListView
    private lateinit var tvCount: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvServer: TextView
    private lateinit var statusBadge: LinearLayout
    private lateinit var statusDot: View
    private var authBanner: TextView? = null

    private val smsList = mutableListOf<SmsItem>()
    private lateinit var smsAdapter: SmsAdapter
    private var readingInbox = false
    private var openingSettings = false
    private var lastServerLabel = ""

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val online = intent?.getBooleanExtra(GatewayEvents.EXTRA_ONLINE, false) ?: false
            val msg = intent?.getStringExtra(GatewayEvents.EXTRA_MESSAGE)
            updateStatusBadge(online, msg ?: if (online) getString(R.string.status_online) else getString(R.string.status_offline))
            refreshServerLabelIfChanged()
        }
    }

    private val authReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(GatewayEvents.EXTRA_MESSAGE)
                ?: getString(R.string.auth_generic)
            showAuthRevokedUi(message)
        }
    }

    data class SmsItem(val phone: String, val message: String, val date: String) {
        fun initial(): String {
            val clean = phone.replace(Regex("[^0-9A-Za-z]"), "")
            return if (clean.isNotEmpty()) clean.last().uppercaseChar().toString() else "?"
        }
    }

    inner class SmsAdapter(ctx: Context, items: List<SmsItem>) :
        ArrayAdapter<SmsItem>(ctx, 0, items) {
        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val view = convertView ?: LayoutInflater.from(context)
                .inflate(R.layout.item_sms, parent, false)
            val item = getItem(position) ?: return view
            view.findViewById<TextView>(R.id.tvInitial).text = item.initial()
            view.findViewById<TextView>(R.id.tvPhone).text = item.phone
            view.findViewById<TextView>(R.id.tvDate).text = item.date
            view.findViewById<TextView>(R.id.tvMessage).text = item.message
            return view
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!GatewayPrefs.isConfigured(this)) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.statusBarColor = ContextCompat.getColor(this, R.color.colorSurface)
        }

        etPhone = findViewById(R.id.etPhoneNum)
        etMsg = findViewById(R.id.etMsg)
        btnReadSMS = findViewById(R.id.btnRead)
        btnSendSMS = findViewById(R.id.btnSend)
        lvSMS = findViewById(R.id.lvSMS)
        tvCount = findViewById(R.id.tvCount)
        tvStatus = findViewById(R.id.tvStatus)
        tvServer = findViewById(R.id.tvServer)
        statusBadge = findViewById(R.id.statusBadge)
        statusDot = findViewById(R.id.statusDot)
        authBanner = findViewById(R.id.tvAuthBanner)

        smsAdapter = SmsAdapter(this, smsList)
        lvSMS.adapter = smsAdapter

        btnSendSMS.isEnabled = false
        btnReadSMS.isEnabled = false

        tvCount.text = getString(R.string.inbox_count, 0)
        updateStatusBadge(false, getString(R.string.status_connecting))
        requestAllPermissions()

        btnReadSMS.setOnClickListener { readInboxSms() }
        btnSendSMS.setOnClickListener { sendSmsManual() }
        findViewById<View>(R.id.btnSettings).setOnClickListener { openSettings() }

        refreshServerLabelIfChanged()
    }

    override fun onResume() {
        super.onResume()
        openingSettings = false
        refreshServerLabelIfChanged()
    }

    private fun buildServerLabel(): String {
        val name = GatewayPrefs.getDeviceName(this)
        val server = GatewayPrefs.getServerUrl(this)
        val phone = GatewayPrefs.getPhoneNumber(this)
        return if (phone.isNotEmpty()) {
            "$name · $phone · $server"
        } else {
            "$name · $server"
        }
    }

    private fun refreshServerLabelIfChanged() {
        val label = buildServerLabel()
        if (label == lastServerLabel) return
        lastServerLabel = label
        tvServer.text = label
    }

    override fun onStart() {
        super.onStart()
        val statusFilter = IntentFilter(GatewayEvents.ACTION_STATUS)
        val authFilter = IntentFilter(GatewayEvents.ACTION_AUTH_REVOKED)
        
        ContextCompat.registerReceiver(
            this,
            statusReceiver,
            statusFilter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            this,
            authReceiver,
            authFilter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        
        startQueueService()
    }

    override fun onStop() {
        super.onStop()
        unregisterReceiver(statusReceiver)
        unregisterReceiver(authReceiver)
    }

    private fun openSettings() {
        if (openingSettings) return
        openingSettings = true
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    private fun startRePairing() {
        GatewayPrefs.clearToken(this)
        stopService(Intent(this, SmsQueueService::class.java))
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }

    private fun showAuthRevokedUi(message: String) {
        authBanner?.apply {
            visibility = View.VISIBLE
            text = message
        }
        updateStatusBadge(false, getString(R.string.status_offline))

        AlertDialog.Builder(this)
            .setTitle(R.string.auth_dialog_title)
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton(R.string.auth_reconnect) { _, _ -> startRePairing() }
            .show()
    }

    private fun startQueueService() {
        if (SmsQueueService.isRunning) return
        val intent = Intent(this, SmsQueueService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        Log.i(tag, "SmsQueueService iniciado")
    }

    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val pm = getSystemService(POWER_SERVICE) as? PowerManager ?: return
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            } catch (e: Exception) {
                Log.w(tag, "Não foi possível pedir exclusão de bateria", e)
            }
        }
    }

    private fun updateStatusBadge(online: Boolean, label: String) {
        tvStatus.text = if (online) getString(R.string.status_online) else getString(R.string.status_offline)
        statusBadge.setBackgroundResource(if (online) R.drawable.badge_active else R.drawable.badge_offline)
        statusDot.setBackgroundResource(if (online) R.drawable.circle_green else R.drawable.circle_red)
        tvStatus.setTextColor(
            ContextCompat.getColor(this, if (online) R.color.colorSuccess else R.color.colorError),
        )
    }

    private fun requestAllPermissions() {
        val needed = mutableListOf<String>()
        if (!checkPerm(Manifest.permission.SEND_SMS)) needed.add(Manifest.permission.SEND_SMS)
        if (!checkPerm(Manifest.permission.READ_SMS)) needed.add(Manifest.permission.READ_SMS)
        if (!checkPerm(Manifest.permission.RECEIVE_SMS)) needed.add(Manifest.permission.RECEIVE_SMS)
        for (p in DevicePhone.requiredPermissions()) {
            if (!checkPerm(p)) needed.add(p)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !checkPerm(Manifest.permission.POST_NOTIFICATIONS)
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (needed.isEmpty()) {
            onPermissionsReady()
        } else {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), reqCodeAllPermissions)
        }
    }

    private fun onPermissionsReady() {
        enableButtons()
        refreshServerLabelIfChanged()
        window.decorView.postDelayed({ requestBatteryOptimizationExemption() }, 2500)
    }

    private fun checkPerm(p: String) =
        ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    private fun enableButtons() {
        btnSendSMS.isEnabled = true
        btnReadSMS.isEnabled = true
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == reqCodeAllPermissions) {
            onPermissionsReady()
            if (checkPerm(Manifest.permission.SEND_SMS)) btnSendSMS.isEnabled = true
            if (checkPerm(Manifest.permission.READ_SMS)) btnReadSMS.isEnabled = true
        }
    }

    private fun readInboxSms() {
        if (readingInbox) return
        readingInbox = true
        btnReadSMS.isEnabled = false
        btnReadSMS.text = getString(R.string.inbox_loading)
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val loaded = loadInboxBatch()
                withContext(Dispatchers.Main) {
                    smsList.clear()
                    smsList.addAll(loaded.items)
                    smsAdapter.notifyDataSetChanged()
                    tvCount.text = getString(R.string.inbox_count, loaded.items.size)
                    if (loaded.items.isEmpty()) {
                        showToast(getString(R.string.inbox_empty))
                    } else {
                        showToast(getString(R.string.inbox_loaded, loaded.items.size))
                    }
                }
                uploadInboxToServer(loaded.items)
            } catch (e: Exception) {
                Log.e(tag, "readInboxSms", e)
                withContext(Dispatchers.Main) {
                    showToast(getString(R.string.inbox_error))
                }
            } finally {
                withContext(Dispatchers.Main) {
                    readingInbox = false
                    btnReadSMS.text = getString(R.string.btn_read_sms)
                    if (checkPerm(Manifest.permission.READ_SMS)) btnReadSMS.isEnabled = true
                }
            }
        }
    }

    private data class InboxLoad(val items: List<SmsItem>)

    private fun loadInboxBatch(maxRows: Int = 80): InboxLoad {
        val cursor = contentResolver.query(
            Uri.parse("content://sms/inbox"),
            arrayOf("body", "address", "date"),
            null,
            null,
            "date DESC LIMIT $maxRows",
        ) ?: return InboxLoad(emptyList())

        return cursor.use { c ->
            val idxBody = c.getColumnIndex("body")
            val idxPhone = c.getColumnIndex("address")
            val idxDate = c.getColumnIndex("date")
            if (idxBody < 0 || !c.moveToFirst()) {
                return@use InboxLoad(emptyList())
            }

            val items = mutableListOf<SmsItem>()
            val sdf = SimpleDateFormat("dd/MM/yy  HH:mm", Locale.getDefault())
            do {
                val phone = c.getString(idxPhone) ?: ""
                val msg = c.getString(idxBody) ?: ""
                val date = try {
                    sdf.format(Date(c.getLong(idxDate)))
                } catch (_: Exception) {
                    "—"
                }
                items.add(SmsItem(phone, msg, date))
            } while (c.moveToNext())

            InboxLoad(items)
        }
    }

    private suspend fun uploadInboxToServer(items: List<SmsItem>) {
        if (items.isEmpty()) return
        val token = GatewayClient.deviceToken(this)
        val api = GatewayClient.createApi(this)
        for (item in items) {
            try {
                api.saveSms(
                    deviceToken = token,
                    phone = item.phone,
                    msg = item.message,
                    date = item.date,
                    dateSent = item.date,
                )
            } catch (e: Exception) {
                Log.w(tag, "Upload SMS falhou: ${e.message}")
            }
        }
    }

    private fun sendSmsManual() {
        val phone = etPhone.text?.toString()?.trim() ?: ""
        val msg = etMsg.text?.toString()?.trim() ?: ""
        if (phone.isEmpty()) {
            showToast(getString(R.string.manual_missing_phone))
            return
        }
        if (msg.isEmpty()) {
            showToast(getString(R.string.manual_missing_message))
            return
        }
        try {
            SmsManager.getDefault().sendTextMessage(phone, null, msg, null, null)
            showToast(getString(R.string.manual_sent, phone))
            etPhone.setText("")
            etMsg.setText("")
        } catch (e: Exception) {
            showToast(getString(R.string.manual_error, e.message ?: ""))
            Log.e(tag, "sendSmsManual error", e)
        }
    }

    private fun sendSmsToServer(phone: String, msg: String, date: String, dateSent: String) {
        lifecycleScope.launch {
            try {
                val api = GatewayClient.createApi(this@MainActivity)
                api.saveSms(
                    deviceToken = GatewayClient.deviceToken(this@MainActivity),
                    phone = phone,
                    msg = msg,
                    date = date,
                    dateSent = dateSent,
                )
            } catch (e: Exception) {
                Log.w(tag, "Servidor inacessível: ${e.message}")
            }
        }
    }

    private fun showToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}