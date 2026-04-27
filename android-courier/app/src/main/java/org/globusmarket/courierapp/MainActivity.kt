package org.globusmarket.courierapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.zxing.integration.android.IntentIntegrator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.globusmarket.courierapp.api.AcceptRequest
import org.globusmarket.courierapp.api.ApiProvider
import org.globusmarket.courierapp.api.OrderDto
import org.globusmarket.courierapp.data.TokenStore
import org.globusmarket.courierapp.databinding.ActivityMainBinding
import org.globusmarket.courierapp.service.CourierTrackingService

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var tokenStore: TokenStore
    private val api by lazy { ApiProvider.create(BuildConfig.API_BASE_URL) }
    private var activeOrder: OrderDto? = null

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (!granted) {
            showLocationRequiredDialog()
        }
    }

    private val qrLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val parsed = IntentIntegrator.parseActivityResult(result.resultCode, result.data)
        if (parsed != null) {
            if (parsed.contents.isNullOrBlank()) {
                toast("QR/token o‘qilmadi")
            } else {
                binding.tokenInput.setText(parsed.contents.trim())
                toast("Token QR orqali olindi")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        binding.tokenInput.setText(tokenStore.getToken())

        binding.saveTokenBtn.setOnClickListener {
            val token = binding.tokenInput.text?.toString()?.trim().orEmpty()
            if (token.isEmpty()) {
                toast("Token kiriting")
                return@setOnClickListener
            }
            tokenStore.saveToken(token)
            toast("Token saqlandi")
        }

        binding.scanQrBtn.setOnClickListener {
            val integrator = IntentIntegrator(this)
            integrator.setPrompt("Courier QR ni skan qiling")
            integrator.setOrientationLocked(true)
            integrator.setBeepEnabled(true)
            qrLauncher.launch(integrator.createScanIntent())
        }

        binding.loadOrderBtn.setOnClickListener { loadOrder() }
        binding.acceptBtn.setOnClickListener { acceptDelivery() }
        binding.deliverBtn.setOnClickListener { completeDelivery() }
        binding.openMapsBtn.setOnClickListener { openInGoogleMaps() }
    }

    private fun loadOrder() {
        val token = binding.tokenInput.text?.toString()?.trim().orEmpty()
        if (token.isBlank()) {
            toast("Token kiriting yoki QR scan qiling")
            return
        }
        tokenStore.saveToken(token)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.getCourierOrder(token)
                val order = response.order
                withContext(Dispatchers.Main) {
                    if (order == null) {
                        showInvalidTokenMessage(response.message)
                        return@withContext
                    }
                    activeOrder = order
                    renderOrder(order)
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) {
                    showInvalidTokenMessage("Token noto‘g‘ri yoki yaroqsiz")
                }
            }
        }
    }

    private fun renderOrder(order: OrderDto) {
        val address = order.addressText ?: order.customerAddress ?: "-"
        val itemCount = order.items?.sumOf { it.qty ?: 0 } ?: 0
        val total = String.format("%,.0f", order.total ?: 0.0)
        binding.orderInfoText.text = "#${order.orderNumber ?: "-"}\nManzil: $address\nOrientir: ${order.landmarkText ?: "-"}\nJami: $total so'm\nItems: $itemCount"
        binding.statusText.text = "Status: ${order.status ?: "-"}"
    }

    private fun acceptDelivery() {
        val token = tokenStore.getToken().ifBlank { binding.tokenInput.text?.toString()?.trim().orEmpty() }
        if (token.isBlank()) {
            toast("Token topilmadi")
            return
        }
        if (!hasLocationPermission()) {
            requestLocationPermission()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.acceptOrder(token, AcceptRequest())
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    response.order?.let { renderOrder(it) }
                    startTrackingService(token)
                    toast("Buyurtma qabul qilindi")
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { toast("Buyurtmani qabul qilishda xatolik") }
            }
        }
    }

    private fun completeDelivery() {
        val token = tokenStore.getToken().ifBlank { binding.tokenInput.text?.toString()?.trim().orEmpty() }
        if (token.isBlank()) {
            toast("Token topilmadi")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.deliverOrder(token)
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    response.order?.let { renderOrder(it) }
                    stopService(Intent(this@MainActivity, CourierTrackingService::class.java))
                    toast("Buyurtma topshirildi")
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { toast("Buyurtmani yakunlashda xatolik") }
            }
        }
    }

    private fun openInGoogleMaps() {
        val order = activeOrder ?: run {
            toast("Avval buyurtmani yuklang")
            return
        }
        val destination = if (order.locationLat != null && order.locationLng != null) {
            "${order.locationLat},${order.locationLng}"
        } else {
            Uri.encode(order.addressText ?: order.customerAddress ?: "")
        }
        if (destination.isBlank()) {
            toast("Manzil topilmadi")
            return
        }
        val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$destination")
        startActivity(Intent(Intent.ACTION_VIEW, uri))
    }

    private fun startTrackingService(token: String) {
        val serviceIntent = Intent(this, CourierTrackingService::class.java).apply {
            putExtra(CourierTrackingService.EXTRA_TOKEN, token)
            putExtra(CourierTrackingService.EXTRA_BASE_URL, BuildConfig.API_BASE_URL)
        }
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun requestLocationPermission() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
        }
        locationPermissionLauncher.launch(permissions.toTypedArray())
    }

    private fun showLocationRequiredDialog() {
        AlertDialog.Builder(this)
            .setTitle("Lokatsiya ruxsati kerak")
            .setMessage("Tracking ishlashi uchun Location ruxsati kerak. Ruxsat bermasangiz aktiv yetkazib berish tracking boshlanmaydi.")
            .setPositiveButton("Qayta urinish") { _, _ -> requestLocationPermission() }
            .setNegativeButton("Yopish", null)
            .show()
    }

    private fun showInvalidTokenMessage(message: String?) {
        Toast.makeText(this, message ?: "Invalid QR/token", Toast.LENGTH_LONG).show()
        binding.statusText.text = "Status: Token yaroqsiz"
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
