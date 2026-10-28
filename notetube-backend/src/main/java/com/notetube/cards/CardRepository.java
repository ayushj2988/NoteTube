package com.notetube.cards;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface CardRepository extends JpaRepository<Card, String> {

    List<Card> findByNoteId(String noteId);

    /** A card, but only if its note belongs to the user. */
    @Query("select c from Card c where c.id = :id and c.noteId in (select n.id from Note n where n.userId = :uid)")
    Optional<Card> findOwned(@Param("id") String id, @Param("uid") String userId);

    @Modifying
    @Transactional
    @Query("delete from Card c where c.noteId = :noteId")
    void deleteByNoteId(@Param("noteId") String noteId);

    @Query("select c.noteId, count(c) from Card c where c.noteId in :ids group by c.noteId")
    List<Object[]> totals(@Param("ids") Collection<String> ids);

    @Query("select c.noteId, count(c) from Card c where c.noteId in :ids and c.dueAt <= :now group by c.noteId")
    List<Object[]> dueCounts(@Param("ids") Collection<String> ids, @Param("now") Instant now);

    @Query("select count(c) from Card c where c.dueAt < :end "
            + "and c.noteId in (select n.id from Note n where n.userId = :uid)")
    long countDueBefore(@Param("uid") String userId, @Param("end") Instant end);
}
