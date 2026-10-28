package com.notetube.notes;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoteRepository extends JpaRepository<Note, String> {

    Optional<Note> findByIdAndUserId(String id, String userId);

    boolean existsByIdAndUserId(String id, String userId);

    long countByUserIdAndCreatedAtGreaterThanEqual(String userId, Instant since);

    String ROW = "select new com.notetube.notes.NoteListRow(n.id, n.title, n.subject, n.status, n.createdAt, "
            + "n.progressTranscript, n.progressNotes, n.progressExtras, n.flashcardsStatus, n.quizStatus) from Note n ";

    /** q is the lower-cased search text ('' = no search), pattern is '%' + q + '%'. subject '' = any. */
    @Query(ROW + "where n.userId = :uid "
            + "and (:subject = '' or n.subject = :subject) "
            + "and (:q = '' or lower(n.title) like :pattern or lower(coalesce(n.summary, '')) like :pattern "
            + "or lower(coalesce(n.sections, '')) like :pattern) "
            + "order by n.createdAt desc")
    List<NoteListRow> search(@Param("uid") String userId, @Param("subject") String subject,
                             @Param("q") String q, @Param("pattern") String pattern);

    @Query(ROW + "where n.userId = :uid and n.flashcardsStatus = 'ready' order by n.createdAt desc")
    List<NoteListRow> flashcardDecks(@Param("uid") String userId);

    @Query(ROW + "where n.userId = :uid and n.quizStatus = 'ready' order by n.createdAt desc")
    List<NoteListRow> quizNotes(@Param("uid") String userId);

    /** Notes that were interrupted by a restart, or still have extras to build. */
    @Query("select n.id from Note n where n.status in ('queued', 'processing') "
            + "or n.flashcardsStatus = 'processing' or n.quizStatus = 'processing'")
    List<String> idsToResume();
}
