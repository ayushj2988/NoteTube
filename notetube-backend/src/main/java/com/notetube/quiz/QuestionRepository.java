package com.notetube.quiz;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface QuestionRepository extends JpaRepository<QuizQuestion, String> {

    List<QuizQuestion> findByNoteIdOrderBySortOrder(String noteId);

    List<QuizQuestion> findByNoteIdIn(Collection<String> noteIds);

    @Modifying
    @Transactional
    @Query("delete from QuizQuestion q where q.noteId = :noteId")
    void deleteByNoteId(@Param("noteId") String noteId);

    @Query("select q.noteId, count(q) from QuizQuestion q where q.noteId in :ids group by q.noteId")
    List<Object[]> totals(@Param("ids") Collection<String> ids);
}
