(function (root) {
    'use strict';

    const SUBJECT_PREFIX = 'Bug na IDE Synapse';
    const SECTION_SEPARATOR = '\n\n';

    function subjectFrom(values) {
      const title = String(values.title || '').trim();
      return title ? `${SUBJECT_PREFIX}: ${title}` : SUBJECT_PREFIX;
    }

    function answeredSections(fields, values) {
      return fields
      .filter((field) => String(values[field.name] || '').trim())
      .map((field) => `${field.label}\n${String(values[field.name]).trim()}`);
    }

    function environmentSection(environment) {
      const lines = environment.map((entry) => `${entry.label}: ${entry.value}`);
      return ['Ambiente', ...lines].join('\n');
    }

    function build(fields, values, environment) {
      const sections = answeredSections(fields, values).concat(environmentSection(environment));
      return { subject: subjectFrom(values), body: sections.join(SECTION_SEPARATOR) };
    }

    root.SynapseBugReportMessage = Object.freeze({ build });
})(typeof globalThis !== 'undefined' ? globalThis : window);
