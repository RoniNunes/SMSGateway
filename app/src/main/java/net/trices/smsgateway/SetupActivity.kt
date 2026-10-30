package net.trices.smsgateway

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch
import net.trices.smsgateway.api.GatewayClient

class SetupActivity : AppCompatActivity() {

    private lateinit var etServer: TextInputEditText
    private lateinit var etCode: TextInputEditText
    private lateinit var etName: TextInputEditText
    private lateinit var etPhoneNumber: TextInputEditText
    private lateinit var btnRegister: MaterialButton
    private var progressBar: ProgressBar? = null
    private var tvStatus: TextView? = null
    private var tvPhoneAuto: TextView? = null
    private var tvDeviceAuto: TextView? = null
    private var cardPairingInfo: MaterialCardView? = null
    private var tvPairingServer: TextView? = null
    private var tvPairingCode: TextView? = null
    private var registering = false
    private var pendingDeepLinkPhone = ""
    private var pendingDeepLinkDeviceName = ""
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (GatewayPrefs.isConfigured(this)) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_setup)

        etServer = findViewById(R.id.etServer)
        etCode = findViewById(R.id.etCode)
        etName = findViewById(R.id.etDeviceName)
        etPhoneNumber = findViewById(R.id.etPhoneNumber)
        btnRegister = findViewById(R.id.btnRegister)
        progressBar = findViewById(R.id.progressPairing)
        tvStatus = findViewById(R.id.tvPairingStatus)
        tvPhoneAuto = findViewById(R.id.tvPhoneAuto)
        tvDeviceAuto = findViewById(R.id.tvDeviceAuto)
        cardPairingInfo = findViewById(R.id.cardPairingInfo)
        tvPairingServer = findViewById(R.id.tvPairingServer)
        tvPairingCode = findViewById(R.id.tvPairingCode)

        setupCopyActions()

        btnRegister.setOnClickListener { registerDevice(automatic = false) }

        if (!handleDeepLink(intent)) {
            etServer.setText(GatewayPrefs.getServerUrl(this))
        }
        refreshDetectedDeviceName()
        requestPhonePermissionAndDetect()
    }

    private val refreshFieldsRunnable = Runnable { refreshDetectedFields() }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(refreshFieldsRunnable)
        handler.postDelayed(refreshFieldsRunnable, 400)
    }

    override fun onDestroy() {
        handler.removeCallbacks(refreshFieldsRunnable)
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent?.let { handleDeepLink(it) }
    }

    private fun handleDeepLink(intent: Intent): Boolean {
        val uri = intent.data ?: return false
        val isPairLink = uri.host == "pair" && uri.scheme == "smsgateway"
        val isHttpsPair = uri.path?.contains("pair.php") == true || uri.path?.contains("/pair") == true
        if (!isPairLink && !isHttpsPair) return false

        val server = firstNonEmpty(uri.getQueryParameter("server"), buildServerFromUri(uri))
        val code = uri.getQueryParameter("code")?.trim()?.uppercase() ?: ""
        val sig = uri.getQueryParameter("sig")?.trim() ?: ""
        val name = uri.getQueryParameter("name")?.trim() ?: ""
        val phone = uri.getQueryParameter("phone")?.trim() ?: ""

        if (server.isNotEmpty()) etServer.setText(GatewayPrefs.normalizeServerUrl(server))
        if (code.isNotEmpty()) etCode.setText(code)
        if (name.isNotEmpty()) pendingDeepLinkDeviceName = name
        if (phone.isNotEmpty()) pendingDeepLinkPhone = phone

        if (server.isNotEmpty() && code.isNotEmpty()) {
            showPairingInfo(
                GatewayPrefs.normalizeServerUrl(server),
                code.uppercase(),
            )
            setStatus(getString(R.string.setup_auto_pairing))
            requestPhonePermissionAndDetect {
                registerDevice(automatic = true, sig = sig)
            }
            return true
        }
        return false
    }

    private fun setupCopyActions() {
        findViewById<TextInputLayout>(R.id.tilServer).setEndIconOnClickListener {
            copyToClipboard(
                label = getString(R.string.setup_server_hint),
                text = etServer.text?.toString(),
                copiedMessage = getString(R.string.setup_copied_server),
            )
        }
        findViewById<TextInputLayout>(R.id.tilCode).setEndIconOnClickListener {
            copyToClipboard(
                label = getString(R.string.setup_code_hint),
                text = etCode.text?.toString(),
                copiedMessage = getString(R.string.setup_copied_code),
            )
        }
        findViewById<MaterialButton>(R.id.btnCopyPairingServer).setOnClickListener {
            copyToClipboard(
                label = getString(R.string.setup_server_hint),
                text = tvPairingServer?.text?.toString() ?: etServer.text?.toString(),
                copiedMessage = getString(R.string.setup_copied_server),
            )
        }
        findViewById<MaterialButton>(R.id.btnCopyPairingCode).setOnClickListener {
            copyToClipboard(
                label = getString(R.string.setup_code_hint),
                text = tvPairingCode?.text?.toString() ?: etCode.text?.toString(),
                copiedMessage = getString(R.string.setup_copied_code),
            )
        }
    }

    private fun showPairingInfo(server: String, code: String) {
        cardPairingInfo?.visibility = View.VISIBLE
        tvPairingServer?.text = server
        tvPairingCode?.text = code
    }

    private fun copyToClipboard(label: String, text: String?, copiedMessage: String) {
        val value = text?.trim().orEmpty()
        if (value.isEmpty()) {
            toast(getString(R.string.setup_copy_empty))
            return
        }
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        toast(copiedMessage)
    }

    private fun requestPhonePermissionAndDetect(onReady: (() -> Unit)? = null) {
        val needed = DevicePhone.requiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isEmpty()) {
            refreshDetectedFields()
            onReady?.invoke()
            return
        }
        tvPhoneAuto?.text = getString(R.string.setup_phone_permission_needed)
        pendingPhoneCallback = onReady
        ActivityCompat.requestPermissions(this, needed.toTypedArray(), REQ_PHONE)
    }

    private var pendingPhoneCallback: (() -> Unit)? = null

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PHONE) {
            refreshDetectedFields()
            pendingPhoneCallback?.invoke()
            pendingPhoneCallback = null
        }
    }

    private fun refreshDetectedDeviceName() {
        val detected = DeviceName.detect(this)
        if (detected.isNotEmpty() && etName.text.isNullOrBlank()) {
            etName.setText(detected)
        }
        tvDeviceAuto?.text = getString(R.string.setup_name_detected, detected)
    }

    private fun refreshDetectedFields() {
        refreshDetectedDeviceName()

        val manualPhone = etPhoneNumber.text?.toString()
        val resolvedPhone = DevicePhone.resolveForRegistration(manualPhone, pendingDeepLinkPhone, this)

        if (resolvedPhone.isNotEmpty() && manualPhone.isNullOrBlank()) {
            etPhoneNumber.setText(resolvedPhone)
        }

        tvPhoneAuto?.text = when (DevicePhone.detectionStatus(this, resolvedPhone)) {
            DevicePhone.DetectionStatus.NO_TELEPHONY ->
                getString(R.string.setup_phone_no_telephony)
            DevicePhone.DetectionStatus.PERMISSION_NEEDED ->
                getString(R.string.setup_phone_permission_needed)
            DevicePhone.DetectionStatus.DETECTED ->
                getString(R.string.setup_phone_detected, resolvedPhone)
            DevicePhone.DetectionStatus.NO_SIM_NUMBER ->
                getString(R.string.setup_phone_not_detected)
        }
    }

    private fun registerDevice(automatic: Boolean, sig: String = "") {
        if (registering) return

        val server = GatewayPrefs.normalizeServerUrl(etServer.text?.toString() ?: "")
        val code = etCode.text?.toString()?.trim()?.uppercase() ?: ""
        refreshDetectedFields()
        val name = DeviceName.resolveForRegistration(
            etName.text?.toString(),
            pendingDeepLinkDeviceName,
            this,
        )
        val resolvedPhone = DevicePhone.resolveForRegistration(
            etPhoneNumber.text?.toString(),
            pendingDeepLinkPhone,
            this,
        )

        if (server.isEmpty() || code.isEmpty()) {
            toast(getString(R.string.setup_missing_fields))
            return
        }

        if (resolvedPhone.isEmpty()) {
            toast(getString(R.string.setup_phone_required))
            etPhoneNumber.requestFocus()
            return
        }

        registering = true
        btnRegister.isEnabled = false
        progressBar?.visibility = View.VISIBLE
        if (!automatic) setStatus(getString(R.string.setup_registering))

        val phoneManual = etPhoneNumber.text?.toString()?.trim()?.isNotEmpty() == true
        GatewayPrefs.saveRegistration(
            this,
            server,
            "",
            name,
            phoneNumber = resolvedPhone,
            phoneManual = phoneManual,
        )

        lifecycleScope.launch {
            try {
                val api = GatewayClient.createApi(this@SetupActivity)
                val response = api.registerDevice(
                    code = code,
                    name = name,
                    phone = resolvedPhone,
                    sig = sig.ifEmpty { null },
                )

                if (response.status == "success" && !response.deviceToken.isNullOrEmpty()) {
                    val canonicalServer = GatewayPrefs.normalizeServerUrl(
                        response.serverUrl?.takeIf { it.isNotBlank() } ?: server,
                    )
                    val finalPhone = DevicePhone.normalize(response.phoneNumber)
                        ?: resolvedPhone
                    val finalName = response.deviceName?.trim()?.takeIf { it.isNotEmpty() }
                        ?: name

                    GatewayPrefs.saveRegistration(
                        this@SetupActivity,
                        canonicalServer,
                        response.deviceToken,
                        finalName,
                        userId = 0,
                        deviceId = response.deviceId ?: 0,
                        phoneNumber = finalPhone,
                        phoneManual = phoneManual || finalPhone.isNotEmpty(),
                    )

                    try {
                        api.sendAction(
                            deviceToken = response.deviceToken,
                            action = "heartbeat",
                            phone = finalPhone,
                        )
                    } catch (_: Exception) {
                        // SmsQueueService sincroniza em seguida
                    }

                    toast(getString(R.string.setup_success_phone, finalPhone))
                    startActivity(Intent(this@SetupActivity, MainActivity::class.java))
                    finish()
                } else {
                    setStatus(response.message ?: getString(R.string.setup_error))
                    toast(response.message ?: getString(R.string.setup_error))
                    btnRegister.isEnabled = true
                }
            } catch (e: Exception) {
                setStatus(getString(R.string.setup_network_error))
                toast(getString(R.string.setup_network_error))
                btnRegister.isEnabled = true
            } finally {
                registering = false
                progressBar?.visibility = View.GONE
            }
        }
    }

    private fun buildServerFromUri(uri: Uri): String {
        val host = uri.host ?: return ""
        val port = uri.port
        return if (port > 0 && port != 80 && port != 443) {
            "${uri.scheme}://$host:$port"
        } else {
            "${uri.scheme}://$host"
        }
    }

    private fun firstNonEmpty(a: String?, b: String): String {
        if (!a.isNullOrBlank()) return a.trim()
        if (b.isNotBlank()) return b.trim()
        return ""
    }

    private fun setStatus(msg: String) {
        tvStatus?.apply {
            visibility = View.VISIBLE
            text = msg
        }
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
    }

    companion object {
        private const val REQ_PHONE = 101
    }
}