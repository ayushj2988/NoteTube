package com.notetube.quiz;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttemptRepository extends JpaRepository<QuizAttempt, String> {

    List<QuizAttempt> findByUserIdOrderByCreatedAtDesc(String userId, Pageable page);

    long countByUserId(String userId);

    @Query("select a from QuizAttempt a where a.userId = :uid and a.noteId in :ids order by a.createdAt desc")
    List<QuizAttempt> recentForNotes(@Param("uid") String userId, @Param("ids") Collection<String> noteIds);
}
