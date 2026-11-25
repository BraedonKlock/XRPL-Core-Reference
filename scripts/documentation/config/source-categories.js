export const SOURCE_CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({ category: 'production', inputs: Object.freeze(['include', 'src/libxrpl', 'src/xrpld']) }),
  Object.freeze({ category: 'test', inputs: Object.freeze(['src/test', 'src/tests', 'src/benchmarks']) }),
]);

export const DEFAULT_INCLUDED_CATEGORIES = Object.freeze(['production']);

export function inputsForCategories(categories) {
  const unknown = categories.filter(
    (category) => !SOURCE_CATEGORY_DEFINITIONS.some((definition) => definition.category === category),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown source categories: ${unknown.join(', ')}`);
  }
  return SOURCE_CATEGORY_DEFINITIONS.filter((definition) => categories.includes(definition.category)).flatMap(
    (definition) => definition.inputs,
  );
}

function isWithinInput(file, input) {
  return file === input || file.startsWith(`${input}/`);
}

export function categorizeSourceFile(file) {
  const definition = SOURCE_CATEGORY_DEFINITIONS.find((candidate) =>
    candidate.inputs.some((input) => isWithinInput(file, input)),
  );
  return definition?.category ?? null;
}
