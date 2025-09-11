/**
 * シークレット検知機能
 * 機密情報が含まれている場合は送信を拒否する
 */

/**
 * Luhnアルゴリズムによるクレジットカード番号検証
 */
function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  // 右から左へ処理
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * クレジットカード番号の検証
 */
function isValidCreditCard(text: string): boolean {
  const cardMatch = /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/.exec(text);
  if (!cardMatch) {
    return false;
  }
  
  const normalizedCardNumber = cardMatch[0].replace(/[-\s]/g, '');
  return isValidLuhn(normalizedCardNumber);
}

const secretPatterns = [
  // OpenAI系APIキー（プレフィックス対応）
  /sk-(?:proj-|svcacct-|None-)?[^\s'"]{16,}/,
  
  // Google API key
  /AIza[0-9A-Za-z\-_]{35}/,
  
  // AWS Access Key
  /AKIA[0-9A-Z]{16}/,
  
  // 秘密鍵
  /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/,
  
  // GitHub Personal Access Token
  /ghp_[A-Za-z0-9]{36}/,
  
  // GitHub fine-grained Personal Access Token
  /github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}/,
  
  // 社会保険番号
  /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/,
  
  // パスポート番号
  /\b[A-Z]{2}[0-9]{7}\b/,
  
  // 運転免許証番号
  /\b[0-9]{12}\b/,
];

/**
 * パターンとラベルのマッピング
 */
const secretPatternMap = [
  { pattern: /sk-(?:proj-|svcacct-|None-)?[^\s'"]{16,}/, label: 'OpenAI API Key' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, label: 'Google API Key' },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key' },
  { pattern: /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/, label: 'Private Key' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub PAT' },
  { pattern: /github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}/, label: 'GitHub Fine-grained PAT' },
  { pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/, label: 'SSN' },
  { pattern: /\b[A-Z]{2}[0-9]{7}\b/, label: 'Passport' },
  { pattern: /\b[0-9]{12}\b/, label: 'Driver License' },
];

/**
 * テキストにシークレットが含まれているかチェック
 */
export function containsSecret(text: string): boolean {
  // 通常のパターンマッチング
  if (secretPatterns.some(pattern => pattern.test(text))) {
    return true;
  }
  
  // クレジットカード番号のLuhn検証
  if (isValidCreditCard(text)) {
    return true;
  }
  
  return false;
}

/**
 * シークレットの種類を特定
 */
export function detectSecretType(text: string): string[] {
  const detectedTypes: string[] = [];
  
  // パターンマップを使用して検出
  for (const { pattern, label } of secretPatternMap) {
    if (pattern.test(text)) {
      detectedTypes.push(label);
    }
  }
  
  // クレジットカード番号の特別処理
  if (isValidCreditCard(text)) {
    detectedTypes.push('Credit Card');
  }
  
  return detectedTypes;
}
