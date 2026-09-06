"use client";

import { useState, useTransition } from "react";
import { recordConsent } from "./actions";
import CallFrame from "./CallFrame";

// Consent copy per spec Section 5, shown in the clinic's regional language +
// English. Hindi is used here as a sensible default for an Indian clinic; the
// clinic's actual regional language and a legally reviewed wording should
// replace this before real patient use (spec Section 8).
const copy = {
  en: {
    heading: "Before you join",
    intro:
      "This consultation will be recorded and transcribed for your medical records.",
    bullets: [
      "The audio recording is deleted after 1 day.",
      "The transcript is deleted after 3 days.",
      "Nothing is kept longer than this.",
    ],
    agree: "I agree to the above.",
    improve:
      "I allow anonymised content (with my name and details removed) to be used to improve the service.",
    join: "Join Consultation",
  },
  hi: {
    heading: "जुड़ने से पहले",
    intro:
      "यह परामर्श आपके चिकित्सा रिकॉर्ड के लिए रिकॉर्ड और ट्रांसक्राइब किया जाएगा।",
    bullets: [
      "ऑडियो रिकॉर्डिंग 1 दिन के बाद हटा दी जाती है।",
      "ट्रांसक्रिप्ट 3 दिन के बाद हटा दिया जाता है।",
      "इससे अधिक समय तक कुछ भी नहीं रखा जाता।",
    ],
    agree: "मैं उपरोक्त से सहमत हूँ।",
    improve:
      "मैं अनुमति देता/देती हूँ कि मेरे नाम और विवरण हटाकर, गुमनाम सामग्री का उपयोग सेवा को बेहतर बनाने के लिए किया जाए।",
    join: "परामर्श में शामिल हों",
  },
};

export default function ConsentGate({
  id,
  name,
  roomUrl,
}: {
  id: string;
  name: string;
  roomUrl: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [improve, setImprove] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (joined) return <CallFrame id={id} name={name} roomUrl={roomUrl} />;

  function join() {
    setError("");
    startTransition(async () => {
      const result = await recordConsent(id, improve);
      if (result.ok) setJoined(true);
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col gap-5 rounded-lg border border-gray-200 p-6">
        <div>
          <h1 className="text-xl font-semibold">
            {copy.en.heading}{" "}
            <span className="text-gray-400">/ {copy.hi.heading}</span>
          </h1>
        </div>

        <div className="flex flex-col gap-2 text-sm text-gray-700">
          <p>{copy.en.intro}</p>
          <p className="text-gray-500">{copy.hi.intro}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {copy.en.bullets.map((b, i) => (
              <li key={i}>
                {b} <span className="text-gray-500">/ {copy.hi.bullets[i]}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {copy.en.agree} <span className="text-gray-500">/ {copy.hi.agree}</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={improve}
            onChange={(e) => setImprove(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {copy.en.improve}{" "}
            <span className="text-gray-500">/ {copy.hi.improve}</span>
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={join}
          disabled={!agreed || pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Joining…" : copy.en.join}
        </button>
      </div>
    </main>
  );
}
