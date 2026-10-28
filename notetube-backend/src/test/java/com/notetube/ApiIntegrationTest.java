package com.notetube;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notetube.auth.GoogleIdentity;
import com.notetube.auth.GoogleTokenVerifier;
import com.notetube.cards.CardRepository;
import com.notetube.common.ApiException;
import com.notetube.common.ErrorCode;
import com.notetube.common.Ids;
import com.notetube.generation.GenerationModels.CardOutput;
import com.notetube.generation.GenerationQueue;
import com.notetube.generation.NoteStateService;
import com.notetube.generation.RecoveryRunner;
import com.notetube.notes.Note;
import com.notetube.notes.NoteRepository;
import com.notetube.security.SessionRepository;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * End-to-end tests over MockMvc, an in-memory H2 database and the DEMO generator.
 * No Gemini, YouTube or Google calls are made (Google verification is mocked).
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:nt_it;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "app.environment=development",
        "app.gemini-api-key=",
        "app.youtube-api-key=",
        "app.google-client-id=test-client-id",
        "app.session-secret=",
        "app.frontend-url=http://localhost:5173",
        "app.daily-generation-limit=100000",
        "app.auth-rate-limit=100000",
        "app.note-rate-limit=100000"
})
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class ApiIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SessionRepository sessionRepo;
    @Autowired NoteRepository noteRepo;
    @Autowired CardRepository cardRepo;
    @Autowired GenerationQueue queue;
    @Autowired RecoveryRunner recovery;
    @Autowired NoteStateService state;
    @MockitoBean GoogleTokenVerifier google;

    record Session(String userId, String email, Cookie cookie) {}

    // ---------- helpers ----------
    private String j(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private JsonNode body(MvcResult r) throws Exception {
        return mapper.readTree(r.getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, Object content) {
        return b.contentType(MediaType.APPLICATION_JSON).content(j(content));
    }

    private Session signup(String name) throws Exception {
        String email = name.toLowerCase() + "-" + UUID.randomUUID() + "@example.com";
        MvcResult r = mvc.perform(json(post("/api/auth/signup"), Map.of("name", name, "email", email, "password", "password123")))
                .andExpect(status().isCreated()).andReturn();
        Cookie c = r.getResponse().getCookie("nt_session");
        assertThat(c).isNotNull();
        return new Session(body(r).get("user").get("id").asText(), email, c);
    }

    private static String transcript() {
        return "Hash tables store values by key. A hash function converts the key into an index. ".repeat(20);
    }

    private String createNote(Session s, Map<String, Object> req) throws Exception {
        MvcResult r = mvc.perform(json(post("/api/notes").cookie(s.cookie()), req)).andExpect(status().isAccepted()).andReturn();
        return body(r).get("id").asText();
    }

    private JsonNode getNote(Session s, String id) throws Exception {
        MvcResult r = mvc.perform(get("/api/notes/" + id).cookie(s.cookie())).andExpect(status().isOk()).andReturn();
        return body(r).get("note");
    }

    private JsonNode waitForStatus(Session s, String id, String wanted) {
        await().atMost(Duration.ofSeconds(25)).pollInterval(Duration.ofMillis(100)).until(() -> {
            return wanted.equals(getNote(s, id).get("status").asText());
        });
        try {
            return getNote(s, id);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void waitForExtras(Session s, String id) {
        await().atMost(Duration.ofSeconds(25)).pollInterval(Duration.ofMillis(100)).until(() -> {
            JsonNode ex = getNote(s, id).get("extras");
            return "ready".equals(ex.get("flashcards").asText()) && "ready".equals(ex.get("quiz").asText());
        });
    }

    // ---------- authentication ----------
    @Test
    void signupLoginMeLogoutAndCookieFlags() throws Exception {
        String email = "flow-" + UUID.randomUUID() + "@example.com";
        MvcResult up = mvc.perform(json(post("/api/auth/signup"), Map.of("name", " Ayush ", "email", " " + email.toUpperCase() + " ", "password", "password123")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.name").value("Ayush"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andReturn();
        String setCookie = up.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("nt_session=").contains("HttpOnly").contains("SameSite=Lax").contains("Path=/").contains("Max-Age=");
        assertThat(setCookie).doesNotContain("Secure"); // development profile

        MvcResult in = mvc.perform(json(post("/api/auth/login"), Map.of("email", email, "password", "password123")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email)).andReturn();
        Cookie cookie = in.getResponse().getCookie("nt_session");
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));

        MvcResult out = mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent()).andReturn();
        assertThat(out.getResponse().getHeader("Set-Cookie")).contains("nt_session=").contains("Max-Age=0");
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
        mvc.perform(post("/api/auth/logout")).andExpect(status().isNoContent()); // works without a session too
    }

    @Test
    void duplicateEmailAndIndistinguishableLoginFailures() throws Exception {
        Session s = signup("Dup");
        mvc.perform(json(post("/api/auth/signup"), Map.of("name", "Other", "email", s.email(), "password", "password123")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"));

        MvcResult wrong = mvc.perform(json(post("/api/auth/login"), Map.of("email", s.email(), "password", "wrong-password")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS")).andReturn();
        MvcResult unknown = mvc.perform(json(post("/api/auth/login"), Map.of("email", "nobody-" + UUID.randomUUID() + "@example.com", "password", "wrong-password")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS")).andReturn();
        assertThat(wrong.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
    }

    @Test
    void validationErrorsListFieldsOnly() throws Exception {
        mvc.perform(json(post("/api/auth/signup"), Map.of("name", "", "email", "bad", "password", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION"))
                .andExpect(jsonPath("$.error.fields.email").value("Enter a valid email"))
                .andExpect(jsonPath("$.error.fields.password").exists())
                .andExpect(jsonPath("$.error.fields.name").exists());
    }

    @Test
    void updateProfileAndEmailConflict() throws Exception {
        Session a = signup("Alpha");
        Session b = signup("Beta");
        mvc.perform(json(patch("/api/auth/me").cookie(a.cookie()), Map.of("name", "Alpha Two")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.name").value("Alpha Two"));
        mvc.perform(json(patch("/api/auth/me").cookie(a.cookie()), Map.of("email", b.email())))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"));
    }

    @Test
    void googleSignInWithMockedVerifier() throws Exception {
        String email = "g-" + UUID.randomUUID() + "@example.com";
        String sub = "sub-" + UUID.randomUUID();
        when(google.verify("good")).thenReturn(new GoogleIdentity(sub, email, true, "Gina"));
        MvcResult first = mvc.perform(json(post("/api/auth/google"), Map.of("credential", "good")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email)).andReturn();
        assertThat(first.getResponse().getCookie("nt_session")).isNotNull();
        String id = body(first).get("user").get("id").asText();
        mvc.perform(json(post("/api/auth/google"), Map.of("credential", "good")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(id));

        // same email as an existing password account but a different Google identity: no automatic linking
        Session pw = signup("Pw");
        when(google.verify("takeover")).thenReturn(new GoogleIdentity("sub-" + UUID.randomUUID(), pw.email(), true, "X"));
        mvc.perform(json(post("/api/auth/google"), Map.of("credential", "takeover")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("EMAIL_TAKEN"));

        when(google.verify("unverified")).thenReturn(new GoogleIdentity("s3", "u-" + UUID.randomUUID() + "@example.com", false, "U"));
        mvc.perform(json(post("/api/auth/google"), Map.of("credential", "unverified"))).andExpect(status().isUnauthorized());

        when(google.verify("forged")).thenThrow(new ApiException(ErrorCode.INVALID_CREDENTIALS, "Google sign-in failed."));
        mvc.perform(json(post("/api/auth/google"), Map.of("credential", "forged")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
    }

    // ---------- security and error shapes ----------
    @Test
    void protectedRoutesReturnJson401WithoutABrowserLoginPopup() throws Exception {
        mvc.perform(get("/api/notes"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist("WWW-Authenticate"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/notes").cookie(new Cookie("nt_session", "garbage"))).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredSessionsAreRejected() throws Exception {
        Session s = signup("Expiry");
        sessionRepo.findAll().stream().filter(x -> x.userId.equals(s.userId())).forEach(x -> {
            x.expiresAt = Instant.now().minusSeconds(60);
            sessionRepo.save(x);
        });
        mvc.perform(get("/api/auth/me").cookie(s.cookie())).andExpect(status().isUnauthorized());
    }

    @Test
    void originContentTypeSizeAndRouteErrors() throws Exception {
        mvc.perform(json(post("/api/auth/login"), Map.of("email", "a@b.co", "password", "x")).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        mvc.perform(json(post("/api/auth/login"), Map.of("email", "a@b.co", "password", "x")).header("Origin", "http://localhost:5173"))
                .andExpect(status().isUnauthorized()); // allowed origin passes the guard, then bad credentials

        mvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("email=a"))
                .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_MEDIA_TYPE"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{broken"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("VALIDATION"));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(new byte[1_000_001]))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.error.code").value("PAYLOAD_TOO_LARGE"));

        Session s = signup("Routes");
        mvc.perform(get("/api/does-not-exist").cookie(s.cookie()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
        mvc.perform(get("/api/auth/login").cookie(s.cookie()))
                .andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.error.code").value("METHOD_NOT_ALLOWED"));
    }

    // ---------- notes, generation, extras, cards, quiz, stats ----------
    @Test
    void fullFlowNotesExtrasCardsQuizAndStats() throws Exception {
        Session s = signup("Flow");
        String id = createNote(s, Map.of("transcript", transcript(), "extras", Map.of("flashcards", true, "quiz", true)));

        JsonNode note = waitForStatus(s, id, "ready");
        assertThat(note.get("progress").get("transcript").asInt()).isEqualTo(100);
        assertThat(note.get("progress").get("notes").asInt()).isEqualTo(100);
        assertThat(note.get("title").asText()).isNotBlank();
        assertThat(note.get("sections").size()).isGreaterThan(0);
        assertThat(note.get("sections").get(0).get("id").asText()).isEqualTo("s1");
        assertThat(note.get("sections").get(0).get("ts").isNull()).isTrue(); // pasted transcript has no video timing
        assertThat(note.get("takeaways").size()).isGreaterThan(0);
        assertThat(note.get("error").isNull()).isTrue();
        waitForExtras(s, id);

        // list + search + subject filter
        mvc.perform(get("/api/notes").cookie(s.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.notes[0].id").value(id));
        mvc.perform(get("/api/notes").param("q", "HASH").cookie(s.cookie())).andExpect(jsonPath("$.notes[0].id").value(id));
        mvc.perform(get("/api/notes").param("q", "zzzzqqq").cookie(s.cookie())).andExpect(jsonPath("$.notes.length()").value(0));
        mvc.perform(get("/api/notes").param("subject", "General").cookie(s.cookie())).andExpect(jsonPath("$.notes[0].id").value(id));
        mvc.perform(get("/api/notes").param("subject", "Nope").cookie(s.cookie())).andExpect(jsonPath("$.notes.length()").value(0));

        // flashcards
        MvcResult decks = mvc.perform(get("/api/decks").cookie(s.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.decks[0].noteId").value(id)).andReturn();
        int totalCards = body(decks).get("decks").get(0).get("total").asInt();
        assertThat(totalCards).isGreaterThanOrEqualTo(3);
        assertThat(body(decks).get("decks").get(0).get("due").asInt()).isEqualTo(totalCards);

        JsonNode cards = body(mvc.perform(get("/api/notes/" + id + "/cards").cookie(s.cookie())).andExpect(status().isOk()).andReturn()).get("cards");
        assertThat(cards.get(0).get("due").asBoolean()).isTrue();
        String cardId = cards.get(0).get("id").asText();
        mvc.perform(json(post("/api/cards/" + cardId + "/review").cookie(s.cookie()), Map.of("grade", "good")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.card.due").value(false)).andExpect(jsonPath("$.card.intervalDays").value(1));
        mvc.perform(json(post("/api/cards/" + cardId + "/review").cookie(s.cookie()), Map.of("grade", "again")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.card.intervalDays").value(0)).andExpect(jsonPath("$.card.ease").value(2.3));
        mvc.perform(json(post("/api/cards/" + cardId + "/review").cookie(s.cookie()), Map.of("grade", "bogus")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.fields.grade").exists());

        // quiz: server-side scoring
        JsonNode questions = body(mvc.perform(get("/api/notes/" + id + "/quiz").cookie(s.cookie())).andExpect(status().isOk()).andReturn()).get("questions");
        int total = questions.size();
        assertThat(total).isBetween(5, 10);
        List<Map<String, Object>> allRight = new ArrayList<>();
        List<Map<String, Object>> allWrong = new ArrayList<>();
        for (JsonNode q : questions) {
            int right = q.get("answerIndex").asInt();
            int optionCount = q.get("options").size();
            allRight.add(Map.of("questionId", q.get("id").asText(), "picked", right));
            allWrong.add(Map.of("questionId", q.get("id").asText(), "picked", (right + 1) % optionCount));
        }
        mvc.perform(json(post("/api/notes/" + id + "/quiz/attempts").cookie(s.cookie()), Map.of("answers", allRight)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.attempt.score").value(total))
                .andExpect(jsonPath("$.attempt.total").value(total)).andExpect(jsonPath("$.attempt.mistakes.length()").value(0));
        Thread.sleep(25);
        allWrong.add(Map.of("questionId", "q_unknown", "picked", 0)); // unknown ids are ignored
        mvc.perform(json(post("/api/notes/" + id + "/quiz/attempts").cookie(s.cookie()), Map.of("answers", allWrong)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.attempt.score").value(0))
                .andExpect(jsonPath("$.attempt.total").value(total)).andExpect(jsonPath("$.attempt.mistakes.length()").value(total));
        mvc.perform(get("/api/quizzes").cookie(s.cookie())).andExpect(jsonPath("$.quizzes[0].noteId").value(id))
                .andExpect(jsonPath("$.quizzes[0].total").value(total)).andExpect(jsonPath("$.quizzes[0].lastScore.score").value(0));

        // stats
        MvcResult stats = mvc.perform(get("/api/stats").cookie(s.cookie())).andExpect(status().isOk())
                .andExpect(jsonPath("$.quizzesTaken").value(2)).andExpect(jsonPath("$.averageScore").value(50))
                .andExpect(jsonPath("$.weakTopics[0].missPercent").value(50)).andReturn();
        JsonNode st = body(stats);
        assertThat(st.get("streakDays").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("heatmap").size()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("heatmap").get(0).get("count").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("dueToday").asInt()).isGreaterThanOrEqualTo(totalCards - 1);
        assertThat(st.get("weakTopics").size()).isLessThanOrEqualTo(5);
    }

    @Test
    void noCaptionsThenRetryWithPastedTranscript() throws Exception {
        Session s = signup("NoCap");
        String id = createNote(s, Map.of("url", "https://www.youtube.com/watch?v=nocaptions1"));
        JsonNode failed = waitForStatus(s, id, "failed");
        assertThat(failed.get("error").get("code").asText()).isEqualTo("NO_CAPTIONS");
        assertThat(failed.get("youtubeId").asText()).isEqualTo("nocaptions1");

        mvc.perform(json(post("/api/notes/" + id + "/extras").cookie(s.cookie()), Map.of("flashcards", true, "quiz", false)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("NOT_READY"));

        mvc.perform(json(post("/api/notes/" + id + "/retry").cookie(s.cookie()), Map.of("transcript", transcript())))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.id").value(id));
        JsonNode ready = waitForStatus(s, id, "ready");
        assertThat(ready.get("error").isNull()).isTrue();

        // retry is only for failed notes
        mvc.perform(json(post("/api/notes/" + id + "/retry").cookie(s.cookie()), Map.of()))
                .andExpect(status().isConflict());

        // extras come from the saved notes, without any transcript or video fetch
        mvc.perform(json(post("/api/notes/" + id + "/extras").cookie(s.cookie()), Map.of("flashcards", true, "quiz", true)))
                .andExpect(status().isAccepted());
        waitForExtras(s, id);
        mvc.perform(get("/api/notes/" + id + "/cards").cookie(s.cookie())).andExpect(status().isOk());
    }

    @Test
    void demoVideoLinkProducesTimestampedNotes() throws Exception {
        Session s = signup("Video");
        String id = createNote(s, Map.of("url", "https://youtu.be/dQw4w9WgXcQ"));
        JsonNode note = waitForStatus(s, id, "ready");
        assertThat(note.get("youtubeId").asText()).isEqualTo("dQw4w9WgXcQ");
        assertThat(note.get("sections").get(1).get("ts").asInt()).isEqualTo(134);
        assertThat(note.get("sections").get(0).get("body").asText()).contains("==");
    }

    @Test
    void createValidation() throws Exception {
        Session s = signup("Create");
        mvc.perform(json(post("/api/notes").cookie(s.cookie()), Map.of()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("VALIDATION"))
                .andExpect(jsonPath("$.error.fields.url").exists());
        mvc.perform(json(post("/api/notes").cookie(s.cookie()), Map.of("url", "https://vimeo.com/12345")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_URL"));
    }

    @Test
    void shortTranscriptFailsWithTranscriptTooShort() throws Exception {
        Session s = signup("Short");
        String id = createNote(s, Map.of("transcript", "This is far too short to be a lecture."));
        JsonNode failed = waitForStatus(s, id, "failed");
        assertThat(failed.get("error").get("code").asText()).isEqualTo("TRANSCRIPT_TOO_SHORT");
    }

    @Test
    void videoLongerThanTheLimitFails() throws Exception {
        Session s = signup("Long");
        Note n = new Note(Ids.newId("n_"), s.userId(), Instant.now());
        n.title = "Very long video";
        n.url = "https://www.youtube.com/watch?v=abcdefghijk";
        n.youtubeId = "abcdefghijk";
        n.durationSec = 100_000; // limit is 240 minutes = 14,400 s
        noteRepo.save(n);
        queue.enqueue(n.id);
        JsonNode failed = waitForStatus(s, n.id, "failed");
        assertThat(failed.get("error").get("code").asText()).isEqualTo("VIDEO_TOO_LONG");
    }

    @Test
    void interruptedNotesAreResumedAndSavingExtrasTwiceDoesNotDuplicate() throws Exception {
        Session s = signup("Recover");
        Note n = new Note(Ids.newId("n_"), s.userId(), Instant.now());
        n.title = "Pasted transcript";
        n.transcript = transcript();
        n.status = "processing"; // as if the server died halfway through
        noteRepo.save(n);
        recovery.resumeInterruptedNotes();
        waitForStatus(s, n.id, "ready");

        List<CardOutput> three = List.of(new CardOutput("q1", "a1"), new CardOutput("q2", "a2"), new CardOutput("q3", "a3"));
        state.saveCards(n.id, three);
        state.saveCards(n.id, three);
        assertThat(cardRepo.findByNoteId(n.id)).hasSize(3);
    }

    @Test
    void editAndDeleteNotes() throws Exception {
        Session s = signup("Edit");
        String id = createNote(s, Map.of("transcript", transcript(), "extras", Map.of("flashcards", true)));
        waitForStatus(s, id, "ready");
        await().atMost(Duration.ofSeconds(25)).until(() -> "ready".equals(getNote(s, id).get("extras").get("flashcards").asText()));

        mvc.perform(json(patch("/api/notes/" + id).cookie(s.cookie()), Map.of(
                        "title", "My title", "subject", "CS", "summary", "My summary",
                        "sections", List.of(Map.of("title", "One", "body", "Body ==one=="), Map.of("ts", 5, "title", "Two", "body", "Body two")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note.title").value("My title"))
                .andExpect(jsonPath("$.note.subject").value("CS"))
                .andExpect(jsonPath("$.note.sections.length()").value(2))
                .andExpect(jsonPath("$.note.sections[0].id").value("s1"))
                .andExpect(jsonPath("$.note.sections[1].ts").value(5));
        mvc.perform(json(patch("/api/notes/" + id).cookie(s.cookie()), Map.of("title", "")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.fields.title").exists());

        mvc.perform(delete("/api/notes/" + id).cookie(s.cookie())).andExpect(status().isNoContent());
        mvc.perform(get("/api/notes/" + id).cookie(s.cookie())).andExpect(status().isNotFound());
        assertThat(cardRepo.findByNoteId(id)).isEmpty(); // removed by ON DELETE CASCADE
    }

    @Test
    void usersCannotTouchEachOthersData() throws Exception {
        Session a = signup("Owner");
        Session b = signup("Intruder");
        String id = createNote(a, Map.of("transcript", transcript(), "extras", Map.of("flashcards", true, "quiz", true)));
        waitForStatus(a, id, "ready");
        waitForExtras(a, id);
        String cardId = body(mvc.perform(get("/api/notes/" + id + "/cards").cookie(a.cookie())).andReturn()).get("cards").get(0).get("id").asText();
        JsonNode q = body(mvc.perform(get("/api/notes/" + id + "/quiz").cookie(a.cookie())).andReturn()).get("questions").get(0);

        mvc.perform(get("/api/notes/" + id).cookie(b.cookie())).andExpect(status().isNotFound());
        mvc.perform(json(patch("/api/notes/" + id).cookie(b.cookie()), Map.of("title", "hacked"))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/notes/" + id).cookie(b.cookie())).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/notes/" + id + "/retry").cookie(b.cookie()), Map.of())).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/notes/" + id + "/extras").cookie(b.cookie()), Map.of("flashcards", true, "quiz", true))).andExpect(status().isNotFound());
        mvc.perform(get("/api/notes/" + id + "/cards").cookie(b.cookie())).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/cards/" + cardId + "/review").cookie(b.cookie()), Map.of("grade", "easy"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/notes/" + id + "/quiz").cookie(b.cookie())).andExpect(status().isNotFound());
        mvc.perform(json(post("/api/notes/" + id + "/quiz/attempts").cookie(b.cookie()),
                Map.of("answers", List.of(Map.of("questionId", q.get("id").asText(), "picked", 0))))).andExpect(status().isNotFound());

        mvc.perform(get("/api/notes").cookie(b.cookie())).andExpect(jsonPath("$.notes.length()").value(0));
        mvc.perform(get("/api/decks").cookie(b.cookie())).andExpect(jsonPath("$.decks.length()").value(0));
        mvc.perform(get("/api/notes/" + id).cookie(a.cookie())).andExpect(status().isOk()); // owner unaffected
    }
}
