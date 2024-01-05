export const emailValidation = (email) => {
  const pattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  const result = pattern.test(email);
  return result;
};

export const passwordValidation = (password) => {
  const pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[a-zA-Z]).{6,}$/;
  const result = pattern.test(password);
  return result;
};
