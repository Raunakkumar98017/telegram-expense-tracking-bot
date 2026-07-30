const crypto = require('crypto');
require('dotenv').config();

const AUTH_SECRET = process.env.SUPABASE_KEY || process.env.TELEGRAM_TOKEN || 'MyKhataBotSecretKey123!';

/**
 * Generates a signed HMAC SHA-256 token for a user dashboard URL
 */
function generateDashboardToken(userId, timestamp) {
    if (!userId || !timestamp) return '';
    return crypto.createHmac('sha256', AUTH_SECRET)
        .update(`${userId}:${timestamp}`)
        .digest('hex');
}

/**
 * Verifies if the HMAC token is valid and not expired (Valid for 7 days)
 */
function verifyDashboardToken(userId, timestamp, token) {
    if (!userId || !timestamp || !token) return false;

    const now = Date.now();
    const age = now - parseInt(timestamp);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 Days in ms

    if (isNaN(age) || age < 0 || age > maxAge) {
        return false;
    }

    try {
        const expected = generateDashboardToken(userId, timestamp);
        return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch (e) {
        return false;
    }
}

/**
 * Express middleware to verify token before allowing API access
 */
function verifyApiToken(req, res, next) {
    const { userId, ts, t } = req.query;
    
    // Also accept header fallback for development
    if (process.env.NODE_ENV === 'development' && !t) {
        return next();
    }

    if (!verifyDashboardToken(userId, ts, t)) {
        return res.status(403).json({
            success: false,
            error: '🔒 Access Denied: Invalid or expired dashboard token. Please request a new link via /dashboard in Telegram @MyKhataBot.'
        });
    }

    next();
}

module.exports = {
    generateDashboardToken,
    verifyDashboardToken,
    verifyApiToken
};
