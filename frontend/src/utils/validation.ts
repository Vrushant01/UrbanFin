export const validateLoginId = (loginId: string) => {
  if (loginId.length < 6 || loginId.length > 12) {
    return 'Login ID must be between 6 and 12 characters.';
  }
  return '';
};

export const validatePassword = (password: string) => {
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
  return '';
};
