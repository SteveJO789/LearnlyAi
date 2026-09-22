import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

const require = createRequire(import.meta.url);
const addFormats: typeof import("ajv-formats").default = require("ajv-formats");

export interface TutorOutputValidationError {
  path: string;
  keyword: string;
  message: string;
}

export interface TutorOutputValidationResult {
  valid: boolean;
  errors: TutorOutputValidationError[];
}

interface ValidatedTutorOutput {
  blocks: Array<{
    id: string;
    type: string;
    citationIds?: string[];
    choices?: Array<{ id: string; label: string }>;
  }>;
  citations: Array<{ id: string }>;
}

const SCHEMA_LOCATIONS = [
  new URL("../../contracts/learning-output.schema.json", import.meta.url),
  new URL("../../../../../contracts/learning-output.schema.json", import.meta.url),
];

let compiledValidator: ValidateFunction | undefined;

function getSchemaValidator(): ValidateFunction | undefined {
  if (compiledValidator) {
    return compiledValidator;
  }

  try {
    const schemaLocation = SCHEMA_LOCATIONS.find((candidate) => existsSync(candidate));

    if (!schemaLocation) {
      return undefined;
    }

    const schema = JSON.parse(readFileSync(schemaLocation, "utf8")) as AnySchema;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    compiledValidator = ajv.compile(schema);

    return compiledValidator;
  } catch {
    return undefined;
  }
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendPath(path: string, property: string): string {
  return `${path}/${escapeJsonPointer(property)}`;
}

function normalizeAjvError(error: ErrorObject): TutorOutputValidationError {
  const params = error.params as Record<string, unknown>;
  let path = error.instancePath;

  if (error.keyword === "required" && typeof params.missingProperty === "string") {
    path = appendPath(path, params.missingProperty);
  }

  if (error.keyword === "additionalProperties" && typeof params.additionalProperty === "string") {
    path = appendPath(path, params.additionalProperty);
  }

  return {
    path,
    keyword: error.keyword,
    message: error.message ?? "must satisfy the Tutor Output contract",
  };
}

function findDuplicateIds(output: ValidatedTutorOutput): TutorOutputValidationError[] {
  const errors: TutorOutputValidationError[] = [];

  const collectDuplicates = (
    values: Array<{ id: string }>,
    basePath: string,
    description: string,
  ): void => {
    const ids = new Set<string>();

    values.forEach((value, index) => {
      if (ids.has(value.id)) {
        errors.push({
          path: `${basePath}/${index}/id`,
          keyword: "uniqueId",
          message: `must be unique within ${description}`,
        });
      }

      ids.add(value.id);
    });
  };

  collectDuplicates(output.blocks, "/blocks", "blocks");
  collectDuplicates(output.citations, "/citations", "citations");

  output.blocks.forEach((block, blockIndex) => {
    if (block.type === "quiz" && block.choices) {
      collectDuplicates(block.choices, `/blocks/${blockIndex}/choices`, "quiz choices");
    }
  });

  return errors;
}

function findUnresolvedCitations(output: ValidatedTutorOutput): TutorOutputValidationError[] {
  const citationIds = new Set(output.citations.map((citation) => citation.id));
  const errors: TutorOutputValidationError[] = [];

  output.blocks.forEach((block, blockIndex) => {
    block.citationIds?.forEach((citationId, citationIndex) => {
      if (!citationIds.has(citationId)) {
        errors.push({
          path: `/blocks/${blockIndex}/citationIds/${citationIndex}`,
          keyword: "citationReference",
          message: `must reference an existing citation: ${citationId}`,
        });
      }
    });
  });

  return errors;
}

export function validateTutorOutput(value: unknown): TutorOutputValidationResult {
  try {
    const validateSchema = getSchemaValidator();

    if (!validateSchema) {
      return {
        valid: false,
        errors: [
          {
            path: "",
            keyword: "validator",
            message: "Tutor Output validation is unavailable",
          },
        ],
      };
    }

    if (!validateSchema(value)) {
      return {
        valid: false,
        errors: (validateSchema.errors ?? []).map(normalizeAjvError),
      };
    }

    const output = value as ValidatedTutorOutput;
    const errors = [...findDuplicateIds(output), ...findUnresolvedCitations(output)];

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch {
    return {
      valid: false,
      errors: [
        {
          path: "",
          keyword: "validator",
          message: "Tutor Output could not be validated",
        },
      ],
    };
  }
}
