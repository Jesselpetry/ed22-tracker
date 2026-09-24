import { useRef, useState } from "react";
import { lookup, newCard } from "@ed22/core";
import { Icon } from "../components/Icon.jsx";
import { Notice, PageHead } from "../components/ui.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { updateDeck, useCourse, useDeck } from "../lib/study-store.js";
import { useToast } from "../lib/toast.jsx";

const OWN = "own";

function lessonOptions(course) {
  const index = new Map();
  let firstPending = "";
  for (const unit of course?.units ?? []) {
    for (const lesson of unit.lessons) {
      const value = String(lesson.nodeId);
      index.set(value, { unit: unit.name, lesson: lesson.name, lessonNodeId: lesson.nodeId });
      if (!firstPending && lesson.pending) firstPending = value;
    }
  }
  return { index, firstPending };
}

export function AddWords() {
  const { t } = useI18n();
  const toast = useToast();
  const course = useCourse();
  const { deck } = useDeck();
  const { index, firstPending } = lessonOptions(course);

  const [lessonId, setLessonId] = useState(firstPending);
  const [word, setWord] = useState("");
  const [result, setResult] = useState(null); // lookup result for `lookedUp`
  const [lookedUp, setLookedUp] = useState("");
  const [choice, setChoice] = useState(OWN);
  const [ownMeaning, setOwnMeaning] = useState("");
  const [example, setExample] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const wordRef = useRef(null);

  const tag = index.get(lessonId) ?? null;
  const trimmed = word.trim();
  const duplicate = Boolean(trimmed) && deck?.cards.some((c) => c.front.toLowerCase() === trimmed.toLowerCase()
    && (c.lessonNodeId ?? null) === (tag?.lessonNodeId ?? null));
  const ready = result && lookedUp === trimmed;

  function reset() {
    setWord("");
    setResult(null);
    setLookedUp("");
    setChoice(OWN);
    setOwnMeaning("");
    setExample("");
    wordRef.current?.focus();
  }

  async function onLookup(event) {
    event.preventDefault();
    if (!trimmed || duplicate) return;
    setBusy(true);
    const found = await lookup(trimmed);
    setBusy(false);
    setResult(found);
    setLookedUp(trimmed);
    setChoice(found.status === "ok" ? 0 : OWN);
    setExample(found.senses[0]?.example ?? "");
  }

  function skipLookup() {
    if (!trimmed || duplicate) return;
    setResult({ status: "skipped", phonetic: null, senses: [] });
    setLookedUp(trimmed);
    setChoice(OWN);
  }

  function pickSense(value) {
    setChoice(value);
    if (value !== OWN) setExample(result.senses[value].example ?? "");
  }

  function onSave(event) {
    event.preventDefault();
    const sense = choice === OWN ? null : result.senses[choice];
    const meaning = sense ? sense.definition : ownMeaning.trim();
    if (!meaning) return;

    const saved = updateDeck((d) => ({
      ...d,
      cards: [...d.cards, newCard({
        front: trimmed,
        back: meaning,
        partOfSpeech: sense?.partOfSpeech ?? null,
        example: example.trim() || null,
        phonetic: result.phonetic ?? null,
        unit: tag?.unit ?? null,
        lesson: tag?.lesson ?? null,
        lessonNodeId: tag?.lessonNodeId ?? null,
      })],
    }));
    toast(saved ? t("wordAdded", { word: trimmed }) : t("storageBlocked"), { tone: saved ? "success" : "error" });
    setAdded((n) => n + 1);
    reset();
  }

  const lookupNote = {
    "not-found": t("lookupNotFound"),
    offline: t("lookupOffline"),
    error: t("lookupOffline"),
  }[result?.status];

  return (
    <>
      <PageHead title={t("addWords")} back={{ href: "#/study", label: t("backToStudy") }}>
        <p className="muted">{added ? t("addedThisVisit", { n: added }) : t("addWordsIntro")}</p>
      </PageHead>

      <section className="card form">
        <div className="field">
          <label htmlFor="lesson">{t("lessonField")}</label>
          <select id="lesson" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">{t("noLesson")}</option>
            {course?.units.map((unit) => (
              <optgroup key={unit.nodeId} label={unit.name}>
                {unit.lessons.map((lesson) => (
                  <option key={lesson.nodeId} value={String(lesson.nodeId)}>
                    {lesson.name}{lesson.pending ? ` · ${t("toDoShort")}` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {!course && <p className="hint">{t("lessonListMissingShort")} <a href="#/study">{t("navStudy")}</a></p>}
        </div>

        <form className="field" onSubmit={onLookup}>
          <label htmlFor="word">{t("wordField")}</label>
          <div className="input-group">
            <input
              id="word"
              ref={wordRef}
              lang="en"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="true"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={t("wordPlaceholder")}
              aria-describedby={duplicate ? "word-duplicate" : undefined}
            />
            <button type="submit" className="button primary" disabled={!trimmed || duplicate || busy}>
              <Icon name="search" size={18} />
              {busy ? t("lookingUp") : t("lookUp")}
            </button>
          </div>
          {duplicate && <p id="word-duplicate" className="field-error">{t("wordDuplicate")}</p>}
          {!ready && trimmed && !duplicate && (
            <button type="button" className="link-button" onClick={skipLookup}>{t("skipLookup")}</button>
          )}
        </form>
      </section>

      {ready && (
        <form className="card form" onSubmit={onSave}>
          <h2 lang="en">
            {lookedUp} {result.phonetic && <span className="muted phonetic">{result.phonetic}</span>}
          </h2>
          {lookupNote && <Notice>{lookupNote}</Notice>}

          <fieldset className="senses">
            <legend>{t("pickMeaning")}</legend>
            {result.senses.map((sense, i) => (
              <label key={i} className={`sense ${choice === i ? "is-selected" : ""}`}>
                <input type="radio" name="sense" checked={choice === i} onChange={() => pickSense(i)} />
                <span lang="en">
                  {sense.partOfSpeech && <span className="badge">{sense.partOfSpeech}</span>} {sense.definition}
                </span>
              </label>
            ))}
            <label className={`sense ${choice === OWN ? "is-selected" : ""}`}>
              <input type="radio" name="sense" checked={choice === OWN} onChange={() => pickSense(OWN)} />
              <span>{t("ownMeaning")}</span>
            </label>
          </fieldset>

          {choice === OWN && (
            <div className="field">
              <label htmlFor="own-meaning">{t("meaningField")}</label>
              <textarea id="own-meaning" rows={2} value={ownMeaning} onChange={(e) => setOwnMeaning(e.target.value)} required />
            </div>
          )}

          <div className="field">
            <label htmlFor="example">{t("exampleField")}</label>
            <input id="example" lang="en" value={example} onChange={(e) => setExample(e.target.value)} />
          </div>

          <div className="button-row">
            <button type="submit" className="button primary" disabled={choice === OWN && !ownMeaning.trim()}>
              <Icon name="plus" size={18} />
              {t("saveCard")}
            </button>
            <button type="button" className="button ghost" onClick={reset}>{t("cancel")}</button>
          </div>
        </form>
      )}
    </>
  );
}
