import { BalanceSummary } from '../types/ledger';

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

/**
 * Converts Bengali numerals (০-৯) to English digits (0-9).
 */
export function convertBengaliDigits(raw: string): string {
  return raw.replace(/[০-৯]/g, (char) => BENGALI_DIGITS[char] ?? char);
}

/**
 * Normalizes a phone number by converting Bengali digits, removing spaces/dashes/+,
 * and converting 8801XXXXXXXXX (13 digits) to 01XXXXXXXXX.
 */
export function normalizePhone(raw: string): string {
  const digitsOnly = convertBengaliDigits(raw).replace(/\D/g, '');
  if (digitsOnly.startsWith('8801') && digitsOnly.length === 13) {
    return digitsOnly.slice(2);
  }
  return digitsOnly;
}

export function isValidPhone(normalizedPhone: string): boolean {
  return /^\d{6,15}$/.test(normalizedPhone);
}

export function phoneToAuthEmail(normalizedPhone: string): string {
  return `phone_${normalizedPhone}@bakirkhata.app`;
}

export function extractPhoneFromAuthEmail(email: string | null | undefined): string {
  if (!email) return '';
  const match = email.match(/^phone_(\d+)@bakirkhata\.app$/i);
  return match ? match[1] : '';
}

/**
 * Converts Bengali numerals (০-৯) and commas into a clean numeric value.
 */
export function parseNumericInput(raw: string): number {
  const normalized = convertBengaliDigits(raw)
    .replace(/[,\s৳]/g, '')
    .trim();

  if (!normalized) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Safely evaluates a basic arithmetic expression (+, -, ×, ÷) with standard
 * operator precedence, supporting both English and Bengali digits.
 * Returns null if the expression is empty or invalid (e.g., divide by zero).
 */
export function evaluateCalculatorExpression(
  rawExpression: string,
  allowTrailingOperatorTrim = false
): number | null {
  let cleaned = convertBengaliDigits(rawExpression)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[,\s৳]/g, '');

  if (allowTrailingOperatorTrim) {
    cleaned = cleaned.replace(/[+\-*/.]+$/, '');
  }

  if (!cleaned) return null;

  // Tokenize numbers and operators
  const tokens: string[] = [];
  let currentNum = '';

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      currentNum += ch;
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      if (ch === '-' && currentNum === '' && (tokens.length === 0 || /[+\-*/]/.test(tokens[tokens.length - 1]))) {
        currentNum = '-';
      } else {
        if (currentNum === '' || currentNum === '-' || currentNum === '.') return null;
        tokens.push(currentNum);
        tokens.push(ch);
        currentNum = '';
      }
    } else {
      return null;
    }
  }

  if (currentNum !== '') {
    if (currentNum === '-' || currentNum === '.') return null;
    tokens.push(currentNum);
  }

  if (tokens.length === 0 || tokens.length % 2 === 0) return null;

  // First pass: * and /
  const stack: (number | string)[] = [];
  const firstNum = Number(tokens[0]);
  if (!Number.isFinite(firstNum)) return null;
  stack.push(firstNum);

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const nextVal = Number(tokens[i + 1]);
    if (!Number.isFinite(nextVal)) return null;

    if (op === '*' || op === '/') {
      const prevVal = stack.pop() as number;
      if (op === '/' && nextVal === 0) return null;
      const res = op === '*' ? prevVal * nextVal : prevVal / nextVal;
      if (!Number.isFinite(res)) return null;
      stack.push(res);
    } else {
      stack.push(op);
      stack.push(nextVal);
    }
  }

  // Second pass: + and -
  let result = stack[0] as number;
  for (let i = 1; i < stack.length; i += 2) {
    const op = stack[i] as string;
    const val = stack[i + 1] as number;
    result = op === '+' ? result + val : result - val;
  }

  if (!Number.isFinite(result)) return null;
  return Math.round(result * 100) / 100;
}

/**
 * Formats integer/decimal numbers using Bengali numerals (e.g., ১,২০০).
 */
export function formatNumberBn(value: number): string {
  const hasDecimals = Math.abs(value % 1) > 0.001;
  return new Intl.NumberFormat('bn-BD', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(value);
}

/**
 * Formats Taka amount cleanly: ৳ ১,২০০
 */
export function formatTaka(amount: number): string {
  return `৳ ${formatNumberBn(Math.abs(amount))}`;
}

/**
 * Formats Date into readable Bengali date + 12-hour time:
 * Example: ১০ নভেম্বর ২০২৬, ১২:৩০ PM
 */
export function formatDateTimeBn(date: Date): string {
  const day = formatNumberBn(date.getDate());
  const month = BENGALI_MONTHS[date.getMonth()] ?? '';
  const year = String(date.getFullYear()).replace(/\d/g, (d) =>
    '০১২৩৪৫৬৭৮৯'.charAt(Number(d))
  );

  let hours = date.getHours();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hoursBn = String(hours).replace(/\d/g, (d) =>
    '০১২৩৪৫৬৭৮৯'.charAt(Number(d))
  );
  const minutesStr = String(date.getMinutes()).padStart(2, '0');
  const minutesBn = minutesStr.replace(/\d/g, (d) =>
    '০১২৩৪৫৬৭৮৯'.charAt(Number(d))
  );

  return `${day} ${month} ${year}, ${hoursBn}:${minutesBn} ${period}`;
}

/**
 * Converts a Date object to YYYY-MM-DDTHH:mm string for HTML datetime-local input.
 */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/**
 * Parses HTML datetime-local value back into a Date object.
 */
export function fromDateTimeLocalValue(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Core Balance Rule:
 * বর্তমান ব্যালেন্স = মোট বাকি − মোট জমা
 * - > 0 => বাকি (due)
 * - = 0 => কোনো বাকি বা অগ্রিম নেই (settled)
 * - < 0 => অগ্রিম (advance)
 */
export function computeBalance(totalDue: number, totalPayment: number): BalanceSummary {
  const roundedNet = Math.round((totalDue - totalPayment) * 100) / 100;
  if (roundedNet > 0) {
    return { net: roundedNet, status: 'due', absAmount: roundedNet };
  }
  if (roundedNet < 0) {
    return { net: roundedNet, status: 'advance', absAmount: Math.abs(roundedNet) };
  }
  return { net: 0, status: 'settled', absAmount: 0 };
}
