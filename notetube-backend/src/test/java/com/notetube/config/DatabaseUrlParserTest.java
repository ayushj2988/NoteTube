package com.notetube.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.notetube.config.DatabaseUrlParser.JdbcSettings;
import org.junit.jupiter.api.Test;

class DatabaseUrlParserTest {

    @Test
    void convertsNodeStyleUrl() {
        JdbcSettings s = DatabaseUrlParser.parse("postgres://notetube:secret@127.0.0.1:5432/notetube");
        assertThat(s.url()).isEqualTo("jdbc:postgresql://127.0.0.1:5432/notetube");
        assertThat(s.username()).isEqualTo("notetube");
        assertThat(s.password()).isEqualTo("secret");
    }

    @Test
    void defaultsPortAndKeepsQuery() {
        JdbcSettings s = DatabaseUrlParser.parse("postgresql://u:p@db.example.com/app?sslmode=require");
        assertThat(s.url()).isEqualTo("jdbc:postgresql://db.example.com:5432/app?sslmode=require");
    }

    @Test
    void decodesPercentEncodedPasswordAndKeepsPlus() {
        JdbcSettings s = DatabaseUrlParser.parse("postgres://me:p%40ss%3Aw%2Bord+x@localhost:5432/db");
        assertThat(s.password()).isEqualTo("p@ss:w+ord+x");
    }

    @Test
    void passesJdbcUrlThrough() {
        JdbcSettings s = DatabaseUrlParser.parse("jdbc:postgresql://localhost/x");
        assertThat(s.url()).isEqualTo("jdbc:postgresql://localhost/x");
        assertThat(s.username()).isNull();
    }

    @Test
    void rejectsBadInputWithoutEchoingIt() {
        assertThatThrownBy(() -> DatabaseUrlParser.parse("mysql://u:topsecret@h/db"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageNotContaining("topsecret");
        assertThatThrownBy(() -> DatabaseUrlParser.parse("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DatabaseUrlParser.parse("postgres://u:p@host")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void toStringIsRedacted() {
        JdbcSettings s = DatabaseUrlParser.parse("postgres://u:topsecret@h:5432/db");
        assertThat(s.toString()).doesNotContain("topsecret").doesNotContain("jdbc:");
    }
}
