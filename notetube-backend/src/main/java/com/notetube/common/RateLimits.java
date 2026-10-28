package com.notetube.common;

import com.notetube.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import org.springframework.stereotype.Component;

/** The app's named limiters, all in memory. */
@Component
public class RateLimits {

    public final RateLimiter authPerIp;
    public final RateLimiter noteCreate;
    public final RateLimiter noteRetry;
    public final RateLimiter extras;

    public RateLimits(Clock clock, AppProperties props) {
        this.authPerIp = new RateLimiter(props.authRateLimit(), Duration.ofMinutes(15), clock);
        this.noteCreate = new RateLimiter(props.noteRateLimit(), Duration.ofMinutes(1), clock);
        this.noteRetry = new RateLimiter(props.noteRateLimit(), Duration.ofMinutes(1), clock);
        this.extras = new RateLimiter(Math.max(props.noteRateLimit() * 2, 6), Duration.ofMinutes(1), clock);
    }

    /** Throws 429 RATE_LIMITED if the key is over its limit. */
    public static void enforce(RateLimiter limiter, String key, String what) {
        long wait = limiter.tryAcquire(key);
        if (wait > 0) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many " + what + ". Please try again in " + wait + " seconds.");
        }
    }
}
