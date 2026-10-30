package net.trices.smsgateway

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
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

class SettingsActivity : AppCompatActivity() {

    private lateinit var etPhone: TextInputEditText
    private lateinit var tvPhoneHint: TextView
    private lateinit var btnSavePhone: MaterialButton
    private var savingPhone = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!GatewayPrefs.isConfigured(this)) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_settings)

        etPhone = findViewById(R.id.etSettingsPhone)
        tvPhoneHint = findViewById(R.id.tvSettingsPhoneHint)
        btnSavePhone = findViewById(R.id.btnSettingsSavePhone)

        refreshInfo()

        findViewById<MaterialButton>(R.id.btnSettingsBack).setOnClickListener { finish() }
        findViewById<MaterialButton>(R.id.btnSettingsPrivacy).setOnClickListener { openPrivacyPolicy() }
        findViewById<MaterialButton>(R.id.btnSettingsRepair).setOnClickListener { confirmRePair() }
        btnSavePhone.setOnClickListener { savePhoneNumber() }
        findViewById<MaterialButton>(R.id.btnSettingsDetectPhone).setOnClickListener { detectPhoneFromSim() }
    }

    override fun onResume() {
        super.onResume()
        refreshInfo()
    }

    private fun refreshInfo() {
        findViewById<TextView>(R.id.tvSettingsDevice).text = GatewayPrefs.getDeviceName(this)
        val phone = GatewayPrefs.getPhoneNumber(this)
        if (etPhone.text.isNullOrBlank() && phone.isNotEmpty()) {
            etPhone.setText(phone)
        } else if (phone.isNotEmpty() && etPhone.text?.toString() != phone && !etPhone.isFocused) {
            etPhone.setText(phone)
        }
        tvPhoneHint.text = when {
            GatewayPrefs.isPhoneManual(this) -> getString(R.string.settings_phone_manual)
            phone.isEmpty() -> getString(R.string.settings_phone_unknown)
            else -> getString(R.string.settings_phone_detected_hint, phone)
        }
        findViewById<TextView>(R.id.tvSettingsServer).text = GatewayPrefs.getServerUrl(this)
        findViewById<TextView>(R.id.tvSettingsStatus).text = getString(R.string.settings_status_connected)
    }

    private fun savePhoneNumber() {
        if (savingPhone) return
        val raw = etPhone.text?.toString()?.trim().orEmpty()
        val normalized = DevicePhone.normalize(raw)
        if (normalized.isNullOrEmpty()) {
            toast(getString(R.string.settings_phone_invalid))
            etPhone.requestFocus()
            return
        }

        savingPhone = true
        btnSavePhone.isEnabled = false
        GatewayPrefs.updatePhoneNumber(this, normalized, manual = true)

        lifecycleScope.launch {
            try {
                val api = GatewayClient.createApi(this@SettingsActivity)
                api.sendAction(
                    deviceToken = GatewayClient.deviceToken(this@SettingsActivity),
                    action = "heartbeat",
                    phone = normalized,
                )
                withContext(Dispatchers.Main) {
                    toast(getString(R.string.settings_phone_saved, normalized))
                    refreshInfo()
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) {
                    toast(getString(R.string.settings_phone_saved_local, normalized))
                    refreshInfo()
                }
            } finally {
                withContext(Dispatchers.Main) {
                    savingPhone = false
                    btnSavePhone.isEnabled = true
                }
            }
        }
    }

    private fun detectPhoneFromSim() {
        val needed = DevicePhone.requiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), REQ_PHONE)
            return
        }
        applyDetectedPhone()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_PHONE) {
            applyDetectedPhone()
        }
    }

    private fun applyDetectedPhone() {
        val detected = DevicePhone.detect(this)
        if (detected.isNullOrEmpty()) {
            toast(getString(R.string.setup_phone_not_detected))
            return
        }
        etPhone.setText(detected)
        GatewayPrefs.setPhoneManual(this, false)
        toast(getString(R.string.setup_phone_detected, detected))
        refreshInfo()
    }

    private fun openPrivacyPolicy() {
        val base = GatewayPrefs.getServerUrl(this).trimEnd('/')
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$base/privacy"))
        startActivity(intent)
    }

    private fun confirmRePair() {
        AlertDialog.Builder(this)
            .setTitle(R.string.settings_repair_title)
            .setMessage(R.string.settings_repair_message)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.settings_repair_confirm) { _, _ -> startRePairing() }
            .show()
    }

    private fun startRePairing() {
        GatewayPrefs.clearToken(this)
        stopService(Intent(this, SmsQueueService::class.java))
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
    }

    companion object {
        private const val REQ_PHONE = 102
    }
}