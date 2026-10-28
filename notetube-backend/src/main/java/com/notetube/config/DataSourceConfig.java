package com.notetube.config;

import com.notetube.config.DatabaseUrlParser.JdbcSettings;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Builds the PostgreSQL pool from DATABASE_URL. Only active with SPRING_PROFILES_ACTIVE=postgres.
 * The default "h2" profile uses spring.datasource.* from application-h2.yml.
 * Flyway and JPA pick this DataSource up automatically.
 */
@Configuration
@Profile("postgres")
public class DataSourceConfig {

    @Bean
    public DataSource dataSource(AppProperties props) {
        JdbcSettings s = DatabaseUrlParser.parse(props.databaseUrl());
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(s.url());
        if (s.username() != null) ds.setUsername(s.username());
        if (s.password() != null) ds.setPassword(s.password());
        ds.setMaximumPoolSize(10);
        ds.setPoolName("notetube-pool");
        return ds;
    }
}
