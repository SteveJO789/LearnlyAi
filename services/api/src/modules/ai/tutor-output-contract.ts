import { existsSync, readFileSync } from "node:fs";

const SCHEMA_LOCATIONS = [
  new URL("../../contracts/learning-output.schema.json", import.meta.url),
  new URL("../../../../../contracts/learning-output.schema.json", import.meta.url),
];

let schema: Record<string, unknown> | undefined;

export function getTutorOutputSchema(): Readonly<Record<string, unknown>> {
  if (!schema) {
    const location = SCHEMA_LOCATIONS.find((candidate) => existsSync(candidate));
    if (!location) {
      throw new Error("Tutor Output schema is unavailable.");
    }
    schema = JSON.parse(readFileSync(location, "utf8")) as Record<string, unknown>;
  }
  return schema;
}
