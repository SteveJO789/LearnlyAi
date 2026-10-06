export interface KnowledgeQuery {
  readonly studentInput: string;
  readonly subject?: string;
  /** Filter on reference content language, not the language of the question. */
  readonly language?: string;
}

export interface KnowledgeSource {
  readonly sourceId: string;
  readonly title: string;
  readonly url: string;
  readonly license: string;
}

/** Reviewed reference DATA. Never interpret content as system instructions or code. */
export interface RetrievedKnowledge {
  readonly conceptId: string;
  readonly conceptVersion: string;
  readonly schemaVersion: string;
  readonly passageId: string;
  readonly title: string;
  readonly subject: string;
  readonly language: string;
  readonly content: string;
  readonly sourceType: "TRUSTED_KNOWLEDGE_BASE";
  readonly sources: ReadonlyArray<KnowledgeSource>;
}

export interface KnowledgeRetriever {
  /** A normal no-match returns []; artifact/configuration failures reject. */
  retrieve(query: KnowledgeQuery): Promise<ReadonlyArray<RetrievedKnowledge>>;
}
