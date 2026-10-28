package com.notetube.stats;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {

    @Query("select e.createdAt from Event e where e.userId = :uid and e.createdAt >= :since")
    List<Instant> activitySince(@Param("uid") String userId, @Param("since") Instant since);
}
