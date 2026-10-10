"use client";

import "./LessonsMagicMascot.css";

export default function LessonsMagicMascot() {
  return (
    <div className="lessons-mascot-zone" aria-hidden="true">
      <span className="lessons-mascot-spark lessons-mascot-spark-one">✦</span>
      <span className="lessons-mascot-spark lessons-mascot-spark-two">✧</span>
      <span className="lessons-mascot-spark lessons-mascot-spark-three">✦</span>
      <div className="lessons-tiny-wizard">
        <div className="lessons-wizard-wand"><i /></div>
        <div className="lessons-wizard-hat"><i /></div>
        <div className="lessons-wizard-face">
          <i className="lessons-wizard-eye lessons-eye-left" />
          <i className="lessons-wizard-eye lessons-eye-right" />
          <i className="lessons-wizard-blush lessons-blush-left" />
          <i className="lessons-wizard-blush lessons-blush-right" />
          <i className="lessons-wizard-smile" />
        </div>
        <div className="lessons-wizard-beard" />
        <div className="lessons-wizard-body"><i>✦</i></div>
        <div className="lessons-wizard-feet"><i /><i /></div>
        <div className="lessons-wizard-shadow" />
      </div>
    </div>
  );
}
