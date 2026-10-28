package com.notetube.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
@EnableScheduling
public class AppConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /** Bounded worker pool for note generation. Size comes from WORKER_CONCURRENCY. */
    @Bean("generationExecutor")
    public ThreadPoolTaskExecutor generationExecutor(AppProperties props) {
        int n = Math.max(1, props.workerConcurrency());
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(n);
        ex.setMaxPoolSize(n);
        ex.setQueueCapacity(100);
        ex.setThreadNamePrefix("notetube-gen-");
        ex.setWaitForTasksToCompleteOnShutdown(true);
        ex.setAwaitTerminationSeconds(30);
        return ex;
    }
}
