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
import org.globusmarket.courierapp.data.CourierProfileLocal
import org.globusmarket.courierapp.data.TokenStore
import org.globusmarket.courierapp.databinding.ActivityMainBinding
import org.globusmarket.courierapp.domain.state.CourierAction
import org.globusmarket.courierapp.domain.state.CourierStateManager
import org.globusmarket.courierapp.service.CourierTrackingService

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var tokenStore: TokenStore
    private val api by lazy { ApiProvider.create(BuildConfig.API_BASE_URL) }
    private var activeOrder: OrderDto? = null
    private val stateManager = CourierStateManager()

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
                val token = parseAndApplyToken(parsed.contents)
                if (token == null) {
                    showInvalidTokenMessage()
                    return@registerForActivityResult
                }
                toast("Token QR orqali olindi")
                loadOrder(token)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        parseAndApplyToken(tokenStore.getToken()) ?: binding.tokenInput.setText("")
        bindSavedProfile()
        updateUiForOrderState()
        stateManager.dispatch(CourierAction.SessionAuthenticated)

        binding.saveTokenBtn.setOnClickListener {
            val token = parseAndApplyToken(binding.tokenInput.text?.toString())
            if (token.isNullOrBlank()) {
                showInvalidTokenMessage()
                return@setOnClickListener
            }
            tokenStore.saveCourierProfile(readProfileFromInputs())
            tokenStore.saveToken(token)
            toast("Token va kuryer profili saqlandi")
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
        binding.toggleAdvancedBtn.setOnClickListener {
            val showAdvanced = binding.advancedSection.visibility != android.view.View.VISIBLE
            binding.advancedSection.visibility = if (showAdvanced) android.view.View.VISIBLE else android.view.View.GONE
            binding.toggleAdvancedBtn.text = if (showAdvanced) "Advanced yashirish" else "Advanced"
        }
    }

    private fun loadOrder(explicitToken: String? = null) {
        val token = explicitToken ?: parseAndApplyToken(binding.tokenInput.text?.toString())
        if (token.isNullOrBlank()) {
            showInvalidTokenMessage()
            return
        }
        tokenStore.saveToken(token)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.getCourierOrder(token)
                val order = response.order
                withContext(Dispatchers.Main) {
                    if (order == null) {
                        showInvalidTokenMessage()
                        return@withContext
                    }
                    activeOrder = order
                    stateManager.dispatch(CourierAction.ActiveOrderLoaded(order.orderNumber, order.status))
                    renderOrder(order)
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) {
                    showInvalidTokenMessage()
                }
            }
        }
    }

    private fun renderOrder(order: OrderDto) {
        val address = order.addressText ?: order.customerAddress ?: "-"
        val itemCount = order.items?.sumOf { it.qty ?: 0 } ?: 0
        val total = String.format("%,.0f", order.total ?: 0.0)
        binding.orderInfoText.text = "#${order.orderNumber ?: "-"}\nManzil: $address\nOrientir: ${order.landmarkText ?: "-"}\nJami: $total so'm\nItems: $itemCount"
        binding.statusText.text = if (order.status == "delivered") {
            "Buyurtma yakunlandi"
        } else {
            "Status: ${order.status ?: "-"}"
        }
        updateUiForOrderState()
    }

    private fun acceptDelivery() {
        if (!canAccept()) {
            toast("Avval waiting_courier statusdagi buyurtmani yuklang")
            return
        }
        val token = parseAndApplyToken(tokenStore.getToken().ifBlank { binding.tokenInput.text?.toString() })
        if (token.isNullOrBlank()) {
            showInvalidTokenMessage()
            return
        }
        if (!hasLocationPermission()) {
            requestLocationPermission()
            return
        }
        binding.statusText.text = "Lokatsiya aniqlanmoqda..."

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val courierName = binding.courierNameInput.text?.toString()?.trim().orEmpty()
                val courierPhone = binding.courierPhoneInput.text?.toString()?.trim().orEmpty()
                tokenStore.saveCourierProfile(readProfileFromInputs())
                val response = api.acceptOrder(
                    token,
                    AcceptRequest(
                        courierName = courierName.ifBlank { "Android Courier" },
                        courierPhone = courierPhone.ifBlank { "-" }
                    )
                )
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    response.order?.let { renderOrder(it) }
                    stateManager.dispatch(CourierAction.OrderAccepted)
                    startTrackingService(token)
                    toast("Buyurtma qabul qilindi")
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { toast("Buyurtmani qabul qilishda xatolik") }
            }
        }
    }

    private fun completeDelivery() {
        if (!canDeliver()) {
            toast("Mijozga topshirish uchun status accepted yoki out_for_delivery bo‘lishi kerak")
            return
        }
        val token = parseAndApplyToken(tokenStore.getToken().ifBlank { binding.tokenInput.text?.toString() })
        if (token.isNullOrBlank()) {
            showInvalidTokenMessage()
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.deliverOrder(token)
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    response.order?.let { renderOrder(it) }
                    stateManager.dispatch(CourierAction.OrderDelivered)
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
        val destination = if (hasValidCoords(order.locationLat, order.locationLng)) {
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

    private fun showInvalidTokenMessage() {
        Toast.makeText(this, "Token noto‘g‘ri yoki buyurtma topilmadi", Toast.LENGTH_LONG).show()
        binding.statusText.text = "Token noto‘g‘ri yoki buyurtma topilmadi"
        activeOrder = null
        stateManager.dispatch(CourierAction.ErrorOccurred("invalid_token"))
        updateUiForOrderState()
    }

    private fun parseAndApplyToken(rawInput: String?): String? {
        val parsed = parseCourierToken(rawInput).orEmpty()
        if (parsed.isBlank()) return null
        binding.tokenInput.setText(parsed)
        tokenStore.saveToken(parsed)
        return parsed
    }

    private fun parseCourierToken(rawInput: String?): String {
        val value = rawInput?.trim().orEmpty()
        if (value.isBlank()) return ""

        val courierPathRegex = Regex("""(?:^|/)courier/([^/?#]+)""", RegexOption.IGNORE_CASE)
        val pathMatch = courierPathRegex.find(value)?.groupValues?.getOrNull(1)?.trim().orEmpty()
        if (pathMatch.isNotBlank()) return pathMatch

        val looksLikeUrl = value.startsWith("http://", true) || value.startsWith("https://", true)
        if (looksLikeUrl) return ""

        return value
    }

    private fun canAccept(): Boolean = activeOrder?.status == "waiting_courier"

    private fun canDeliver(): Boolean {
        val status = activeOrder?.status
        return status == "accepted" || status == "out_for_delivery"
    }

    private fun updateUiForOrderState() {
        val status = activeOrder?.status
        val hasNavigableOrder = activeOrder != null && status != "delivered"
        binding.openMapsBtn.isEnabled = hasNavigableOrder
        binding.acceptBtn.isEnabled = canAccept()
        binding.deliverBtn.isEnabled = canDeliver()
    }

    private fun hasValidCoords(lat: Double?, lng: Double?): Boolean {
        val latNum = lat ?: return false
        val lngNum = lng ?: return false
        if (!latNum.isFinite() || !lngNum.isFinite()) return false
        return latNum in -90.0..90.0 && lngNum in -180.0..180.0
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    private fun readProfileFromInputs(): CourierProfileLocal {
        return CourierProfileLocal(
            fullName = binding.courierNameInput.text?.toString().orEmpty(),
            phone = binding.courierPhoneInput.text?.toString().orEmpty(),
            vehicleType = binding.vehicleTypeInput.text?.toString().orEmpty(),
            vehiclePlate = binding.vehiclePlateInput.text?.toString().orEmpty()
        )
    }

    private fun bindSavedProfile() {
        val profile = tokenStore.getCourierProfile()
        binding.courierNameInput.setText(profile.fullName)
        binding.courierPhoneInput.setText(profile.phone)
        binding.vehicleTypeInput.setText(profile.vehicleType)
        binding.vehiclePlateInput.setText(profile.vehiclePlate)
    }
}
