import type { Block, Citation } from "./api";

type ChoiceOption = { key: string; label: string };

const feedbackStyles: Record<string, { label: string; className: string }> = {
  CORRECT: { label: "ถูกต้อง", className: "border-green-200 bg-green-50 text-green-900" },
  PARTIALLY_CORRECT: {
    label: "ถูกบางส่วน",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  TRY_AGAIN: { label: "ลองอีกครั้ง", className: "border-rose-200 bg-rose-50 text-rose-900" },
};

function ChoiceButtons({
  choices,
  disabled,
  onChoose,
}: {
  choices: ChoiceOption[];
  disabled: boolean;
  onChoose: (label: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {choices.map((choice) => (
        <button
          key={choice.key}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(choice.label)}
          className="rounded-xl border border-surface-border bg-background px-4 py-3 text-left text-base hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-surface-border"
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

type BlockViewProps = {
  block: Block;
  // true only for the newest tutor reply while nothing is loading
  interactive: boolean;
  onChoose: (label: string) => void;
};

export default function BlockView({ block, interactive, onChoose }: BlockViewProps) {
  switch (block.type) {
    case "explanation":
      return (
        <section className="rounded-2xl bg-secondary/40 p-5">
          {block.title && (
            <h3 className="mb-2 text-lg font-semibold text-text">{block.title}</h3>
          )}
          <p className="whitespace-pre-wrap leading-relaxed text-text">{block.content}</p>
        </section>
      );

    case "guided_question":
      return (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="mb-2 text-sm font-medium text-indigo-700">Question</p>
          <p className="whitespace-pre-wrap leading-relaxed text-text">{block.content}</p>
          {block.choices && block.choices.length > 0 && (
            <ChoiceButtons
              choices={block.choices.map((choice) => ({ key: choice, label: choice }))}
              disabled={!interactive}
              onChoose={onChoose}
            />
          )}
        </section>
      );

    case "hint":
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-2 text-sm font-medium text-amber-800">
            {block.title ?? `Hint${block.level ? ` ${block.level}` : ""}`}
          </p>
          <p className="whitespace-pre-wrap leading-relaxed text-text">{block.content}</p>
        </section>
      );

    case "quiz": {
      const hasChoices =
        block.format === "MULTIPLE_CHOICE" && block.choices && block.choices.length > 0;

      return (
        <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
          <p className="mb-2 text-sm font-medium text-fuchsia-700">Quiz</p>
          <p className="whitespace-pre-wrap leading-relaxed text-text">{block.prompt}</p>
          {hasChoices ? (
            <ChoiceButtons
              choices={(block.choices ?? []).map((choice) => ({
                key: choice.id,
                label: choice.label,
              }))}
              disabled={!interactive}
              onChoose={onChoose}
            />
          ) : (
            <p className="mt-3 text-sm text-muted">พิมพ์คำตอบในช่องด้านล่าง</p>
          )}
        </section>
      );
    }

    case "feedback": {
      const style = feedbackStyles[block.result] ?? {
        label: block.result,
        className: "border-surface-border bg-secondary/40 text-text",
      };

      return (
        <section className={`rounded-2xl border p-5 ${style.className}`}>
          <p className="mb-2 text-sm font-semibold">{style.label}</p>
          <p className="whitespace-pre-wrap leading-relaxed">{block.content}</p>
        </section>
      );
    }

    case "interactive":
      return (
        <section className="rounded-2xl border border-dashed border-surface-border p-5 text-sm text-muted">
          Interactive component “{block.component}” (ยังไม่ได้ทำ)
        </section>
      );

    default: {
      // A block type this page doesn't know yet: show its text if it has any.
      const unknown = block as unknown as { content?: unknown };
      return typeof unknown.content === "string" ? (
        <section className="rounded-2xl bg-secondary/40 p-5">
          <p className="whitespace-pre-wrap leading-relaxed text-text">{unknown.content}</p>
        </section>
      ) : null;
    }
  }
}

export function CitationList({ citations }: { citations?: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="text-sm text-muted">
      <p className="mb-1 font-medium">แหล่งอ้างอิง</p>
      <ul className="list-inside list-disc">
        {citations.map((citation) => (
          <li key={citation.id}>
            {citation.title}
            {citation.page ? ` (หน้า ${citation.page})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
