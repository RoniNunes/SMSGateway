package net.trices.smsgateway.api

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import net.trices.smsgateway.GatewayConfig
import net.trices.smsgateway.GatewayPrefs
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object GatewayClient {
    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    fun createApi(ctx: Context): GatewayApi {
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(AuthErrorInterceptor())
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            })
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(ensureTrailingSlash(GatewayConfig.baseUrl(ctx)))
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

        return retrofit.create(GatewayApi::class.java)
    }

    fun parseAuthFailure(body: String?): AuthFailureException {
        return try {
            val parsed = moshi.adapter(ErrorBody::class.java).fromJson(body ?: "")
            AuthFailureException(
                authCode = parsed?.code ?: "INVALID_TOKEN",
                message = parsed?.message ?: "Sessão inválida. Reconecte no painel.",
            )
        } catch (_: Exception) {
            AuthFailureException("INVALID_TOKEN", "Sessão inválida. Reconecte no painel.")
        }
    }

    fun deviceToken(ctx: Context): String = GatewayPrefs.getDeviceToken(ctx)

    private fun ensureTrailingSlash(url: String): String =
        if (url.endsWith("/")) url else "$url/"

    private class AuthErrorInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val response = chain.proceed(chain.request())
            if (response.code == 401) {
                val peek = response.peekBody(2048).string()
                throw GatewayClient.parseAuthFailure(peek)
            }
            return response
        }
    }
}