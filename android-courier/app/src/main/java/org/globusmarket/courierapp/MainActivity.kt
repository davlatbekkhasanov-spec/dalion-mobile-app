package org.globusmarket.courierapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.integration.android.IntentIntegrator
import org.globusmarket.courierapp.api.ApiProvider
import org.globusmarket.courierapp.data.LocalOrder
import org.globusmarket.courierapp.data.TokenStore
import org.globusmarket.courierapp.data.toLocalOrder
import org.globusmarket.courierapp.databinding.ActivityMainBinding
import org.globusmarket.courierapp.domain.model.OrderState
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var tokenStore: TokenStore
    private val api by lazy { ApiProvider.create(BuildConfig.API_BASE_URL) }
    private var orders = mutableListOf<LocalOrder>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        tokenStore = TokenStore(this)
        orders = tokenStore.getOrders()

        if (tokenStore.getLanguage().isBlank()) showLanguageSelector()
        bindProfile()
        setupUi()
        refreshAll()
    }

    private fun setupUi() {
        binding.registerBtn.setOnClickListener { saveProfile() }
        binding.scanQrBtn.setOnClickListener { openQrScanner() }
        binding.loadOrderBtn.setOnClickListener { loadOrderByToken(binding.tokenInput.text.toString()) }
        binding.acceptBtn.setOnClickListener { updateCurrentState(OrderState.OUT_FOR_DELIVERY, "out_for_delivery") }
        binding.deliverBtn.setOnClickListener { updateCurrentState(OrderState.DELIVERED, "delivered") }
        binding.saveTokenBtn.setOnClickListener { tokenStore.saveToken(binding.tokenInput.text.toString()) }
        binding.navDashboardBtn.setOnClickListener { show(binding.dashboardScreen) }
        binding.navActiveBtn.setOnClickListener { show(binding.activeOrderScreen) }
        binding.navProfileBtn.setOnClickListener { show(binding.profileScreen) }
        binding.navHistoryBtn.setOnClickListener { show(binding.historyScreen) }
        binding.openMapsBtn.setOnClickListener { startNavigation() }
        binding.callCustomerBtn.setOnClickListener { callCustomer() }
        binding.shiftToggleBtn.setOnClickListener { tokenStore.setShiftOnline(!tokenStore.getShiftOnline()); refreshAll() }
    }

    private fun show(v: View) {
        listOf(binding.dashboardScreen, binding.activeOrderScreen, binding.profileScreen, binding.historyScreen).forEach { it.visibility = View.GONE }
        v.visibility = View.VISIBLE
    }

    private fun showLanguageSelector() {
        val langs = arrayOf("O‘zbekcha", "Русский")
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Til / Язык")
            .setCancelable(false)
            .setItems(langs) { _, which ->
                val lang = if (which == 1) "ru" else "uz"
                tokenStore.saveLanguage(lang)
                val locale = Locale(lang)
                Locale.setDefault(locale)
                val cfg = resources.configuration
                cfg.setLocale(locale)
                resources.updateConfiguration(cfg, resources.displayMetrics)
                recreate()
            }.show()
    }

    private fun parseToken(input: String?): String {
        val value = input?.trim().orEmpty()
        val m = Regex("(?:^|/)courier/([^/?#]+)", RegexOption.IGNORE_CASE).find(value)?.groupValues?.getOrNull(1)
        return when {
            !m.isNullOrBlank() -> m
            value.startsWith("http", true) -> ""
            else -> value
        }
    }

    private fun loadOrderByToken(raw: String) {
        val token = parseToken(raw)
        if (token.isBlank()) return toast(getString(R.string.invalid_token))
        Thread {
            try {
                val dto = api.getCourierOrder(token).order ?: return@Thread
                val local = dto.toLocalOrder(token)
                orders.removeAll { it.token == token }
                orders.add(local)
                tokenStore.saveOrders(orders)
                runOnUiThread { refreshAll(); show(binding.activeOrderScreen) }
            } catch (_: Exception) { runOnUiThread { toast(getString(R.string.invalid_token)) } }
        }.start()
    }

    private fun updateCurrentState(state: OrderState, backend: String) {
        val token = parseToken(binding.tokenInput.text.toString())
        val idx = orders.indexOfFirst { it.token == token }
        if (idx < 0) return
        orders[idx] = orders[idx].copy(state = state, statusBackend = backend)
        tokenStore.saveOrders(orders)
        refreshAll()
    }

    private fun refreshAll() {
        val active = orders.filter { it.state == OrderState.ASSIGNED_PENDING_ACCEPT || it.state == OrderState.OUT_FOR_DELIVERY }
        val delivered = orders.filter { it.state == OrderState.DELIVERED }
        val settled = orders.filter { it.state == OrderState.SETTLED }
        binding.statsText.text = getString(R.string.stats_fmt, active.size, delivered.size, delivered.sumOf { it.deliveryFee })
        binding.shiftToggleBtn.text = if (tokenStore.getShiftOnline()) getString(R.string.shift_online) else getString(R.string.shift_offline)
        binding.orderInfoText.text = active.joinToString("\n\n") { "#${it.orderNumber} | ${it.customerName}\n${it.address}\n${getString(R.string.delivery_fee)}: ${it.deliveryFee.toInt()}" }
            .ifBlank { getString(R.string.no_active_order) }
        binding.historyScreen.findViewById<android.widget.TextView>(R.id.statusText)?.text = ""
        binding.statusText.text = getString(R.string.settlement_summary_fmt, delivered.size, delivered.sumOf { it.deliveryFee }, settled.size)
    }

    private fun saveProfile() { tokenStore.saveCourierProfile(org.globusmarket.courierapp.data.CourierProfileLocal(binding.courierNameInput.text.toString(), binding.courierPhoneInput.text.toString(), binding.vehicleTypeInput.text.toString(), binding.vehiclePlateInput.text.toString())); refreshAll() }
    private fun bindProfile() { val p = tokenStore.getCourierProfile(); binding.courierNameInput.setText(p.fullName); binding.courierPhoneInput.setText(if (p.phone.isBlank()) "+998" else p.phone); binding.vehicleTypeInput.setText(p.vehicleType); binding.vehiclePlateInput.setText(p.vehiclePlate); binding.tokenInput.setText(tokenStore.getToken()) }
    private fun startNavigation() { orders.lastOrNull()?.let { if (it.lat==null||it.lng==null) toast(getString(R.string.coords_missing)) else startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${it.lat},${it.lng}&mode=d"))) } }
    private fun callCustomer() { orders.lastOrNull()?.customerPhone?.takeIf { it.isNotBlank() }?.let { startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$it"))) } }
    private fun openQrScanner() { val i = IntentIntegrator(this); i.setPrompt("Scan"); i.setOrientationLocked(true); startActivityForResult(i.createScanIntent(), 989) }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) { super.onActivityResult(requestCode, resultCode, data); val p = IntentIntegrator.parseActivityResult(requestCode,resultCode,data); if (p?.contents!=null) { binding.tokenInput.setText(parseToken(p.contents)); loadOrderByToken(p.contents) } }
    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
}
