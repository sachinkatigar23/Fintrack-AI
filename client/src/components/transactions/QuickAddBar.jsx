import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Mic, MicOff, Sparkles } from "../common/icons.js";
import { aiApi } from "../../services/financeApi.js";
import { errorMessage } from "../../api/axios.js";

const LANG_KEY = "fintrack:voiceLang";
const getSR = () => (typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

const readLang = () => {
  try {
    return localStorage.getItem(LANG_KEY) === "hi-IN" ? "hi-IN" : "en-IN";
  } catch {
    return "en-IN";
  }
};

/**
 * Quick add: type or say "250 petrol kal upi" and the form is filled.
 * Uses the browser's Web Speech API (Chrome / Edge); the text box always works.
 * props: autoVoice (start listening when shown), onItems(items, source)
 */
export default function QuickAddBar({ autoVoice = false, onItems, placeholder = "Quick add · e.g. 250 petrol kal upi" }) {
  const SR = getSR();
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [lang, setLang] = useState(readLang);
  const recRef = useRef(null);
  const inputRef = useRef(null);
  const onItemsRef = useRef(onItems);
  onItemsRef.current = onItems;

  const parse = async (value) => {
    const v = String(value || "").trim();
    if (!v) return;
    setParsing(true);
    try {
      const d = await aiApi.parseTransaction(v.slice(0, 300));
      onItemsRef.current?.(d.items || [], d.source);
    } catch (err) {
      toast.error(errorMessage(err, "Could not understand that"));
    } finally {
      setParsing(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.abort();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
  };

  const start = () => {
    if (!SR) return;
    stop();
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setText(finalText.trim());
        setInterim("");
        parse(finalText);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("Allow microphone access");
      else if (e.error === "no-speech") toast("Didn't catch that – try again", { icon: "🎙️" });
      else if (e.error !== "aborted") toast.error("Voice input stopped");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    setInterim("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  // Opened from the top-bar mic: start listening right away (or focus the box without voice support)
  useEffect(() => {
    if (!autoVoice) return undefined;
    const t = setTimeout(() => (SR ? start() : inputRef.current?.focus()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop the microphone when the form closes
  useEffect(() => () => recRef.current?.abort?.(), []);

  const switchLang = (value) => {
    setLang(value);
    try {
      localStorage.setItem(LANG_KEY, value);
    } catch {
      /* private mode */
    }
    if (listening) stop();
  };

  return (
    <div className={`qa${listening ? " on" : ""}`}>
      <div className="qa-row">
        <span className="qa-ic">
          <Sparkles />
        </span>
        <input
          ref={inputRef}
          className="qa-input"
          maxLength={300}
          placeholder={placeholder}
          value={listening && interim ? interim : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              parse(text);
            }
          }}
          aria-label="Quick add"
        />
        {parsing && <span className="spin" />}
        {SR && (
          <>
            <div className="qa-lang" role="group" aria-label="Voice language">
              <button type="button" className={lang === "en-IN" ? "on" : ""} onClick={() => switchLang("en-IN")}>
                EN
              </button>
              <button type="button" className={lang === "hi-IN" ? "on" : ""} onClick={() => switchLang("hi-IN")}>
                हिं
              </button>
            </div>
            <button
              type="button"
              className={`qa-mic${listening ? " listening" : ""}`}
              onClick={() => (listening ? stop() : start())}
              aria-label={listening ? "Stop listening" : "Speak"}
              title={listening ? "Stop listening" : "Speak"}
            >
              {listening ? <MicOff /> : <Mic />}
            </button>
          </>
        )}
      </div>
      <div className="qa-hint">
        {listening
          ? interim
            ? "Listening…"
            : "Listening… say something like “do sau chai upi”"
          : SR
            ? "Press Enter to fill the form. Works in English and Hinglish."
            : "Press Enter to fill the form. Voice works in Chrome and Edge."}
      </div>
    </div>
  );
}
