/** Turns LaTeX in Sherlock's text into words, so speech never reads backslashes. */
const REPLACEMENTS: [RegExp, string][] = [
  [/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1 over $2"],
  [/\\sqrt\s*\{([^{}]+)\}/g, "the square root of $1"],
  [/\\(?:left|right|displaystyle|,|;|!|quad|qquad)/g, " "],
  [/\\times/g, " times "],
  [/\\cdot/g, " times "],
  [/\\div/g, " divided by "],
  [/\\pm/g, " plus or minus "],
  [/\\leq/g, " is less than or equal to "],
  [/\\geq/g, " is greater than or equal to "],
  [/\\neq/g, " is not equal to "],
  [/\\approx/g, " is approximately "],
  [/\\to|\\rightarrow/g, " goes to "],
  [/\\infty/g, " infinity "],
  [/\\sum/g, " the sum of "],
  [/\\int/g, " the integral of "],
  [/\\partial/g, " partial "],
  [/\\pi/g, " pi "],
  [/\\theta/g, " theta "],
  [/\\alpha/g, " alpha "],
  [/\\beta/g, " beta "],
  [/\\lambda/g, " lambda "],
  [/\\mu/g, " mu "],
  [/\\sigma/g, " sigma "],
  [/\\Delta|\\delta/g, " delta "],
  [/\\?\^\s*\{?2\}?/g, " squared "],
  [/\\?\^\s*\{?3\}?/g, " cubed "],
  [/\^\s*\{([^{}]+)\}/g, " to the power of $1 "],
  [/\^(\w)/g, " to the power of $1 "],
  [/_\s*\{([^{}]+)\}/g, " sub $1 "],
  [/_(\w)/g, " sub $1 "],
  [/\\[a-zA-Z]+/g, " "],
  [/[{}]/g, " "],
];

export function latexToSpeech(input: string): string {
  let text = (input ?? "")
    .replace(/\$\$([\s\S]+?)\$\$/g, " $1 ")
    .replace(/\\\[([\s\S]+?)\\\]/g, " $1 ")
    .replace(/\\\(([\s\S]+?)\\\)/g, " $1 ")
    .replace(/\$([^$\n]+?)\$/g, " $1 ");
  for (const [pattern, value] of REPLACEMENTS) text = text.replace(pattern, value);
  return text.replace(/[ \t]{2,}/g, " ").trim();
}
