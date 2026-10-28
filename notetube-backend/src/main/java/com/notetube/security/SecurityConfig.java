package com.notetube.security;

import com.notetube.common.ErrorCode;
import com.notetube.common.ErrorWriter;
import com.notetube.common.RateLimits;
import com.notetube.config.AppProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http, SessionService sessions, AppProperties props, ErrorWriter errors, RateLimits limits)
            throws Exception {
        http
                // No CSRF tokens: sessions use a SameSite=Lax cookie, and RequestGuardFilter checks Origin
                // and requires JSON bodies on state-changing requests.
                .csrf(c -> c.disable())
                .cors(c -> c.disable())
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                .requestCache(r -> r.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Spring Security already sends X-Content-Type-Options and Cache-Control: no-store.
                .headers(h -> h.referrerPolicy(r -> r.policy(ReferrerPolicy.NO_REFERRER)))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/google")
                        .permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> errors.write(res, ErrorCode.UNAUTHENTICATED))
                        .accessDeniedHandler((req, res, ex) -> errors.write(res, ErrorCode.FORBIDDEN)))
                .addFilterBefore(new RequestGuardFilter(props, errors), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new AuthRateLimitFilter(limits.authPerIp, props.trustProxy(), errors),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new SessionAuthFilter(sessions), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
