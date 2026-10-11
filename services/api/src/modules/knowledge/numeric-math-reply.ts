/** Classifies a bounded answer, never evaluates/converts it or awards a score. */
export function isNumericMathReply(input: string): boolean {
  const text = input.normalize("NFKC").trim();
  if (!text || text.length > 128) return false;
  return /^(?:[a-z]\s*=\s*)?[+\-−]?\p{Decimal_Number}+(?:[.,]\p{Decimal_Number}+)?(?:\s*\/\s*[+\-−]?\p{Decimal_Number}+(?:[.,]\p{Decimal_Number}+)?)?(?:e[+\-−]?\p{Decimal_Number}+)?\s*(?:(?:[mkμ]?[vawΩ]|ohms?|volts?|amps?|โวลต์|แอมแปร์|โอห์ม))?[.!]?$/iu.test(text);
}
