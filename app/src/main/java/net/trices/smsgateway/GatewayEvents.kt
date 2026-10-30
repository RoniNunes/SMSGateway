package net.trices.smsgateway

object GatewayEvents {
    const val ACTION_STATUS = "net.trices.smsgateway.STATUS"
    const val ACTION_AUTH_REVOKED = "net.trices.smsgateway.AUTH_REVOKED"

    const val EXTRA_ONLINE = "online"
    const val EXTRA_MESSAGE = "message"
    const val EXTRA_AUTH_CODE = "auth_code"
    const val EXTRA_AUTH_REASON = "auth_reason"
}