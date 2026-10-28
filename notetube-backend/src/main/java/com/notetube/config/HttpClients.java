package com.notetube.config;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Builds RestClient instances with explicit timeouts. */
public final class HttpClients {
    private HttpClients() {}

    public static RestClient create(int connectMs, int readMs) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(connectMs);
        f.setReadTimeout(readMs);
        return RestClient.builder().requestFactory(f).build();
    }
}
