export const validateLoginId = (loginId: string): string | null => {
  if (!loginId || typeof loginId !== 'string') {
    return 'Login ID is required.';
  }
  const trimmed = loginId.trim();
  if (trimmed.length < 6 || trimmed.length > 12) {
    return 'Login ID must be between 6 and 12 characters.';
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length <= 8) {
    return 'Password must be more than 8 characters long.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!email || typeof email !== 'string') {
    return 'Email is required.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Invalid email format.';
  }
  return null;
};
