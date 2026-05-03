function extractTemplateVariables(text = '') {
  const matches = String(text).match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || [];
  const unique = new Set();

  matches.forEach((token) => {
    const normalized = token.replace(/[{}\s]/g, '');
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique);
}

function renderTemplate(text = '', variables = {}) {
  return String(text).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}

module.exports = {
  extractTemplateVariables,
  renderTemplate
};
