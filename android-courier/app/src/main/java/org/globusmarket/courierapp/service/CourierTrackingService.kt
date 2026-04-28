package org.globusmarket.courierapp.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.globusmarket.courierapp.R
import org.globusmarket.courierapp.api.ApiProvider
import org.globusmarket.courierapp.api.LocationRequest

class CourierTrackingService : Service() {
    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var notificationManager: NotificationManager
    private var callback: LocationCallback? = null
    private var token: String = ""
    private var baseUrl: String = ""
    private val retryHandler = Handler(Looper.getMainLooper())
    private val retryRunnable = Runnable {
        if (::fusedClient.isInitialized) {
            startLocationUpdates()
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(NotificationManager::class.java)
        createChannel()
        startForeground(NOTIFICATION_ID, createNotification(getString(R.string.location_resolving)))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN).orEmpty()
        baseUrl = intent?.getStringExtra(EXTRA_BASE_URL).orEmpty()

        if (token.isBlank() || baseUrl.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (!hasLocationPermission()) {
            stopSelf()
            return START_NOT_STICKY
        }

        startLocationUpdates()
        return START_STICKY
    }

    private fun startLocationUpdates() {
        callback?.let { fusedClient.removeLocationUpdates(it) }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
            .setMinUpdateIntervalMillis(5000L)
            .setWaitForAccurateLocation(false)
            .build()

        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                updateNotificationText(getString(R.string.tracking_notification_text))
                val api = ApiProvider.create(baseUrl)
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        api.updateLocation(
                            token,
                            LocationRequest(
                                lat = location.latitude,
                                lng = location.longitude,
                                accuracy = location.accuracy
                            )
                        )
                    }
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                if (!availability.isLocationAvailable) {
                    updateNotificationText(getString(R.string.location_resolving))
                    retryHandler.removeCallbacks(retryRunnable)
                    retryHandler.postDelayed(retryRunnable, 4000L)
                }
            }
        }

        updateNotificationText(getString(R.string.location_resolving))
        fusedClient.requestLocationUpdates(request, callback as LocationCallback, mainLooper)
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Courier Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(contentText: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.tracking_notification_title))
            .setContentText(contentText)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotificationText(text: String) {
        notificationManager.notify(NOTIFICATION_ID, createNotification(text))
    }

    override fun onDestroy() {
        retryHandler.removeCallbacks(retryRunnable)
        callback?.let { fusedClient.removeLocationUpdates(it) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val EXTRA_TOKEN = "extra_token"
        const val EXTRA_BASE_URL = "extra_base_url"

        private const val CHANNEL_ID = "courier_tracking_channel"
        private const val NOTIFICATION_ID = 3001
    }
}
