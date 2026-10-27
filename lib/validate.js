'use strict';

/** One schema per form. Field names match the HTML forms. Keep them in sync if you rename a field. */
const FORMS = {
  contact: {
    subject: 'New ZavexCode website inquiry',
    fields: {
      name: { label: 'Full name', min: 2, max: 100 },
      email: { label: 'Email address', email: true, max: 254 },
      service: { label: 'Service', max: 100 },
      details: { label: 'Project details', min: 10, max: 3000 },
    },
  },
  'software-interest': {
    subject: 'Software interest',
    fields: {
      name: { label: 'Full name', min: 2, max: 100 },
      email: { label: 'Email address', email: true, max: 254 },
      software_type: { label: 'Software type', max: 100 },
      message: { label: 'Message', min: 10, max: 3000 },
    },
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// strip control characters (keep tab/newline), trim
const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

function validate(kind, body) {
  const form = FORMS[kind];
  const errors = {};
  const data = {};
  for (const [name, rule] of Object.entries(form.fields)) {
    const value = clean(body && body[name]);
    if (!value) errors[name] = `${rule.label} is required.`;
    else if (rule.email && !EMAIL.test(value)) errors[name] = 'Enter a valid email address.';
    else if (rule.min && value.length < rule.min) errors[name] = `${rule.label} must be at least ${rule.min} characters.`;
    else if (value.length > rule.max) errors[name] = `${rule.label} must be at most ${rule.max} characters.`;
    data[name] = value;
  }
  return { ok: Object.keys(errors).length === 0, errors, data, subject: form.subject, labels: Object.fromEntries(Object.entries(form.fields).map(([k, r]) => [k, r.label])) };
}

module.exports = { FORMS, validate };
