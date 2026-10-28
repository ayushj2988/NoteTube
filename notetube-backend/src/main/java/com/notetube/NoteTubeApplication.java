package com.notetube;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class) // we use our own cookie sessions
@ConfigurationPropertiesScan
public class NoteTubeApplication {
    public static void main(String[] args) {
        SpringApplication.run(NoteTubeApplication.class, args);
    }
}
