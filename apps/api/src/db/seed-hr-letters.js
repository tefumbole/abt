import { randomUUID } from 'node:crypto';

const TEMPLATES = [
  {
    letter_type: 'leave_of_absence',
    name: 'Standard Leave of Absence',
    subject: 'Leave of Absence — {STAFF_NAME}',
    body: `{COMPANY}
Ref: {STAFF_CODE}

Date: {DATE}

TO WHOM IT MAY CONCERN

This is to certify that {STAFF_NAME}, Employee No. {STAFF_CODE}, holding the position of {POSITION}, employed since {HIRE_DATE}, is granted leave of absence from {LEAVE_START} to {LEAVE_END}.

Reason: {LEAVE_REASON}

This leave has been approved by management.

For Alpha Bridge Technologies
HR Department`,
    is_default: 1,
  },
  {
    letter_type: 'permission',
    name: 'Standard Permission / Authorisation',
    subject: 'Permission — {STAFF_NAME}',
    body: `{COMPANY}
Ref: {STAFF_CODE}

Date: {DATE}

AUTHORISATION OF PERMISSION

We hereby authorise {STAFF_NAME} (Employee No. {STAFF_CODE}, {POSITION}) to be absent from duty on {PERMISSION_DATE} for the following reason:

{PERMISSION_REASON}

This permission is granted subject to company policy.

For Alpha Bridge Technologies
HR Department`,
    is_default: 1,
  },
  {
    letter_type: 'employment_letter',
    name: 'Employment Confirmation Letter',
    subject: 'Letter of Employment — {STAFF_NAME}',
    body: `{COMPANY}
Ref: {STAFF_CODE}

Date: {DATE}

TO WHOM IT MAY CONCERN

EMPLOYMENT CONFIRMATION

This letter confirms that {STAFF_NAME} (Employee No. {STAFF_CODE}) is employed by Alpha Bridge Technologies in the capacity of {POSITION}, {CATEGORY} staff, since {HIRE_DATE}.

{STAFF_NAME} is a person of good conduct and continues to be in our employment at the date of this letter.

Should you require further information, please contact our HR department.

For Alpha Bridge Technologies
HR Department`,
    is_default: 1,
  },
  {
    letter_type: 'attestation_of_work',
    name: 'Attestation of Work',
    subject: 'Attestation of Work — {STAFF_NAME}',
    body: `{COMPANY}
Ref: {STAFF_CODE}

Date: {DATE}

ATTESTATION OF WORK

We, Alpha Bridge Technologies, hereby attest that {STAFF_NAME}, Employee No. {STAFF_CODE}, has worked with our organisation as {POSITION} from {HIRE_DATE} to the present date.

During this period, {STAFF_NAME} has performed assigned duties satisfactorily and maintains a good standing with the company.

This attestation is issued upon request for official purposes.

For Alpha Bridge Technologies
HR Department`,
    is_default: 1,
  },
];

export async function seedHrLetters(pool) {
  for (const t of TEMPLATES) {
    const [existing] = await pool.query(
      `SELECT id FROM hr_letter_templates WHERE letter_type = ? AND is_default = 1 LIMIT 1`,
      [t.letter_type]
    );
    if (existing.length) continue;
    await pool.query(
      `INSERT INTO hr_letter_templates (id, letter_type, name, subject, body, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [randomUUID(), t.letter_type, t.name, t.subject, t.body, t.is_default]
    );
  }
}
