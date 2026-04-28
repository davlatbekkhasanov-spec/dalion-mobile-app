package org.globusmarket.courierapp

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var tokenStore: TokenStore
    private val api by lazy { ApiProvider.create(BuildConfig.API_BASE_URL) }
    private val stateManager = CourierStateManager()

    private var activeOrder: OrderDto? = null
    private var deliveredTodayCount = 0
    private var activeScreen = AppScreen.DASHBOARD
    private var isOnlineShift = false
    private var lastTrackingSentAt: Long = 0L

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        stateManager.dispatch(CourierAction.LocationPermissionUpdated(granted))
        refreshTrackingStatus()
        if (!granted) showLocationRequiredDialog()
    }

    private val qrLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val parsed = IntentIntegrator.parseActivityResult(result.resultCode, result.data)
        if (parsed == null || parsed.contents.isNullOrBlank()) {
            toast("QR/token o‘qilmadi")
            return@registerForActivityResult
        }
        val token = parseAndApplyToken(parsed.contents)
        if (token == null) {
            showInvalidTokenMessage()
            return@registerForActivityResult
        }
        toast("QR muvaffaqiyatli o‘qildi")
        loadOrder(token)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        bindSavedProfile()
        isOnlineShift = tokenStore.getShiftOnline()
        stateManager.dispatch(CourierAction.SessionAuthenticated)
        if (isOnlineShift) stateManager.dispatch(CourierAction.ShiftStarted)

        setupListeners()
        applyAuthVisibility()
        updateShiftUi()
        updateUiForOrderState()
        refreshTrackingStatus()
        showScreen(if (profileExists()) AppScreen.DASHBOARD else AppScreen.AUTH)
    }

    private fun setupListeners() {
        binding.registerBtn.setOnClickListener { registerCourier() }
        binding.saveTokenBtn.setOnClickListener { saveProfileAndToken() }
        binding.scanQrBtn.setOnClickListener { openQrScanner() }
        binding.loadOrderBtn.setOnClickListener { loadOrder() }
        binding.acceptBtn.setOnClickListener { acceptDelivery() }
        binding.deliverBtn.setOnClickListener { completeDelivery() }
        binding.openMapsBtn.setOnClickListener { openInGoogleMaps() }
        binding.callCustomerBtn.setOnClickListener { callCustomer() }
        binding.shiftToggleBtn.setOnClickListener { toggleShift() }

        binding.navDashboardBtn.setOnClickListener { showScreen(AppScreen.DASHBOARD) }
        binding.navActiveBtn.setOnClickListener { showScreen(AppScreen.ACTIVE_ORDER) }
        binding.navProfileBtn.setOnClickListener { showScreen(AppScreen.PROFILE) }
        binding.navHistoryBtn.setOnClickListener { showScreen(AppScreen.HISTORY) }
    }

    private fun registerCourier() {
        val profile = readProfileFromInputs()
        val validationError = validateProfile(profile)
        if (validationError != null) {
            binding.authValidationText.text = validationError
            binding.authValidationText.visibility = View.VISIBLE
            return
        }
        binding.authValidationText.visibility = View.GONE
        tokenStore.saveCourierProfile(profile)
        toast("Profil saqlandi")
        applyAuthVisibility()
        updateDashboardSummary()
        showScreen(AppScreen.DASHBOARD)
    }

    private fun saveProfileAndToken() {
        val token = parseAndApplyToken(binding.tokenInput.text?.toString())
        if (binding.tokenInput.text?.isNotBlank() == true && token.isNullOrBlank()) {
            showInvalidTokenMessage()
            return
        }

        val profile = readProfileFromInputs()
        val validationError = validateProfile(profile)
        if (validationError != null) {
            binding.authValidationText.text = validationError
            binding.authValidationText.visibility = View.VISIBLE
            showScreen(AppScreen.AUTH)
            return
        }

        tokenStore.saveCourierProfile(profile)
        toast("Profil va token saqlandi")
        updateDashboardSummary()
    }

    private fun loadOrder(explicitToken: String? = null) {
        if (!isOnlineShift) {
            toast("Shift OFFLINE. Avval ONLINE ga o'ting")
            return
        }

        val token = explicitToken ?: parseAndApplyToken(binding.tokenInput.text?.toString()) ?: tokenStore.getToken()
        if (token.isBlank()) {
            showInvalidTokenMessage()
            return
        }
        tokenStore.saveToken(token)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.getCourierOrder(token)
                withContext(Dispatchers.Main) {
                    val order = response.order
                    if (order == null) {
                        showInvalidTokenMessage()
                        return@withContext
                    }
                    activeOrder = order
                    stateManager.dispatch(CourierAction.ActiveOrderLoaded(order.orderNumber, order.status))
                    renderOrder(order)
                    showScreen(AppScreen.ACTIVE_ORDER)
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { showInvalidTokenMessage() }
            }
        }
    }

    private fun renderOrder(order: OrderDto) {
        val address = order.addressText ?: order.customerAddress ?: "-"
        val customerName = order.customerName ?: "-"
        val customerPhone = order.customerPhone ?: "-"
        val paymentNotes = order.paymentNote ?: "-"
        val deliveryNotes = order.deliveryNote ?: order.landmarkText ?: "-"
        val distance = order.distanceKm?.let { String.format(Locale.US, "%.1f km", it) } ?: "-"

        binding.orderInfoText.text = """
            Buyurtma: #${order.orderNumber ?: "-"}
            Mijoz: $customerName
            Telefon: $customerPhone
            Manzil: $address
            To'lov: $paymentNotes
            Eslatma: $deliveryNotes
            Masofa: $distance
        """.trimIndent()

        binding.statusText.text = "Status: ${order.status ?: "-"}"
        updateUiForOrderState()
    }

    private fun acceptDelivery() {
        if (!canAccept()) {
            toast("waiting_courier statusdagi buyurtmani yuklang")
            return
        }

        val token = tokenStore.getToken()
        if (token.isBlank()) {
            showInvalidTokenMessage()
            return
        }

        if (!hasLocationPermission()) {
            requestLocationPermission()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val profile = readProfileFromInputs()
                tokenStore.saveCourierProfile(profile)
                val response = api.acceptOrder(
                    token,
                    AcceptRequest(
                        courierName = profile.fullName.ifBlank { "Android Courier" },
                        courierPhone = profile.phone.ifBlank { "-" }
                    )
                )
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    stateManager.dispatch(CourierAction.OrderAccepted)
                    stateManager.dispatch(CourierAction.OrderOutForDelivery)
                    response.order?.let { renderOrder(it) }
                    startTrackingService(token)
                    toast("Buyurtma qabul qilindi")
                    openInGoogleMaps(autoLaunch = true)
                    refreshTrackingStatus()
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { toast("Buyurtmani qabul qilishda xatolik") }
            }
        }
    }

    private fun completeDelivery() {
        if (!canDeliver()) {
            toast("Topshirish uchun status accepted yoki out_for_delivery bo'lishi kerak")
            return
        }
        val token = tokenStore.getToken()
        if (token.isBlank()) {
            showInvalidTokenMessage()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = api.deliverOrder(token)
                withContext(Dispatchers.Main) {
                    activeOrder = response.order
                    stateManager.dispatch(CourierAction.OrderDelivered)
                    stopService(Intent(this@MainActivity, CourierTrackingService::class.java))
                    tokenStore.setTrackingActive(false)
                    deliveredTodayCount += 1
                    response.order?.let { renderOrder(it) }
                    refreshTrackingStatus()
                    toast("Buyurtma topshirildi")
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) { toast("Buyurtmani yakunlashda xatolik") }
            }
        }
    }

    private fun toggleShift() {
        isOnlineShift = !isOnlineShift
        tokenStore.setShiftOnline(isOnlineShift)
        if (isOnlineShift) {
            stateManager.dispatch(CourierAction.ShiftStarted)
            toast("Shift ONLINE")
        } else {
            stateManager.dispatch(CourierAction.ShiftStopped)
            if (canContinueTrackingWhenOffline()) {
                toast("Shift OFFLINE, ammo aktiv order tracking davom etadi")
            } else {
                stopService(Intent(this, CourierTrackingService::class.java))
                tokenStore.setTrackingActive(false)
            }
        }
        updateShiftUi()
        refreshTrackingStatus()
    }

    private fun callCustomer() {
        val phone = activeOrder?.customerPhone?.takeIf { it.isNotBlank() }
        if (phone.isNullOrBlank()) {
            toast("Mijoz telefoni topilmadi")
            return
        }
        val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
        startActivity(dialIntent)
    }

    private fun openInGoogleMaps(autoLaunch: Boolean = false) {
        val order = activeOrder ?: run {
            if (!autoLaunch) toast("Avval aktiv orderni yuklang")
            return
        }
        val lat = order.locationLat
        val lng = order.locationLng
        if (!hasValidCoords(lat, lng)) {
            toast("Manzil koordinatasi topilmadi")
            binding.openMapsBtn.isEnabled = false
            return
        }

        val navUri = Uri.parse("google.navigation:q=$lat,$lng&mode=d")
        val mapsIntent = Intent(Intent.ACTION_VIEW, navUri).setPackage("com.google.android.apps.maps")
        try {
            startActivity(mapsIntent)
            return
        } catch (_: ActivityNotFoundException) {
            val browserUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
            startActivity(Intent(Intent.ACTION_VIEW, browserUri))
        }
    }

    private fun startTrackingService(token: String) {
        tokenStore.setTrackingActive(true)
        lastTrackingSentAt = System.currentTimeMillis()
        val serviceIntent = Intent(this, CourierTrackingService::class.java).apply {
            putExtra(CourierTrackingService.EXTRA_TOKEN, token)
            putExtra(CourierTrackingService.EXTRA_BASE_URL, BuildConfig.API_BASE_URL)
        }
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun profileExists(): Boolean {
        val p = tokenStore.getCourierProfile()
        return p.fullName.isNotBlank() && p.phone.isNotBlank() && p.vehicleType.isNotBlank() && p.vehiclePlate.isNotBlank()
    }

    private fun applyAuthVisibility() {
        val showAuth = !profileExists()
        binding.authScreen.visibility = if (showAuth) View.VISIBLE else View.GONE
        if (!showAuth) updateDashboardSummary()
    }

    private fun showScreen(screen: AppScreen) {
        activeScreen = screen
        val loggedIn = profileExists()

        binding.dashboardScreen.visibility = if (screen == AppScreen.DASHBOARD && loggedIn) View.VISIBLE else View.GONE
        binding.activeOrderScreen.visibility = if (screen == AppScreen.ACTIVE_ORDER && loggedIn) View.VISIBLE else View.GONE
        binding.profileScreen.visibility = if (screen == AppScreen.PROFILE && loggedIn) View.VISIBLE else View.GONE
        binding.historyScreen.visibility = if (screen == AppScreen.HISTORY && loggedIn) View.VISIBLE else View.GONE
        binding.authScreen.visibility = if (!loggedIn || screen == AppScreen.AUTH) View.VISIBLE else View.GONE

        val navVisibility = if (loggedIn) View.VISIBLE else View.GONE
        binding.navDashboardBtn.visibility = navVisibility
        binding.navActiveBtn.visibility = navVisibility
        binding.navProfileBtn.visibility = navVisibility
        binding.navHistoryBtn.visibility = navVisibility

        if (!loggedIn) {
            binding.dashboardScreen.visibility = View.GONE
            binding.activeOrderScreen.visibility = View.GONE
            binding.profileScreen.visibility = View.GONE
            binding.historyScreen.visibility = View.GONE
        }
    }

    private fun updateDashboardSummary() {
        val profile = tokenStore.getCourierProfile()
        binding.profileSummaryText.text = "${profile.fullName}\n${profile.phone} • ${profile.vehicleType} • ${profile.vehiclePlate}"
        updateStats()
    }

    private fun updateShiftUi() {
        binding.shiftToggleBtn.text = if (isOnlineShift) "Shift: ONLINE" else "Shift: OFFLINE"
        binding.shiftStatusText.text = if (isOnlineShift) {
            "ONLINE: buyurtmalarni qabul qilishingiz mumkin"
        } else {
            "OFFLINE: yangi buyurtma yuklash bloklangan"
        }
    }

    private fun updateStats() {
        val activeStatus = activeOrder?.status ?: "yo'q"
        val tracking = trackingLabel()
        binding.statsText.text = "Yetkazildi: $deliveredTodayCount | Active: $activeStatus | Tracking: $tracking"
    }

    private fun refreshTrackingStatus() {
        val status = when {
            !hasLocationPermission() -> "Location permission required"
            !tokenStore.isTrackingActive() -> "Tracking OFF"
            activeOrder == null -> "Tracking IDLE"
            else -> {
                val time = if (lastTrackingSentAt > 0) {
                    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(lastTrackingSentAt))
                } else {
                    "-"
                }
                "Tracking active • Last sent: $time"
            }
        }
        binding.trackingStatusText.text = status
        updateStats()
    }

    private fun validateProfile(profile: CourierProfileLocal): String? {
        if (profile.fullName.length < 3) return "To'liq ism kamida 3 ta belgidan iborat bo'lishi kerak"
        val phone = profile.phone.replace(" ", "")
        if (!phone.startsWith("+998") || phone.length < 13) return "Telefon +998 bilan boshlanishi kerak"
        if (profile.vehicleType.length < 2) return "Transport turini kiriting"
        if (profile.vehiclePlate.length < 5) return "Davlat raqamini to'g'ri kiriting"
        return null
    }

    private fun parseAndApplyToken(rawInput: String?): String? {
        val parsed = parseCourierToken(rawInput).orEmpty().trim()
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

    private fun openQrScanner() {
        val integrator = IntentIntegrator(this)
        integrator.setPrompt("Courier QR ni skan qiling")
        integrator.setOrientationLocked(true)
        integrator.setBeepEnabled(true)
        qrLauncher.launch(integrator.createScanIntent())
    }

    private fun showInvalidTokenMessage() {
        activeOrder = null
        stateManager.dispatch(CourierAction.ErrorOccurred("invalid_token"))
        binding.statusText.text = "Token noto‘g‘ri yoki buyurtma topilmadi"
        toast("Token noto‘g‘ri yoki buyurtma topilmadi")
        updateUiForOrderState()
    }

    private fun updateUiForOrderState() {
        binding.acceptBtn.isEnabled = canAccept()
        binding.deliverBtn.isEnabled = canDeliver()
        binding.openMapsBtn.isEnabled = activeOrder != null && hasValidCoords(activeOrder?.locationLat, activeOrder?.locationLng)
        binding.callCustomerBtn.isEnabled = !activeOrder?.customerPhone.isNullOrBlank()
        updateStats()
    }

    private fun canAccept(): Boolean = activeOrder?.status == "waiting_courier"

    private fun canDeliver(): Boolean {
        val status = activeOrder?.status
        return status == "accepted" || status == "out_for_delivery"
    }

    private fun canContinueTrackingWhenOffline(): Boolean {
        val status = activeOrder?.status
        return status == "accepted" || status == "out_for_delivery"
    }

    private fun hasValidCoords(lat: Double?, lng: Double?): Boolean {
        val latNum = lat ?: return false
        val lngNum = lng ?: return false
        if (!latNum.isFinite() || !lngNum.isFinite()) return false
        if (latNum == 0.0 && lngNum == 0.0) return false
        return latNum in -90.0..90.0 && lngNum in -180.0..180.0
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
            .setMessage("Tracking ishlashi uchun location ruxsatini yoqing.")
            .setPositiveButton("Qayta urinish") { _, _ -> requestLocationPermission() }
            .setNegativeButton("Yopish", null)
            .show()
    }

    private fun trackingLabel(): String = when {
        !hasLocationPermission() -> "Permission required"
        tokenStore.isTrackingActive() -> "ACTIVE"
        isOnlineShift -> "IDLE"
        else -> "OFF"
    }

    private fun readProfileFromInputs(): CourierProfileLocal {
        return CourierProfileLocal(
            fullName = binding.courierNameInput.text?.toString().orEmpty().trim(),
            phone = binding.courierPhoneInput.text?.toString().orEmpty().trim(),
            vehicleType = binding.vehicleTypeInput.text?.toString().orEmpty().trim(),
            vehiclePlate = binding.vehiclePlateInput.text?.toString().orEmpty().trim()
        )
    }

    private fun bindSavedProfile() {
        val profile = tokenStore.getCourierProfile()
        binding.courierNameInput.setText(profile.fullName)
        binding.courierPhoneInput.setText(profile.phone.ifBlank { "+998" })
        binding.vehicleTypeInput.setText(profile.vehicleType)
        binding.vehiclePlateInput.setText(profile.vehiclePlate)
        binding.tokenInput.setText(tokenStore.getToken())
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    enum class AppScreen {
        AUTH,
        DASHBOARD,
        ACTIVE_ORDER,
        PROFILE,
        HISTORY
    }
}
