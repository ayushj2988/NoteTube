package com.notetube.security;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SessionRepository extends JpaRepository<SessionEntity, String> {

    @Modifying
    @Transactional
    @Query("delete from SessionEntity s where s.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
