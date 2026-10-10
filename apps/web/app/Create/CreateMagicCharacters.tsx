"use client";

import "./CreateMagicCharacters.css";

export default function CreateMagicCharacters() {
  return (
    <div className="create-magic-decor" aria-hidden="true">
      <div className="magic-spark magic-spark-one">✦</div>
      <div className="magic-spark magic-spark-two">✧</div>
      <div className="magic-spark magic-spark-three">✦</div>

      <div className="tiny-wizard">
        <div className="wizard-wand"><i /></div>
        <div className="wizard-hat"><i /></div>
        <div className="wizard-face"><i className="wizard-eye eye-left" /><i className="wizard-eye eye-right" /><i className="wizard-blush blush-left" /><i className="wizard-blush blush-right" /></div>
        <div className="wizard-beard" />
        <div className="wizard-body"><i className="wizard-star">✦</i></div>
        <div className="wizard-feet"><i /><i /></div>
        <div className="wizard-shadow" />
      </div>

      <div className="magic-book-wrap">
        <div className="book-spark book-spark-one">✧</div>
        <div className="book-spark book-spark-two">✦</div>
        <div className="magic-book">
          <div className="book-pages" />
          <div className="book-cover">
            <div className="book-border"><span>✦</span><i /><b>✧</b></div>
          </div>
          <div className="book-spine" />
        </div>
        <div className="book-shadow" />
      </div>
    </div>
  );
}
