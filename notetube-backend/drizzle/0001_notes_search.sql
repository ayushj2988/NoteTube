-- Full-text search vector for notes. A trigger (not a generated column) because
-- array_to_string() is not immutable, and we want the video title in the vector too.
CREATE OR REPLACE FUNCTION notes_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.video_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.key_concepts, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.subject, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.content_md, '')), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER notes_search_trg
  BEFORE INSERT OR UPDATE OF title, video_title, tags, key_concepts, subject, summary, content_md ON notes
  FOR EACH ROW EXECUTE FUNCTION notes_search_update();
